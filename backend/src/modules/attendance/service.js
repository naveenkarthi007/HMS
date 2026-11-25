const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { logAudit } = require('../audit/service');
const { roomScope, studentActiveRoomScope, wardenRoomMatchSql, assertAccessible } = require('../hostels/service');
const { attendanceImportRow } = require('./validation');

const SORTS = { date: 'att.date', student: 'u.name', status: 'att.status' };

const FROM = `
    FROM attendance att
    JOIN students s ON s.id = att.student_id
    JOIN users u ON u.id = s.user_id
    JOIN hostels h ON h.id = att.hostel_id
    LEFT JOIN users mb ON mb.id = att.marked_by`;

const SELECT = `
  SELECT att.id, att.date, att.status, att.updated_at AS markedAt, mb.name AS markedByName,
         s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender,
         h.id AS hostelId, h.name AS hostelName
  ${FROM}`;

// Latest calendar date anywhere on Earth (UTC+14), so users ahead of UTC can mark 'today'.
const latestToday = () => new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);

function scopeWhere(user) {
  const where = new Where();
  if (user.role === 'student') {
    where.add('s.user_id = ? AND s.organisation_id = ?', user.id, user.organisationId);
  } else {
    const scope = studentActiveRoomScope(user);
    where.add(scope.sql, ...scope.params);
  }
  return where;
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = scopeWhere(user);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR s.register_no LIKE ?)', like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'att.hostel_id = ?', query.hostelId);
  where.addIf(query.status, 'att.status = ?', query.status);
  where.addIf(query.date, 'att.date = ?', query.date);
  where.addIf(query.fromDate, 'att.date >= ?', query.fromDate);
  where.addIf(query.toDate, 'att.date <= ?', query.toDate);

  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(att.status = 'present'), 0) AS present,
            COALESCE(SUM(att.status = 'absent'), 0) AS absent,
            COALESCE(SUM(att.status = 'on_leave'), 0) AS onLeave
     ${FROM} ${where.toSql()}`,
    where.params,
  );
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'att.date DESC, u.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return {
    rows,
    total: counts.total,
    pagination,
    summary: { present: counts.present, absent: counts.absent, onLeave: counts.onLeave },
  };
}

/**
 * The marking sheet: every current resident of the hostel with the saved status for the date
 * (or a suggestion of "on_leave" when an approved leave covers that date).
 */
async function sheet(user, { hostelId, date, search }) {
  const hostel = await assertAccessible(user, hostelId);
  const params = [date, date, date, hostelId];
  let wardenSql = '';
  if (user.role === 'warden') {
    wardenSql = `AND ${wardenRoomMatchSql('r')}`;
    params.push(user.id);
  }
  let searchSql = '';
  if (search) {
    const like = likeParam(search);
    searchSql = 'AND (u.name LIKE ? OR s.register_no LIKE ?)';
    params.push(like, like);
  }
  const [rows] = await pool.query(
    `SELECT s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender, r.room_number AS roomNumber,
            att.status AS savedStatus,
            EXISTS (SELECT 1 FROM leave_requests l
                     WHERE l.student_id = s.id AND l.status = 'approved' AND l.from_date <= ? AND l.to_date >= ?) AS onApprovedLeave
       FROM allocations a
       JOIN rooms r ON r.id = a.room_id
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance att ON att.student_id = s.id AND att.date = ?
      WHERE a.status = 'active' AND r.hostel_id = ? ${wardenSql} ${searchSql}
      ORDER BY r.room_number, u.name`,
    params,
  );
  return {
    hostel: { id: hostel.id, gender: hostel.gender },
    date,
    rows: rows.map((r) => ({
      ...r,
      onApprovedLeave: Boolean(r.onApprovedLeave),
      status: r.savedStatus || (r.onApprovedLeave ? 'on_leave' : 'present'),
      isSaved: Boolean(r.savedStatus),
    })),
  };
}

async function mark(user, { hostelId, date, records }) {
  if (date > latestToday())
    throw AppError.badRequest('Attendance cannot be marked for a future date', { date: 'Choose today or earlier' });

  return withTransaction(async (conn) => {
    await assertAccessible(user, hostelId, conn);
    const ids = [...new Set(records.map((r) => r.studentId))];
    const residentParams = [hostelId, ids];
    let wardenSql = '';
    if (user.role === 'warden') {
      wardenSql = `AND ${wardenRoomMatchSql('r')}`;
      residentParams.push(user.id);
    }
    const [residents] = await conn.query(
      `SELECT a.student_id FROM allocations a JOIN rooms r ON r.id = a.room_id
        WHERE a.status = 'active' AND r.hostel_id = ? AND a.student_id IN (?) ${wardenSql}`,
      residentParams,
    );
    const residentSet = new Set(residents.map((r) => r.student_id));
    const outsiders = ids.filter((idValue) => !residentSet.has(idValue));
    if (outsiders.length) {
      throw AppError.badRequest('Some students are not residents of this hostel', {
        records: `Invalid students: ${outsiders.join(', ')}`,
      });
    }

    const values = records.map((r) => [r.studentId, hostelId, date, r.status, user.id]);
    await conn.query(
      `INSERT INTO attendance (student_id, hostel_id, date, status, marked_by) VALUES ? AS incoming
       ON DUPLICATE KEY UPDATE hostel_id = incoming.hostel_id, status = incoming.status, marked_by = incoming.marked_by`,
      [values],
    );
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'mark_attendance',
        entity: 'attendance',
        entityId: hostelId,
        meta: { date, count: records.length },
      },
      conn,
    );
    return { saved: records.length, date, hostelId };
  });
}

/**
 * CSV import: register_no, date, status. The hostel comes from the student's active allocation,
 * which must be in a hostel the user manages. Existing marks for the same day are replaced.
 */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, {
    required: ['register_no', 'date', 'status'],
    rowSchema: attendanceImportRow,
  });
  checkDuplicates(rows, errors, 'date', (r) => `${r.register_no}|${r.date}`);

  if (rows.length) {
    const scope = roomScope(user, 'r', 'h');
    const [residents] = await pool.query(
      `SELECT s.id, s.register_no, r.hostel_id
         FROM students s
         JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
         JOIN rooms r ON r.id = a.room_id
         JOIN hostels h ON h.id = r.hostel_id
        WHERE s.register_no IN (?) AND ${scope.sql}`,
      [rows.map((r) => r.register_no), ...scope.params],
    );
    const byReg = new Map(residents.map((s) => [s.register_no.toUpperCase(), s]));
    const latest = latestToday();
    for (const r of rows) {
      const resident = byReg.get(r.register_no);
      if (!resident) addRowError(errors, r.line, 'register_no', 'Not a current resident of a hostel you manage');
      else Object.assign(r, { studentId: resident.id, hostelId: resident.hostel_id });
      if (r.date > latest) addRowError(errors, r.line, 'date', 'Attendance cannot be in the future');
    }
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO attendance (student_id, hostel_id, date, status, marked_by) VALUES ? AS incoming
       ON DUPLICATE KEY UPDATE hostel_id = incoming.hostel_id, status = incoming.status, marked_by = incoming.marked_by`,
      [rows.map((r) => [r.studentId, r.hostelId, r.date, r.status, user.id])],
    );
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'attendance',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = { list, sheet, mark, importCsv };
