const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { pool } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { MANAGER_GENDER, MANAGER_ROLES } = require('../../utils/roles');
const { logAudit } = require('../audit/service');

const SORTS = { name: 'u.name', email: 'u.email', role: 'u.role', createdAt: 'u.created_at' };

const SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.gender, u.phone, u.is_active AS isActive,
         u.last_login_at AS lastLoginAt, u.created_at AS createdAt
    FROM users u`;

function normalise(row) {
  return row && { ...row, isActive: Boolean(row.isActive) };
}

async function list(user, query) {
  const pagination = getPagination(query);
  const where = new Where().add('u.organisation_id = ? AND u.role IN (?)', user.organisationId, MANAGER_ROLES);
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)', like, like, like);
  }
  where.addIf(query.role, 'u.role = ?', query.role);
  where.addIf(query.gender, 'u.gender = ?', query.gender);
  if (query.status) where.add('u.is_active = ?', query.status === 'active' ? 1 : 0);

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users u ${where.toSql()}`, where.params);
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'u.role ASC, u.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(user, id) {
  const [rows] = await pool.query(`${SELECT} WHERE u.id = ? AND u.organisation_id = ? AND u.role IN (?)`, [
    id,
    user.organisationId,
    MANAGER_ROLES,
  ]);
  if (!rows[0]) throw AppError.notFound('Hostel manager not found');
  return normalise(rows[0]);
}

async function create(user, body) {
  const hash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  const gender = MANAGER_GENDER[body.role];
  const [result] = await pool
    .query(
      `INSERT INTO users (organisation_id, name, email, password_hash, role, gender, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.organisationId, body.name, body.email, hash, body.role, gender, body.phone ?? null],
    )
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY') {
        throw AppError.conflict('A user with this email already exists', { email: 'Email already in use' });
      }
      throw err;
    });

  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'create',
    entity: 'hostel_managers',
    entityId: result.insertId,
    meta: { role: body.role },
  });
  return getById(user, result.insertId);
}

async function update(user, id, body) {
  await getById(user, id);
  const sets = [];
  const params = [];
  for (const [key, column] of [
    ['name', 'name'],
    ['phone', 'phone'],
    ['isActive', 'is_active'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(body[key]);
    }
  }
  if (body.role !== undefined) {
    sets.push('role = ?', 'gender = ?');
    params.push(body.role, MANAGER_GENDER[body.role]);
  }
  if (body.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(body.password, env.BCRYPT_ROUNDS));
  }
  if (sets.length) {
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    if (body.isActive === false || body.password || body.role !== undefined) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [id],
      );
    }
    await logAudit({
      organisationId: user.organisationId,
      userId: user.id,
      action: 'update',
      entity: 'hostel_managers',
      entityId: id,
      meta: body.role ? { role: body.role } : undefined,
    });
  }
  return getById(user, id);
}

async function remove(user, id) {
  const manager = await getById(user, id);
  await pool.query('DELETE FROM users WHERE id = ? AND organisation_id = ? AND role IN (?)', [
    id,
    user.organisationId,
    MANAGER_ROLES,
  ]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'hostel_managers',
    entityId: id,
    meta: { email: manager.email, role: manager.role },
  });
}

module.exports = { list, getById, create, update, remove };
