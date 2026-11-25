const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { getManagedGender } = require('../../utils/roles');
const { hostelScope } = require('../hostels/service');
const { logAudit } = require('../audit/service');
const { wardenImportRow } = require('./validation');

const SORTS = { name: 'u.name', email: 'u.email', createdAt: 'u.created_at' };

const SELECT = `
  SELECT u.id, u.name, u.email, u.gender, u.phone, u.is_active AS isActive, u.last_login_at AS lastLoginAt,
         u.created_at AS createdAt,
         (SELECT GROUP_CONCAT(h.name ORDER BY h.name SEPARATOR ', ')
            FROM hostel_wardens hw JOIN hostels h ON h.id = hw.hostel_id WHERE hw.user_id = u.id) AS hostelNames,
         (SELECT GROUP_CONCAT(h.code ORDER BY h.code SEPARATOR ';')
            FROM hostel_wardens hw JOIN hostels h ON h.id = hw.hostel_id WHERE hw.user_id = u.id) AS hostelCodes,
         (SELECT GROUP_CONCAT(hw.hostel_id ORDER BY hw.hostel_id SEPARATOR ',')
            FROM hostel_wardens hw WHERE hw.user_id = u.id) AS hostelIdList
    FROM users u`;

function normalise(row, assignments = []) {
  if (!row) return row;
  const { hostelIdList, ...rest } = row;
  return {
    ...rest,
    isActive: Boolean(row.isActive),
    hostelIds: hostelIdList ? hostelIdList.split(',').map(Number) : [],
    assignments,
    assignmentSummary: formatAssignmentSummary(assignments),
  };
}

function formatAssignmentSummary(assignments) {
  if (!assignments.length) return '';
  const byHostel = new Map();
  for (const a of assignments) {
    if (!byHostel.has(a.hostelId)) {
      byHostel.set(a.hostelId, { name: a.hostelName, full: false, parts: [] });
    }
    const entry = byHostel.get(a.hostelId);
    if (a.scopeType === 'hostel') {
      entry.full = true;
    } else if (a.scopeType === 'floor') {
      entry.parts.push(`Floor ${a.floor}`);
    } else if (a.scopeType === 'room_range') {
      entry.parts.push(`Rooms ${a.roomStart}–${a.roomEnd}`);
    } else if (a.scopeType === 'room') {
      entry.parts.push(`Room ${a.roomNumber}`);
    }
  }
  return [...byHostel.values()]
    .map((h) => (h.full ? `${h.name} (All)` : `${h.name} (${h.parts.join(', ')})`))
    .join('; ');
}

async function fetchAssignmentsMap(userIds) {
  const map = new Map();
  if (!userIds.length) return map;
  const [rows] = await pool.query(
    `SELECT wa.id, wa.user_id AS userId, wa.hostel_id AS hostelId, h.name AS hostelName, h.code AS hostelCode,
            wa.scope_type AS scopeType, wa.floor, wa.room_start AS roomStart, wa.room_end AS roomEnd,
            wa.room_number AS roomNumber
       FROM warden_assignments wa
       JOIN hostels h ON h.id = wa.hostel_id
      WHERE wa.user_id IN (?)
      ORDER BY h.name, FIELD(wa.scope_type, 'hostel', 'floor', 'room_range', 'room'), wa.floor, wa.room_start, wa.room_number`,
    [userIds],
  );
  for (const r of rows) {
    if (!map.has(r.userId)) map.set(r.userId, []);
    map.get(r.userId).push(r);
  }
  return map;
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = new Where().add("u.organisation_id = ? AND u.role = 'warden'", user.organisationId);
  const managedGender = getManagedGender(user);
  where.addIf(managedGender, 'u.gender = ?', managedGender);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)', like, like, like);
  }
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  if (query.status) where.add('u.is_active = ?', query.status === 'active' ? 1 : 0);
  where.addIf(
    query.hostelId,
    'EXISTS (SELECT 1 FROM hostel_wardens hw WHERE hw.user_id = u.id AND hw.hostel_id = ?)',
    query.hostelId,
  );

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'u.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  const assignMap = await fetchAssignmentsMap(rows.map((r) => r.id));
  return { rows: rows.map((r) => normalise(r, assignMap.get(r.id) || [])), total, pagination };
}

async function getById(user, id) {
  const where = new Where().add("u.id = ? AND u.organisation_id = ? AND u.role = 'warden'", id, user.organisationId);
  where.addIf(getManagedGender(user), 'u.gender = ?', getManagedGender(user));
  const [rows] = await pool.query(`${SELECT} ${where.toSql()}`, where.params);
  if (!rows[0]) throw AppError.notFound('Warden not found');
  const assignMap = await fetchAssignmentsMap([rows[0].id]);
  return normalise(rows[0], assignMap.get(rows[0].id) || []);
}

function normaliseAssignmentItems(input) {
  const rawList = Array.isArray(input?.assignments)
    ? input.assignments
    : (input?.hostelIds || []).map((hostelId) => ({ hostelId, scopeType: 'hostel' }));

  const seen = new Set();
  const items = [];
  for (const item of rawList) {
    const scopeType = item.scopeType || 'hostel';
    const floor = scopeType === 'floor' ? Number(item.floor) : null;
    let roomStart = scopeType === 'room_range' ? String(item.roomStart).trim() : null;
    let roomEnd = scopeType === 'room_range' ? String(item.roomEnd).trim() : null;
    const roomNumber = scopeType === 'room' ? String(item.roomNumber).trim() : null;

    if (scopeType === 'room_range' && /^\d+$/.test(roomStart) && /^\d+$/.test(roomEnd)) {
      if (Number(roomStart) > Number(roomEnd)) [roomStart, roomEnd] = [roomEnd, roomStart];
    }

    const key = `${item.hostelId}|${scopeType}|${floor ?? ''}|${roomStart ?? ''}|${roomEnd ?? ''}|${roomNumber ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ hostelId: Number(item.hostelId), scopeType, floor, roomStart, roomEnd, roomNumber });
    }
  }
  return items;
}

async function replaceAssignments(conn, user, wardenId, input) {
  const items = normaliseAssignmentItems(input);
  const uniqueHostelIds = [...new Set(items.map((i) => i.hostelId))];
  if (uniqueHostelIds.length) {
    const scope = hostelScope(user, 'h');
    const [owned] = await conn.query(`SELECT h.id FROM hostels h WHERE ${scope.sql} AND h.id IN (?)`, [
      ...scope.params,
      uniqueHostelIds,
    ]);
    if (owned.length !== uniqueHostelIds.length) {
      throw AppError.badRequest('One or more hostels do not exist', { hostelIds: 'Unknown hostel selected' });
    }
  }
  await conn.query('DELETE FROM warden_assignments WHERE user_id = ?', [wardenId]);
  await conn.query('DELETE FROM hostel_wardens WHERE user_id = ?', [wardenId]);
  if (items.length) {
    await conn.query(
      'INSERT INTO warden_assignments (user_id, hostel_id, scope_type, floor, room_start, room_end, room_number) VALUES ?',
      [items.map((i) => [wardenId, i.hostelId, i.scopeType, i.floor, i.roomStart, i.roomEnd, i.roomNumber])],
    );
    await conn.query('INSERT INTO hostel_wardens (hostel_id, user_id) VALUES ?', [
      uniqueHostelIds.map((h) => [h, wardenId]),
    ]);
  }
}

async function create(user, body) {
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only create ${managedGender} wardens`);
  }
  const hash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  const id = await withTransaction(async (conn) => {
    const [result] = await conn
      .query(
        `INSERT INTO users (organisation_id, name, email, password_hash, role, gender, phone)
         VALUES (?, ?, ?, ?, 'warden', ?, ?)`,
        [user.organisationId, body.name, body.email, hash, body.gender, body.phone ?? null],
      )
      .catch((err) => {
        if (err.code === 'ER_DUP_ENTRY')
          throw AppError.conflict('A user with this email already exists', { email: 'Email already in use' });
        throw err;
      });
    await replaceAssignments(conn, user, result.insertId, body);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'create',
        entity: 'wardens',
        entityId: result.insertId,
      },
      conn,
    );
    return result.insertId;
  });
  return getById(user, id);
}

async function update(user, id, body) {
  await getById(user, id);
  const managedGender = getManagedGender(user);
  if (managedGender && body.gender && body.gender !== managedGender) {
    throw AppError.forbidden(`You can only manage ${managedGender} wardens`);
  }
  const sets = [];
  const params = [];
  for (const [key, column] of [
    ['name', 'name'],
    ['gender', 'gender'],
    ['phone', 'phone'],
    ['isActive', 'is_active'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(body[key]);
    }
  }
  if (body.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(body.password, env.BCRYPT_ROUNDS));
  }
  if (sets.length) {
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (body.isActive === false || body.password) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [id],
      );
    }
    await logAudit({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entity: 'wardens',
      entityId: id,
    });
  }
  return getById(user, id);
}

async function assignHostels(user, id, input) {
  await getById(user, id);
  await withTransaction(async (conn) => {
    await replaceAssignments(conn, user, id, input);
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'assign_hostels',
        entity: 'wardens',
        entityId: id,
        meta: input,
      },
      conn,
    );
  });
  return getById(user, id);
}

async function remove(user, id) {
  const warden = await getById(user, id);
  await pool.query("DELETE FROM users WHERE id = ? AND organisation_id = ? AND role = 'warden'", [
    id,
    user.organisationId,
  ]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'wardens',
    entityId: id,
    meta: { email: warden.email },
  });
}

/** CSV import: name, email, gender, phone, hostel_codes ("BH1;BH2"). Everyone gets `defaultPassword`. */
async function importCsv(user, { csv, defaultPassword }) {
  const { rows, errors } = parseImport(csv, { required: ['name', 'email', 'gender'], rowSchema: wardenImportRow });
  checkDuplicates(rows, errors, 'email', (r) => r.email);

  const scope = hostelScope(user, 'h');
  const [hostels] = await pool.query(`SELECT h.id, h.code FROM hostels h WHERE ${scope.sql}`, scope.params);
  const hostelByCode = new Map(hostels.map((h) => [h.code.toUpperCase(), h.id]));
  const managedGender = getManagedGender(user);
  if (managedGender) {
    for (const r of rows) {
      if (r.gender !== managedGender) addRowError(errors, r.line, 'gender', `You can only import ${managedGender} wardens`);
    }
  }
  if (rows.length) {
    const [existing] = await pool.query('SELECT email FROM users WHERE email IN (?)', [rows.map((r) => r.email)]);
    const taken = new Set(existing.map((e) => e.email.toLowerCase()));
    for (const r of rows) {
      if (taken.has(r.email)) addRowError(errors, r.line, 'email', 'Email already in use');
      const unknown = r.hostel_codes.filter((c) => !hostelByCode.has(c));
      if (unknown.length) addRowError(errors, r.line, 'hostel_codes', `Unknown hostel code(s): ${unknown.join(', ')}`);
    }
  }
  failIfErrors(errors);

  const hash = await bcrypt.hash(defaultPassword, env.BCRYPT_ROUNDS);
  await withTransaction(async (conn) => {
    for (const r of rows) {
      const [result] = await conn.query(
        `INSERT INTO users (organisation_id, name, email, password_hash, role, gender, phone)
         VALUES (?, ?, ?, ?, 'warden', ?, ?)`,
        [user.organisationId, r.name, r.email, hash, r.gender, r.phone ?? null],
      );
      const ids = [...new Set(r.hostel_codes.map((c) => hostelByCode.get(c)))];
      if (ids.length) {
        await conn.query('INSERT INTO hostel_wardens (hostel_id, user_id) VALUES ?', [
          ids.map((h) => [h, result.insertId]),
        ]);
        await conn.query(
          'INSERT INTO warden_assignments (user_id, hostel_id, scope_type) VALUES ?',
          [ids.map((h) => [result.insertId, h, 'hostel'])],
        );
      }
    }
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'wardens',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = {
  list,
  getById,
  create,
  update,
  assignHostels,
  remove,
  importCsv,
  fetchAssignmentsMap,
  formatAssignmentSummary,
};
