const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { logAudit } = require('../audit/service');
const { hostelScope, roomScope, assertAccessible } = require('../hostels/service');
const { roomImportRow } = require('./validation');

const SORTS = {
  roomNumber: 'v.room_number',
  floor: 'v.floor',
  capacity: 'v.capacity',
  available: 'v.available',
  hostel: 'v.hostel_name',
};

const SELECT = `
  SELECT v.room_id AS id, v.room_number AS roomNumber, v.floor, v.room_type AS roomType, v.room_status AS status,
         v.hostel_id AS hostelId, v.hostel_name AS hostelName, h.code AS hostelCode, v.gender,
         v.capacity, v.occupied, GREATEST(v.available, 0) AS available
    FROM v_room_occupancy v
    JOIN hostels h ON h.id = v.hostel_id`;

async function list(user, query) {
  // Rooms allow up to 200 rows per page so the allocation picker can show a whole hostel at once.
  const pagination = getPagination(query, 200);

  const scope = roomScope(user, 'v', 'h');
  const where = new Where().add(scope.sql, ...scope.params);
  where.addIf(query.hostelId, 'v.hostel_id = ?', query.hostelId);
  where.addIf(query.gender, 'v.gender = ?', query.gender);
  where.addIf(query.status, 'v.room_status = ?', query.status);
  if (query.available === true) where.add("v.room_status = 'active' AND h.is_active = 1 AND v.available > 0");
  if (query.available === false) where.add('v.available <= 0');
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(v.room_number LIKE ? OR v.hostel_name LIKE ?)', like, like);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM v_room_occupancy v JOIN hostels h ON h.id = v.hostel_id ${where.toSql()}`,
    where.params,
  );
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()}
      ORDER BY ${getSort(query.sort, SORTS, 'v.hostel_name ASC, v.floor ASC, v.room_number ASC')}
      LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows, total, pagination };
}

async function getById(user, id) {
  const scope = roomScope(user, 'v', 'h');
  const [rows] = await pool.query(`${SELECT} WHERE v.room_id = ? AND ${scope.sql}`, [id, ...scope.params]);
  if (!rows[0]) throw AppError.notFound('Room not found');
  const [residents] = await pool.query(
    `SELECT a.id AS allocationId, s.id AS studentId, u.name, s.register_no AS registerNo, s.department, s.year,
            a.start_date AS startDate
       FROM allocations a
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
      WHERE a.room_id = ? AND a.status = 'active'
      ORDER BY u.name`,
    [id],
  );
  return { ...rows[0], residents };
}

async function create(user, body) {
  await assertAccessible(user, body.hostelId);
  const [result] = await pool
    .query('INSERT INTO rooms (hostel_id, room_number, floor, capacity, room_type, status) VALUES (?, ?, ?, ?, ?, ?)', [
      body.hostelId,
      body.roomNumber,
      body.floor,
      body.capacity,
      body.roomType,
      body.status,
    ])
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') {
        throw AppError.conflict('This room number already exists in the hostel', {
          roomNumber: 'Room number already exists',
        });
      }
      throw err;
    });
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'rooms',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

async function update(user, id, body) {
  const room = await getById(user, id);
  if (body.capacity !== undefined && body.capacity < room.occupied) {
    throw AppError.conflict(`Capacity cannot be lower than current occupancy (${room.occupied})`, {
      capacity: `At least ${room.occupied} beds are in use`,
    });
  }
  if (body.status === 'maintenance' && room.occupied > 0) {
    throw AppError.conflict('Vacate the residents before putting this room under maintenance', {
      status: 'Room has active residents',
    });
  }
  const map = {
    roomNumber: 'room_number',
    floor: 'floor',
    capacity: 'capacity',
    roomType: 'room_type',
    status: 'status',
  };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (body[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(body[key]);
    }
  }
  if (sets.length) {
    await pool.query(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, [...params, id]).catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') {
        throw AppError.conflict('This room number already exists in the hostel', {
          roomNumber: 'Room number already exists',
        });
      }
      throw err;
    });
    await logAudit({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entity: 'rooms',
      entityId: id,
      meta: body,
    });
  }
  return getById(user, id);
}

async function remove(user, id) {
  const room = await getById(user, id);
  const [[{ history }]] = await pool.query('SELECT COUNT(*) AS history FROM allocations WHERE room_id = ?', [id]);
  if (history > 0) {
    throw AppError.conflict(
      'This room has allocation history and cannot be deleted. Put it under maintenance instead.',
    );
  }
  await pool.query('DELETE FROM rooms WHERE id = ?', [id]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'rooms',
    entityId: id,
    meta: { roomNumber: room.roomNumber, hostelId: room.hostelId },
  });
}

/** CSV import: hostel_code, room_number, floor, capacity, room_type, status. All rows or nothing. */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, {
    required: ['hostel_code', 'room_number', 'floor', 'capacity', 'room_type'],
    rowSchema: roomImportRow,
  });
  checkDuplicates(rows, errors, 'room_number', (r) => `${r.hostel_code}|${r.room_number.toUpperCase()}`);

  const scope = hostelScope(user);
  const [hostels] = await pool.query(`SELECT h.id, h.code FROM hostels h WHERE ${scope.sql}`, scope.params);
  const hostelByCode = new Map(hostels.map((h) => [h.code.toUpperCase(), h.id]));
  const [existing] = await pool.query(
    `SELECT r.hostel_id, r.room_number FROM rooms r JOIN hostels h ON h.id = r.hostel_id WHERE ${scope.sql}`,
    scope.params,
  );
  const taken = new Set(existing.map((r) => `${r.hostel_id}|${r.room_number.toUpperCase()}`));
  for (const r of rows) {
    r.hostelId = hostelByCode.get(r.hostel_code);
    if (!r.hostelId) addRowError(errors, r.line, 'hostel_code', `No hostel with code ${r.hostel_code}`);
    else if (taken.has(`${r.hostelId}|${r.room_number.toUpperCase()}`)) {
      addRowError(errors, r.line, 'room_number', 'Room already exists in this hostel');
    }
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    await conn.query('INSERT INTO rooms (hostel_id, room_number, floor, capacity, room_type, status) VALUES ?', [
      rows.map((r) => [r.hostelId, r.room_number, r.floor, r.capacity, r.room_type, r.status]),
    ]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'rooms',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = { list, getById, create, update, remove, importCsv };
