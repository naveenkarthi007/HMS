const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { logAudit } = require('../audit/service');
const { studentActiveRoomScope } = require('../hostels/service');

const SORTS = { outAt: 'o.out_at', createdAt: 'o.created_at', student: 'u.name' };

// Late = came back after the expected time, or still out past it.
const IS_LATE = `((o.status = 'returned' AND o.returned_at > o.expected_return_at)
                 OR (o.status = 'out' AND UTC_TIMESTAMP() > o.expected_return_at))`;

const FROM = `
    FROM outing_requests o
    JOIN students s ON s.id = o.student_id
    JOIN users u ON u.id = s.user_id
    JOIN hostels h ON h.id = o.hostel_id
    LEFT JOIN users rv ON rv.id = o.reviewed_by`;

const SELECT = `
  SELECT o.id, o.destination, o.reason, o.out_at AS outAt, o.expected_return_at AS expectedReturnAt,
         o.status, o.review_note AS reviewNote, o.reviewed_at AS reviewedAt, rv.name AS reviewedByName,
         o.checked_out_at AS checkedOutAt, o.returned_at AS returnedAt, o.created_at AS createdAt,
         ${IS_LATE} AS isLate,
         s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender, u.phone,
         h.id AS hostelId, h.name AS hostelName,
         (SELECT r.room_number FROM allocations a JOIN rooms r ON r.id = a.room_id
           WHERE a.student_id = s.id AND a.status = 'active' LIMIT 1) AS roomNumber
  ${FROM}`;

const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function normalise(row) {
  return row && { ...row, isLate: Boolean(row.isLate) };
}

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
    where.add('(u.name LIKE ? OR s.register_no LIKE ? OR o.destination LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'o.hostel_id = ?', query.hostelId);
  if (query.status === 'late') where.add(IS_LATE);
  else where.addIf(query.status, 'o.status = ?', query.status);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY ${getSort(query.sort, SORTS, "FIELD(o.status, 'out', 'pending', 'approved') DESC, o.out_at DESC, o.id DESC")}
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id, conn = pool) {
  const where = scopeWhere(user).add('o.id = ?', id);
  const [rows] = await conn.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Outing request not found');
  return normalise(rows[0]);
}

async function create(user, body) {
  // Allow a few minutes of clock skew for "leaving now".
  const earliest = new Date(Date.now() - 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  if (body.outAt < earliest) {
    throw AppError.badRequest('Outing cannot start in the past', { outAt: 'Choose a time from now on' });
  }

  const [rows] = await pool.query(
    `SELECT s.id AS student_id, r.hostel_id
       FROM students s
       LEFT JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
       LEFT JOIN rooms r ON r.id = a.room_id
      WHERE s.user_id = ? AND s.organisation_id = ?`,
    [user.id, user.organisationId],
  );
  const student = rows[0];
  if (!student) throw AppError.notFound('Student profile not found');
  if (!student.hostel_id) {
    throw new AppError(409, 'NO_ACTIVE_ALLOCATION', 'You need a hostel room to request an outing');
  }

  const [overlaps] = await pool.query(
    `SELECT id FROM outing_requests
      WHERE student_id = ? AND status IN ('pending', 'approved', 'out')
        AND out_at < ? AND expected_return_at > ?
      LIMIT 1`,
    [student.student_id, body.expectedReturnAt, body.outAt],
  );
  if (overlaps.length) {
    throw AppError.conflict('You already have an outing request for this time', { outAt: 'Overlaps another outing' });
  }

  const [result] = await pool.query(
    `INSERT INTO outing_requests (student_id, hostel_id, destination, reason, out_at, expected_return_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [student.student_id, student.hostel_id, body.destination, body.reason, body.outAt, body.expectedReturnAt],
  );
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'outing_requests',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

/**
 * Moves an outing from one of `from` statuses to `to`, inside a locked transaction.
 */
async function transition(user, id, from, to, extraSql = '', extraParams = []) {
  await withTransaction(async (conn) => {
    await getById(user, id, conn);
    const [[locked]] = await conn.query('SELECT status FROM outing_requests WHERE id = ? FOR UPDATE', [id]);
    if (!from.includes(locked.status)) {
      throw AppError.conflict(`This outing is ${locked.status.replace('_', ' ')}; it cannot be marked ${to}`);
    }
    await conn.query(`UPDATE outing_requests SET status = ?${extraSql} WHERE id = ?`, [to, ...extraParams, id]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: `outing_${to}`,
        entity: 'outing_requests',
        entityId: id,
      },
      conn,
    );
  });
  return getById(user, id);
}

const review = (user, id, { status, note }) =>
  transition(user, id, ['pending'], status, ', review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP', [
    note ?? null,
    user.id,
  ]);

const checkOut = (user, id) => transition(user, id, ['approved'], 'out', ', checked_out_at = ?', [nowUtc()]);

const checkIn = (user, id) => transition(user, id, ['out'], 'returned', ', returned_at = ?', [nowUtc()]);

const cancel = (user, id) => transition(user, id, ['pending', 'approved'], 'cancelled');

module.exports = { list, getById, create, review, checkOut, checkIn, cancel };
