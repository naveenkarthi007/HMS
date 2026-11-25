const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { getManagedGender } = require('../../utils/roles');
const { logAudit } = require('../audit/service');
const { roomScope } = require('../hostels/service');
const { allocationImportRow } = require('./validation');

const SORTS = {
  student: 'u.name',
  startDate: 'a.start_date',
  endDate: 'a.end_date',
  room: 'r.room_number',
  hostel: 'h.name',
};

const FROM = `
    FROM allocations a
    JOIN students s ON s.id = a.student_id
    JOIN users u ON u.id = s.user_id
    JOIN rooms r ON r.id = a.room_id
    JOIN hostels h ON h.id = r.hostel_id
    LEFT JOIN users ab ON ab.id = a.allocated_by`;

const SELECT = `
  SELECT a.id, a.status, a.start_date AS startDate, a.end_date AS endDate, a.created_at AS createdAt,
         s.id AS studentId, u.name AS studentName, s.register_no AS registerNo, u.gender,
         r.id AS roomId, r.room_number AS roomNumber, h.id AS hostelId, h.name AS hostelName, h.code AS hostelCode,
         ab.name AS allocatedByName
  ${FROM}`;

const today = () => new Date().toISOString().slice(0, 10);

async function list(user, query) {
  const pagination = getPagination(query);
  const scope = roomScope(user, 'r', 'h');
  const where = new Where().add(scope.sql, ...scope.params);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR s.register_no LIKE ? OR r.room_number LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'h.gender = ?', query.gender);
  where.addIf(query.hostelId, 'h.id = ?', query.hostelId);
  where.addIf(query.status, 'a.status = ?', query.status);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${FROM} ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY ${getSort(query.sort, SORTS, "a.status = 'active' DESC, a.start_date DESC, a.id DESC")}
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows, total, pagination };
}

async function getById(user, id, conn = pool) {
  const scope = roomScope(user, 'r', 'h');
  const [rows] = await conn.query(`${SELECT} WHERE a.id = ? AND ${scope.sql}`, [id, ...scope.params]);
  if (!rows[0]) throw AppError.notFound('Allocation not found');
  return rows[0];
}

/**
 * Allocates a bed on a connection that is already inside a transaction (used by POST /allocations
 * and by approving a hostel application). Locks the student and the room rows (SELECT ... FOR UPDATE)
 * so concurrent requests can never overfill a room or double-allocate a student. Gender is re-checked
 * here regardless of what the UI sent.
 */
async function allocateInTransaction(conn, user, { studentId, roomId, startDate }) {
  const start = startDate || today();
  const [students] = await conn.query(
    `SELECT s.id, u.gender, u.is_active, u.name
         FROM students s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.organisation_id = ?
        FOR UPDATE`,
    [studentId, user.organisationId],
  );
  const student = students[0];
  if (!student) throw AppError.notFound('Student not found');
  if (!student.is_active) throw AppError.conflict('This student account is inactive');

  const managedGender = getManagedGender(user);
  if (managedGender && student.gender !== managedGender) {
    throw AppError.forbidden(`You can only allocate ${managedGender} students`);
  }

  const [rooms] = await conn.query(
    `SELECT r.id, r.capacity, r.status, r.room_number, h.id AS hostel_id, h.gender, h.is_active AS hostel_active, h.name AS hostel_name
         FROM rooms r JOIN hostels h ON h.id = r.hostel_id
        WHERE r.id = ? AND h.organisation_id = ?
        FOR UPDATE`,
    [roomId, user.organisationId],
  );
  const room = rooms[0];
  if (!room) throw AppError.notFound('Room not found');
  if (managedGender && room.gender !== managedGender) {
    throw AppError.forbidden(`You can only allocate rooms in ${managedGender} hostels`);
  }

  if (room.gender !== student.gender) {
    throw new AppError(
      409,
      'GENDER_MISMATCH',
      `${room.hostel_name} is a ${room.gender} hostel; ${student.name} cannot be allocated here`,
      {
        roomId: 'Hostel gender does not match the student',
      },
    );
  }
  if (!room.hostel_active) throw AppError.conflict('This hostel is inactive');
  if (room.status !== 'active') {
    throw new AppError(409, 'ROOM_UNDER_MAINTENANCE', `Room ${room.room_number} is under maintenance`, {
      roomId: 'Room is under maintenance',
    });
  }

  const [existing] = await conn.query(
    "SELECT id FROM allocations WHERE student_id = ? AND status = 'active' FOR UPDATE",
    [studentId],
  );
  if (existing.length) {
    throw new AppError(409, 'ALREADY_ALLOCATED', `${student.name} already has an active room. Vacate it first.`, {
      studentId: 'Student already has an active allocation',
    });
  }

  const [[{ occupied }]] = await conn.query(
    "SELECT COUNT(*) AS occupied FROM allocations WHERE room_id = ? AND status = 'active' FOR UPDATE",
    [roomId],
  );
  if (occupied >= room.capacity) {
    throw new AppError(409, 'ROOM_FULL', `Room ${room.room_number} is full`, { roomId: 'No free beds in this room' });
  }

  const [result] = await conn
    .query(
      "INSERT INTO allocations (student_id, room_id, allocated_by, start_date, status) VALUES (?, ?, ?, ?, 'active')",
      [studentId, roomId, user.id, start],
    )
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY')
        throw new AppError(409, 'ALREADY_ALLOCATED', 'Student already has an active allocation');
      throw err;
    });

  await logAudit(
    {
      organisationId: user.organisationId,
      userId: user.id,
      action: 'allocate',
      entity: 'allocations',
      entityId: result.insertId,
      meta: { studentId, roomId, hostelId: room.hostel_id },
    },
    conn,
  );
  return result.insertId;
}

/** Public entry point: allocate inside a fresh transaction and return the allocation. */
async function create(user, body) {
  const allocationId = await withTransaction((conn) => allocateInTransaction(conn, user, body));
  return getById(user, allocationId);
}

async function vacate(user, id, { endDate }) {
  const end = endDate || today();
  await withTransaction(async (conn) => {
    const scope = roomScope(user, 'r', 'h');
    const [rows] = await conn.query(
      `SELECT a.id, a.status, a.start_date, a.student_id, a.room_id
         FROM allocations a
         JOIN rooms r ON r.id = a.room_id
         JOIN hostels h ON h.id = r.hostel_id
        WHERE a.id = ? AND ${scope.sql}
        FOR UPDATE`,
      [id, ...scope.params],
    );
    const allocation = rows[0];
    if (!allocation) throw AppError.notFound('Allocation not found');
    if (allocation.status !== 'active') throw AppError.conflict('This allocation has already been vacated');
    if (end < allocation.start_date) {
      throw AppError.badRequest('End date cannot be before the start date', {
        endDate: 'Must be on or after the start date',
      });
    }
    await conn.query("UPDATE allocations SET status = 'vacated', end_date = ? WHERE id = ?", [end, id]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'vacate',
        entity: 'allocations',
        entityId: id,
        meta: { studentId: allocation.student_id, roomId: allocation.room_id, endDate: end },
      },
      conn,
    );
  });
  return getById(user, id);
}

/**
 * CSV import: register_no, hostel_code, room_number, start_date.
 * Every row goes through allocateInTransaction (gender, capacity, maintenance and one-active-room
 * rules) inside ONE transaction, so either every row is allocated or none is.
 */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, {
    required: ['register_no', 'hostel_code', 'room_number'],
    rowSchema: allocationImportRow,
  });
  checkDuplicates(rows, errors, 'register_no', (r) => r.register_no);

  if (rows.length) {
    const [students] = await pool.query(
      'SELECT id, register_no FROM students WHERE organisation_id = ? AND register_no IN (?)',
      [user.organisationId, rows.map((r) => r.register_no)],
    );
    const studentByReg = new Map(students.map((s) => [s.register_no.toUpperCase(), s.id]));
    const [rooms] = await pool.query(
      `SELECT r.id, r.room_number, h.code FROM rooms r JOIN hostels h ON h.id = r.hostel_id WHERE h.organisation_id = ?`,
      [user.organisationId],
    );
    const roomByKey = new Map(rooms.map((r) => [`${r.code.toUpperCase()}|${r.room_number.toUpperCase()}`, r.id]));
    for (const r of rows) {
      r.studentId = studentByReg.get(r.register_no);
      r.roomId = roomByKey.get(`${r.hostel_code}|${r.room_number.toUpperCase()}`);
      if (!r.studentId) addRowError(errors, r.line, 'register_no', 'No student with this register number');
      if (!r.roomId) addRowError(errors, r.line, 'room_number', `No room ${r.room_number} in hostel ${r.hostel_code}`);
    }
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    for (const r of rows) {
      try {
        await allocateInTransaction(conn, user, { studentId: r.studentId, roomId: r.roomId, startDate: r.start_date });
      } catch (err) {
        if (!(err instanceof AppError)) throw err;
        const field = err.details && Object.keys(err.details)[0] === 'studentId' ? 'register_no' : 'room_number';
        addRowError(errors, r.line, field, err.message);
      }
    }
    // Any failed row rolls back every allocation made above.
    failIfErrors(errors);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'allocations',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = { list, getById, create, vacate, allocateInTransaction, importCsv };
