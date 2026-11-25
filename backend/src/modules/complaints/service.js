const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { logAudit } = require('../audit/service');
const { studentActiveRoomScope, wardenRoomMatchSql } = require('../hostels/service');

const SORTS = {
  createdAt: 'c.created_at',
  priority: "FIELD(c.priority, 'high', 'medium', 'low')",
  status: "FIELD(c.status, 'open', 'in_progress', 'resolved', 'closed')",
  title: 'c.title',
};

const FROM = `
    FROM complaints c
    JOIN students s ON s.id = c.student_id
    JOIN users u ON u.id = s.user_id
    JOIN hostels h ON h.id = c.hostel_id
    LEFT JOIN users au ON au.id = c.assigned_to`;

const SELECT = `
  SELECT c.id, c.category, c.title, c.description, c.priority, c.status, c.resolved_at AS resolvedAt,
         c.created_at AS createdAt, c.updated_at AS updatedAt,
         s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender,
         h.id AS hostelId, h.name AS hostelName,
         c.assigned_to AS assignedTo, au.name AS assignedToName,
         (SELECT r.room_number FROM allocations a JOIN rooms r ON r.id = a.room_id
           WHERE a.student_id = s.id AND a.status = 'active' LIMIT 1) AS roomNumber
  ${FROM}`;

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
    where.add('(c.title LIKE ? OR u.name LIKE ? OR s.register_no LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'c.hostel_id = ?', query.hostelId);
  where.addIf(query.status, 'c.status = ?', query.status);
  where.addIf(query.category, 'c.category = ?', query.category);
  where.addIf(query.priority, 'c.priority = ?', query.priority);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'c.created_at DESC, c.id DESC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows, total, pagination };
}

async function getById(user, id) {
  const where = scopeWhere(user).add('c.id = ?', id);
  const [rows] = await pool.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Complaint not found');
  return rows[0];
}

async function create(user, body) {
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
    throw new AppError(409, 'NO_ACTIVE_ALLOCATION', 'You need an active room allocation to raise a complaint');
  }
  const [result] = await pool.query(
    'INSERT INTO complaints (student_id, hostel_id, category, title, description, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [student.student_id, student.hostel_id, body.category, body.title, body.description, body.priority],
  );
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'complaints',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

async function update(user, id, body) {
  const complaint = await getById(user, id);
  const sets = [];
  const params = [];

  if (body.assignedTo !== undefined && body.assignedTo !== null) {
    const [staff] = await pool.query(
      `SELECT u.id FROM users u
        WHERE u.id = ? AND u.organisation_id = ? AND u.is_active = 1
          AND (u.role = 'org_admin'
               OR (u.role IN ('boys_hostel_manager', 'girls_hostel_manager') AND u.gender = ?)
               OR (u.role = 'warden' AND (
                 EXISTS (
                   SELECT 1 FROM allocations _a JOIN rooms _r ON _r.id = _a.room_id
                    WHERE _a.student_id = ? AND _a.status = 'active' AND ${wardenRoomMatchSql('_r', 'u.id')}
                 )
                 OR (
                   NOT EXISTS (SELECT 1 FROM allocations _a2 WHERE _a2.student_id = ? AND _a2.status = 'active')
                   AND EXISTS (SELECT 1 FROM warden_assignments wa WHERE wa.user_id = u.id AND wa.hostel_id = ?)
                 )
               )))`,
      [body.assignedTo, user.organisationId, complaint.gender, complaint.studentId, complaint.studentId, complaint.hostelId],
    );
    if (!staff[0]) {
      throw AppError.badRequest('Complaints can only be assigned to an admin, hostel manager or a warden of this hostel', {
        assignedTo: 'Invalid assignee',
      });
    }
  }
  if (body.assignedTo !== undefined) {
    sets.push('assigned_to = ?');
    params.push(body.assignedTo);
  }
  if (body.priority !== undefined) {
    sets.push('priority = ?');
    params.push(body.priority);
  }
  if (body.status !== undefined) {
    sets.push('status = ?');
    params.push(body.status);
    if (body.status === 'resolved' || body.status === 'closed') {
      sets.push('resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP)');
    } else {
      sets.push('resolved_at = NULL');
    }
    if (body.status === 'in_progress' && body.assignedTo === undefined && !complaint.assignedTo) {
      sets.push('assigned_to = ?');
      params.push(user.id);
    }
  }
  await pool.query(`UPDATE complaints SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'update',
    entity: 'complaints',
    entityId: id,
    meta: body,
  });
  return getById(user, id);
}

module.exports = { list, getById, create, update };
