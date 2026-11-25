const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { getManagedGender } = require('../../utils/roles');
const { wardenRoomMatchSql } = require('../hostels/service');
const { logAudit } = require('../audit/service');

const SORTS = { fromDate: 'l.from_date', toDate: 'l.to_date', createdAt: 'l.created_at', student: 'u.name' };

// The hostel shown for a leave is the student's current hostel (from the active allocation).
const FROM = `
    FROM leave_requests l
    JOIN students s ON s.id = l.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
    LEFT JOIN rooms r ON r.id = a.room_id
    LEFT JOIN hostels h ON h.id = r.hostel_id
    LEFT JOIN users rv ON rv.id = l.reviewed_by`;

const SELECT = `
  SELECT l.id, l.from_date AS fromDate, l.to_date AS toDate, DATEDIFF(l.to_date, l.from_date) + 1 AS days,
         l.reason, l.status, l.review_note AS reviewNote, l.reviewed_at AS reviewedAt, l.created_at AS createdAt,
         rv.name AS reviewedByName,
         s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender,
         h.id AS hostelId, h.name AS hostelName, r.room_number AS roomNumber
  ${FROM}`;

function scopeWhere(user) {
  const where = new Where().add('s.organisation_id = ?', user.organisationId);
  if (user.role === 'student') where.add('s.user_id = ?', user.id);
  else if (user.role === 'warden') {
    where.add(wardenRoomMatchSql('r'), user.id);
  } else {
    where.addIf(getManagedGender(user), 'u.gender = ?', getManagedGender(user));
  }
  return where;
}

// Earliest calendar date anywhere on Earth (UTC-12), so users behind UTC can apply for 'today'.
const earliestToday = () => new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10);

async function list(user, query) {
  const pagination = getPagination(query);
  const where = scopeWhere(user);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR s.register_no LIKE ? OR l.reason LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'h.id = ?', query.hostelId);
  where.addIf(query.status, 'l.status = ?', query.status);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY ${getSort(query.sort, SORTS, "l.status = 'pending' DESC, l.from_date DESC, l.id DESC")}
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows, total, pagination };
}

async function getById(user, id, conn = pool) {
  const where = scopeWhere(user).add('l.id = ?', id);
  const [rows] = await conn.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Leave request not found');
  return rows[0];
}

async function create(user, body) {
  if (body.fromDate < earliestToday()) {
    throw AppError.badRequest('Leave cannot start in the past', { fromDate: 'Choose today or a later date' });
  }
  const [students] = await pool.query('SELECT id FROM students WHERE user_id = ? AND organisation_id = ?', [
    user.id,
    user.organisationId,
  ]);
  if (!students[0]) throw AppError.notFound('Student profile not found');
  const studentId = students[0].id;

  const [overlaps] = await pool.query(
    `SELECT id FROM leave_requests
      WHERE student_id = ? AND status IN ('pending', 'approved') AND from_date <= ? AND to_date >= ?
      LIMIT 1`,
    [studentId, body.toDate, body.fromDate],
  );
  if (overlaps.length) {
    throw AppError.conflict('You already have a leave request covering some of these dates', {
      fromDate: 'Overlaps an existing leave',
    });
  }

  const [result] = await pool.query(
    'INSERT INTO leave_requests (student_id, from_date, to_date, reason) VALUES (?, ?, ?, ?)',
    [studentId, body.fromDate, body.toDate, body.reason],
  );
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'leave_requests',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

async function review(user, id, { status, note }) {
  await withTransaction(async (conn) => {
    const leave = await getById(user, id, conn);
    const [[locked]] = await conn.query('SELECT status FROM leave_requests WHERE id = ? FOR UPDATE', [leave.id]);
    if (locked.status !== 'pending') throw AppError.conflict(`This leave request is already ${locked.status}`);
    await conn.query(
      'UPDATE leave_requests SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, note ?? null, user.id, id],
    );
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: `leave_${status}`,
        entity: 'leave_requests',
        entityId: id,
      },
      conn,
    );
  });
  return getById(user, id);
}

async function cancel(user, id) {
  const leave = await getById(user, id);
  if (leave.status !== 'pending') throw AppError.conflict('Only pending leave requests can be cancelled');
  await pool.query("DELETE FROM leave_requests WHERE id = ? AND status = 'pending'", [id]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'cancel',
    entity: 'leave_requests',
    entityId: id,
  });
}

module.exports = { list, getById, create, review, cancel };
