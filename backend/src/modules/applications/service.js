const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { getManagedGender } = require('../../utils/roles');
const { logAudit } = require('../audit/service');
const { allocateInTransaction } = require('../allocations/service');

/** Hostel booking is open to first-year students only. */
const ELIGIBLE_YEAR = 1;

const SORTS = { createdAt: 'ap.created_at', student: 'u.name', status: 'ap.status' };

const FROM = `
    FROM hostel_applications ap
    JOIN students s ON s.id = ap.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN hostels ph ON ph.id = ap.preferred_hostel_id
    LEFT JOIN users rv ON rv.id = ap.reviewed_by
    LEFT JOIN allocations al ON al.id = ap.allocation_id
    LEFT JOIN rooms ar ON ar.id = al.room_id
    LEFT JOIN hostels ah ON ah.id = ar.hostel_id`;

const SELECT = `
  SELECT ap.id, ap.status, ap.preferred_room_type AS preferredRoomType, ap.student_note AS studentNote,
         ap.review_note AS reviewNote, ap.reviewed_at AS reviewedAt, ap.created_at AS createdAt,
         rv.name AS reviewedByName,
         s.id AS studentId, u.name AS studentName, u.email, s.register_no AS registerNo, s.department, s.year, u.gender,
         ph.id AS preferredHostelId, ph.name AS preferredHostelName,
         ap.allocation_id AS allocationId, ar.room_number AS allocatedRoomNumber, ah.name AS allocatedHostelName,
         EXISTS (SELECT 1 FROM allocations x WHERE x.student_id = s.id AND x.status = 'active') AS hasRoom
  ${FROM}`;

function normalise(row) {
  return row && { ...row, hasRoom: Boolean(row.hasRoom) };
}

function scopeWhere(user) {
  const where = new Where().add('s.organisation_id = ?', user.organisationId);
  if (user.role === 'student') where.add('s.user_id = ?', user.id);
  else where.addIf(getManagedGender(user), 'u.gender = ?', getManagedGender(user));
  return where;
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = scopeWhere(user);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR s.register_no LIKE ? OR u.email LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  where.addIf(query.hostelId, 'ap.preferred_hostel_id = ?', query.hostelId);
  where.addIf(query.status, 'ap.status = ?', query.status);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY ${getSort(query.sort, SORTS, "ap.status = 'pending' DESC, ap.created_at DESC, ap.id DESC")}
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id, conn = pool) {
  const where = scopeWhere(user).add('ap.id = ?', id);
  const [rows] = await conn.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Application not found');
  return normalise(rows[0]);
}

async function loadStudent(user) {
  const [rows] = await pool.query(
    `SELECT s.id, s.year, u.gender, u.is_active,
            EXISTS (SELECT 1 FROM allocations a WHERE a.student_id = s.id AND a.status = 'active') AS has_room
       FROM students s JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ? AND s.organisation_id = ?`,
    [user.id, user.organisationId],
  );
  if (!rows[0]) throw AppError.notFound('Student profile not found');
  return rows[0];
}

/** What the booking form needs: eligibility and the same-gender hostels with free beds. */
async function options(user) {
  const student = await loadStudent(user);
  const eligible = student.year === ELIGIBLE_YEAR && !student.has_room && Boolean(student.is_active);
  const [hostels] = await pool.query(
    `SELECT h.id, h.name, h.code, h.gender,
            COALESCE(SUM(CASE WHEN v.room_status = 'active' THEN GREATEST(v.available, 0) ELSE 0 END), 0) AS available,
            GROUP_CONCAT(DISTINCT CASE WHEN v.room_status = 'active' AND v.available > 0 THEN v.room_type END
                         ORDER BY v.room_type SEPARATOR ',') AS roomTypes
       FROM hostels h
       LEFT JOIN v_room_occupancy v ON v.hostel_id = h.id
      WHERE h.organisation_id = ? AND h.gender = ? AND h.is_active = 1
      GROUP BY h.id, h.name, h.code, h.gender
      ORDER BY h.name`,
    [user.organisationId, student.gender],
  );
  return {
    eligible,
    year: student.year,
    hasRoom: Boolean(student.has_room),
    reason: student.has_room
      ? 'You already have a room.'
      : student.year !== ELIGIBLE_YEAR
        ? 'Hostel booking is only open to first-year students.'
        : null,
    hostels: hostels.map((h) => ({ ...h, roomTypes: h.roomTypes ? h.roomTypes.split(',') : [] })),
  };
}

async function create(user, body) {
  const student = await loadStudent(user);
  if (!student.is_active) throw AppError.forbidden('Your account is inactive');
  if (student.year !== ELIGIBLE_YEAR) {
    throw new AppError(403, 'NOT_ELIGIBLE', 'Hostel booking is only open to first-year students');
  }
  if (student.has_room) throw new AppError(409, 'ALREADY_ALLOCATED', 'You already have a room allocated');

  if (body.preferredHostelId) {
    const [hostels] = await pool.query(
      'SELECT id, gender, is_active FROM hostels WHERE id = ? AND organisation_id = ?',
      [body.preferredHostelId, user.organisationId],
    );
    const hostel = hostels[0];
    if (!hostel || !hostel.is_active) {
      throw AppError.badRequest('Choose one of the listed hostels', { preferredHostelId: 'Unknown hostel' });
    }
    if (hostel.gender !== student.gender) {
      throw new AppError(400, 'GENDER_MISMATCH', 'You can only choose a hostel for your gender', {
        preferredHostelId: 'This hostel is for another gender',
      });
    }
  }

  const [result] = await pool
    .query(
      `INSERT INTO hostel_applications (student_id, preferred_hostel_id, preferred_room_type, student_note)
       VALUES (?, ?, ?, ?)`,
      [student.id, body.preferredHostelId, body.preferredRoomType, body.studentNote ?? null],
    )
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError(409, 'APPLICATION_PENDING', 'You already have a pending application');
      }
      throw err;
    });
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'apply',
    entity: 'hostel_applications',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

async function cancel(user, id) {
  const application = await getById(user, id);
  if (application.status !== 'pending') throw AppError.conflict('Only pending applications can be cancelled');
  await pool.query("UPDATE hostel_applications SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [id]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'cancel',
    entity: 'hostel_applications',
    entityId: id,
  });
  return getById(user, id);
}

/**
 * Approve (allocating the chosen bed in the same transaction) or reject a pending application.
 */
async function review(user, id, body) {
  await withTransaction(async (conn) => {
    const application = await getById(user, id, conn);
    const [[locked]] = await conn.query('SELECT status FROM hostel_applications WHERE id = ? FOR UPDATE', [id]);
    if (locked.status !== 'pending') throw AppError.conflict(`This application is already ${locked.status}`);

    if (body.decision === 'approved') {
      const allocationId = await allocateInTransaction(conn, user, {
        studentId: application.studentId,
        roomId: body.roomId,
        startDate: body.startDate,
      });
      await conn.query(
        `UPDATE hostel_applications
            SET status = 'approved', allocation_id = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [allocationId, body.note ?? null, user.id, id],
      );
    } else {
      await conn.query(
        `UPDATE hostel_applications
            SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [body.note, user.id, id],
      );
    }
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: `application_${body.decision}`,
        entity: 'hostel_applications',
        entityId: id,
      },
      conn,
    );
  });
  return getById(user, id);
}

module.exports = { list, getById, options, create, cancel, review };
