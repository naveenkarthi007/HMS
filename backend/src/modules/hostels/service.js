const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { getManagedGender } = require('../../utils/roles');
const { logAudit } = require('../audit/service');
const { hostelImportRow } = require('./validation');

/**
 * SQL fragment restricting a `hostels` alias to what the user may see.
 * org_admin: all hostels of the organisation.
 * boys_hostel_manager / girls_hostel_manager: only hostels matching their managed gender.
 * warden: only assigned hostels.
 * organisation_id always comes from the JWT (req.user).
 */
function hostelScope(user, alias = 'h') {
  if (user.role === 'warden') {
    return {
      sql: `${alias}.organisation_id = ? AND ${alias}.id IN (SELECT hw.hostel_id FROM hostel_wardens hw WHERE hw.user_id = ?)`,
      params: [user.organisationId, user.id],
    };
  }
  const managedGender = getManagedGender(user);
  if (managedGender) {
    return {
      sql: `${alias}.organisation_id = ? AND ${alias}.gender = ?`,
      params: [user.organisationId, managedGender],
    };
  }
  return { sql: `${alias}.organisation_id = ?`, params: [user.organisationId] };
}

/**
 * SQL EXISTS predicate matching a room alias (with `hostel_id`, `floor`, `room_number`)
 * against a warden's `warden_assignments` rules (hostel, floor, room_range, or individual room).
 */
function wardenRoomMatchSql(roomAlias = 'r', userIdExpr = '?') {
  return `EXISTS (
    SELECT 1 FROM warden_assignments _wa
     WHERE _wa.user_id = ${userIdExpr}
       AND _wa.hostel_id = ${roomAlias}.hostel_id
       AND (
         _wa.scope_type = 'hostel'
         OR (_wa.scope_type = 'floor' AND _wa.floor = ${roomAlias}.floor)
         OR (_wa.scope_type = 'room' AND _wa.room_number = ${roomAlias}.room_number)
         OR (_wa.scope_type = 'room_range' AND (
           (_wa.room_start REGEXP '^[0-9]+$' AND _wa.room_end REGEXP '^[0-9]+$'
             AND ${roomAlias}.room_number REGEXP '^[0-9]+$'
             AND CAST(${roomAlias}.room_number AS UNSIGNED) BETWEEN CAST(_wa.room_start AS UNSIGNED) AND CAST(_wa.room_end AS UNSIGNED))
           OR
           (NOT (_wa.room_start REGEXP '^[0-9]+$' AND _wa.room_end REGEXP '^[0-9]+$')
             AND ${roomAlias}.room_number BETWEEN _wa.room_start AND _wa.room_end)
         ))
       )
  )`;
}

/**
 * SQL fragment restricting a room alias (`rooms r` or `v_room_occupancy v`) to what the user may see.
 * For wardens, filters by room/floor/hostel assignments; for others, delegates to hostelScope.
 */
function roomScope(user, roomAlias = 'r', hostelAlias = 'h') {
  if (user.role === 'warden') {
    return {
      sql: `${hostelAlias}.organisation_id = ? AND ${wardenRoomMatchSql(roomAlias)}`,
      params: [user.organisationId, user.id],
    };
  }
  return hostelScope(user, hostelAlias);
}

/**
 * SQL fragment restricting a student's active room to what a warden may manage
 * (or falling back to hostelScope for admin/manager roles).
 */
function studentActiveRoomScope(user, studentAlias = 's', hostelAlias = 'h') {
  if (user.role === 'warden') {
    return {
      sql: `${hostelAlias}.organisation_id = ? AND EXISTS (
        SELECT 1 FROM allocations _a
        JOIN rooms _r ON _r.id = _a.room_id
        WHERE _a.student_id = ${studentAlias}.id
          AND _a.status = 'active'
          AND _r.hostel_id = ${hostelAlias}.id
          AND ${wardenRoomMatchSql('_r')}
      )`,
      params: [user.organisationId, user.id],
    };
  }
  return hostelScope(user, hostelAlias);
}

const SORTS = { name: 'h.name', code: 'h.code', gender: 'h.gender', createdAt: 'h.created_at' };

const SELECT = `
  SELECT h.id, h.organisation_id AS organisationId, h.name, h.code, h.gender, h.address, h.is_active AS isActive,
         h.created_at AS createdAt, h.updated_at AS updatedAt,
         COALESCE(occ.roomCount, 0) AS roomCount,
         COALESCE(occ.beds, 0) AS beds,
         COALESCE(occ.occupied, 0) AS occupied,
         COALESCE(occ.beds, 0) - COALESCE(occ.occupied, 0) AS available,
         (SELECT GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ')
            FROM hostel_wardens hw JOIN users u ON u.id = hw.user_id
           WHERE hw.hostel_id = h.id) AS wardenNames
    FROM hostels h
    LEFT JOIN (
      SELECT v.hostel_id,
             COUNT(*) AS roomCount,
             SUM(CASE WHEN v.room_status = 'active' THEN v.capacity ELSE 0 END) AS beds,
             SUM(v.occupied) AS occupied
        FROM v_room_occupancy v
       GROUP BY v.hostel_id
    ) occ ON occ.hostel_id = h.id`;

function normalise(row) {
  return row && { ...row, isActive: Boolean(row.isActive) };
}

async function list(user, query) {
  const pagination = getPagination(query);
  const scope = hostelScope(user);
  const where = new Where().add(scope.sql, ...scope.params);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(h.name LIKE ? OR h.code LIKE ?)', like, like);
  }
  where.addIf(query.gender, 'h.gender = ?', query.gender);
  if (query.status) where.add('h.is_active = ?', query.status === 'active' ? 1 : 0);
  if (query.hasAvailability) {
    where.add('h.is_active = 1 AND COALESCE(occ.beds, 0) - COALESCE(occ.occupied, 0) > 0');
  }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM (${SELECT} ${where.toSql()}) t`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'h.gender ASC, h.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id) {
  const scope = hostelScope(user);
  const [rows] = await pool.query(`${SELECT} WHERE h.id = ? AND ${scope.sql}`, [id, ...scope.params]);
  if (!rows[0]) throw AppError.notFound('Hostel not found');
  const hostel = normalise(rows[0]);
  const [wardens] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.gender
       FROM hostel_wardens hw JOIN users u ON u.id = hw.user_id
      WHERE hw.hostel_id = ? ORDER BY u.name`,
    [id],
  );
  return { ...hostel, wardens };
}

/** Throws 404 unless the hostel exists inside the user's scope. */
async function assertAccessible(user, hostelId, conn = pool) {
  const scope = hostelScope(user);
  const [rows] = await conn.query(`SELECT h.id, h.gender, h.is_active FROM hostels h WHERE h.id = ? AND ${scope.sql}`, [
    hostelId,
    ...scope.params,
  ]);
  if (!rows[0]) throw AppError.notFound('Hostel not found');
  return rows[0];
}

async function getAccessibleHostelIds(user) {
  const scope = hostelScope(user);
  const [rows] = await pool.query(`SELECT h.id FROM hostels h WHERE ${scope.sql}`, scope.params);
  return rows.map((r) => r.id);
}

async function create(user, body) {
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only create ${managedGender} hostels`);
  }
  const [result] = await pool
    .query('INSERT INTO hostels (organisation_id, name, code, gender, address, is_active) VALUES (?, ?, ?, ?, ?, ?)', [
      user.organisationId,
      body.name,
      body.code,
      body.gender,
      body.address ?? null,
      body.isActive ?? true,
    ])
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY')
        throw AppError.conflict('Hostel code already exists', { code: 'Code already in use' });
      throw err;
    });
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'hostels',
    entityId: result.insertId,
  });
  return getById(user, result.insertId);
}

async function update(user, id, body) {
  const current = await getById(user, id);
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only manage ${managedGender} hostels`);
  }
  if (body.gender && body.gender !== current.gender && current.occupied > 0) {
    throw AppError.conflict('Cannot change the gender of a hostel that has active residents', {
      gender: 'Vacate all residents first',
    });
  }
  const map = { name: 'name', code: 'code', gender: 'gender', address: 'address', isActive: 'is_active' };
  const sets = [];
  const params = [];
  for (const [key, column] of Object.entries(map)) {
    if (body[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(body[key]);
    }
  }
  if (sets.length) {
    await pool
      .query(`UPDATE hostels SET ${sets.join(', ')} WHERE id = ? AND organisation_id = ?`, [
        ...params,
        id,
        user.organisationId,
      ])
      .catch((err) => {
        if (err.code === 'ER_DUP_ENTRY')
          throw AppError.conflict('Hostel code already exists', { code: 'Code already in use' });
        throw err;
      });
    await logAudit({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entity: 'hostels',
      entityId: id,
      meta: body,
    });
  }
  return getById(user, id);
}

async function remove(user, id) {
  const hostel = await getById(user, id);
  if (hostel.roomCount > 0) {
    throw AppError.conflict('Delete or move the rooms of this hostel first, or deactivate it instead');
  }
  await pool.query('DELETE FROM hostels WHERE id = ? AND organisation_id = ?', [id, user.organisationId]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'hostels',
    entityId: id,
    meta: { name: hostel.name },
  });
}

/** CSV import: name, code, gender, address, is_active. All rows or nothing. */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, { required: ['name', 'code', 'gender'], rowSchema: hostelImportRow });
  checkDuplicates(rows, errors, 'code', (r) => r.code);
  const managedGender = getManagedGender(user);
  if (managedGender) {
    for (const r of rows) {
      if (r.gender !== managedGender) addRowError(errors, r.line, 'gender', `You can only import ${managedGender} hostels`);
    }
  }
  if (rows.length) {
    const [existing] = await pool.query('SELECT code FROM hostels WHERE organisation_id = ? AND code IN (?)', [
      user.organisationId,
      rows.map((r) => r.code),
    ]);
    const taken = new Set(existing.map((e) => e.code.toUpperCase()));
    for (const r of rows) if (taken.has(r.code)) addRowError(errors, r.line, 'code', 'Hostel code already exists');
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    await conn.query('INSERT INTO hostels (organisation_id, name, code, gender, address, is_active) VALUES ?', [
      rows.map((r) => [user.organisationId, r.name, r.code, r.gender, r.address, r.is_active]),
    ]);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'hostels',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = {
  hostelScope,
  wardenRoomMatchSql,
  roomScope,
  studentActiveRoomScope,
  list,
  getById,
  assertAccessible,
  getAccessibleHostelIds,
  create,
  update,
  remove,
  importCsv,
};
