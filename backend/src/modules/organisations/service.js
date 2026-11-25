const bcrypt = require('bcrypt');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { getPagination, getSort, likeParam, Where } = require('../../utils/pagination');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { logAudit } = require('../audit/service');
const { organisationImportRow } = require('./validation');

const SORTS = { name: 'o.name', code: 'o.code', createdAt: 'o.created_at' };

const SELECT = `
  SELECT o.id, o.name, o.code, o.address, o.contact_email AS contactEmail, o.contact_phone AS contactPhone,
         o.is_active AS isActive, o.created_at AS createdAt, o.updated_at AS updatedAt,
         (SELECT COUNT(*) FROM hostels h WHERE h.organisation_id = o.id) AS hostelCount,
         (SELECT COUNT(*) FROM students s WHERE s.organisation_id = o.id) AS studentCount,
         (SELECT COUNT(*) FROM users u WHERE u.organisation_id = o.id AND u.role = 'org_admin') AS adminCount
    FROM organisations o`;

function normalise(row) {
  return row && { ...row, isActive: Boolean(row.isActive) };
}

async function list(query) {
  const pagination = getPagination(query);
  const where = new Where();
  if (query.search) {
    const like = likeParam(query.search);
    where.add('(o.name LIKE ? OR o.code LIKE ? OR o.contact_email LIKE ?)', like, like, like);
  }
  if (query.status) where.add('o.is_active = ?', query.status === 'active' ? 1 : 0);

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM organisations o ${where.toSql()}`,
    where.params,
  );
  const [rows] = await pool.query(
    `${SELECT} ${where.toSql()} ORDER BY ${getSort(query.sort, SORTS, 'o.name ASC')} LIMIT ? OFFSET ?`,
    [...where.params, pagination.limit, pagination.offset],
  );
  return { rows: rows.map(normalise), total, pagination };
}

async function getById(id) {
  const [rows] = await pool.query(`${SELECT} WHERE o.id = ?`, [id]);
  if (!rows[0]) throw AppError.notFound('Organisation not found');
  return normalise(rows[0]);
}

async function create(user, body) {
  const [result] = await pool.query(
    `INSERT INTO organisations (name, code, address, contact_email, contact_phone, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      body.name,
      body.code,
      body.address ?? null,
      body.contactEmail ?? null,
      body.contactPhone ?? null,
      body.isActive ?? true,
    ],
  );
  await logAudit({
    organisationId: result.insertId,
    userId: user.id,
    action: 'create',
    entity: 'organisations',
    entityId: result.insertId,
  });
  return getById(result.insertId);
}

async function update(user, id, body) {
  await getById(id);
  const map = {
    name: 'name',
    code: 'code',
    address: 'address',
    contactEmail: 'contact_email',
    contactPhone: 'contact_phone',
    isActive: 'is_active',
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
    await pool.query(`UPDATE organisations SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
    await logAudit({
      organisationId: id,
      userId: user.id,
      action: 'update',
      entity: 'organisations',
      entityId: id,
      meta: body,
    });
  }
  return getById(id);
}

async function remove(user, id) {
  const org = await getById(id);
  if (org.hostelCount > 0 || org.studentCount > 0 || org.adminCount > 0) {
    throw AppError.conflict('Organisation still has hostels, students or admins. Deactivate it instead.');
  }
  await pool.query('DELETE FROM organisations WHERE id = ?', [id]);
  await logAudit({
    userId: user.id,
    action: 'delete',
    entity: 'organisations',
    entityId: id,
    meta: { name: org.name },
  });
}

async function listAdmins(organisationId) {
  await getById(organisationId);
  const [rows] = await pool.query(
    `SELECT id, name, email, gender, phone, is_active AS isActive, last_login_at AS lastLoginAt, created_at AS createdAt
       FROM users WHERE organisation_id = ? AND role = 'org_admin' ORDER BY name`,
    [organisationId],
  );
  return rows.map((r) => ({ ...r, isActive: Boolean(r.isActive) }));
}

async function createAdmin(user, organisationId, body) {
  await getById(organisationId);
  const hash = await bcrypt.hash(body.password, env.BCRYPT_ROUNDS);
  const [result] = await pool
    .query(
      `INSERT INTO users (organisation_id, name, email, password_hash, role, gender, phone)
     VALUES (?, ?, ?, ?, 'org_admin', ?, ?)`,
      [organisationId, body.name, body.email, hash, body.gender ?? null, body.phone ?? null],
    )
    .catch((err) => {
      if (err.code === 'ER_DUP_ENTRY')
        throw AppError.conflict('A user with this email already exists', { email: 'Email already in use' });
      throw err;
    });
  await logAudit({
    organisationId,
    userId: user.id,
    action: 'create',
    entity: 'users',
    entityId: result.insertId,
    meta: { role: 'org_admin' },
  });
  const admins = await listAdmins(organisationId);
  return admins.find((a) => a.id === result.insertId);
}

async function updateAdmin(user, organisationId, adminId, body) {
  const [rows] = await pool.query("SELECT id FROM users WHERE id = ? AND organisation_id = ? AND role = 'org_admin'", [
    adminId,
    organisationId,
  ]);
  if (!rows[0]) throw AppError.notFound('Admin not found');
  const sets = [];
  const params = [];
  if (body.name !== undefined) {
    sets.push('name = ?');
    params.push(body.name);
  }
  if (body.phone !== undefined) {
    sets.push('phone = ?');
    params.push(body.phone);
  }
  if (body.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(body.isActive);
  }
  if (body.password) {
    sets.push('password_hash = ?');
    params.push(await bcrypt.hash(body.password, env.BCRYPT_ROUNDS));
  }
  if (sets.length) {
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...params, adminId]);
    if (body.isActive === false || body.password) {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [adminId],
      );
    }
    await logAudit({ organisationId, userId: user.id, action: 'update', entity: 'users', entityId: adminId });
  }
  const admins = await listAdmins(organisationId);
  return admins.find((a) => a.id === adminId);
}

/** CSV import (super admin): name, code, address, contact_email, contact_phone, is_active. */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, { required: ['name', 'code'], rowSchema: organisationImportRow });
  checkDuplicates(rows, errors, 'name', (r) => r.name.toLowerCase());
  checkDuplicates(rows, errors, 'code', (r) => r.code);
  if (rows.length) {
    const [existing] = await pool.query('SELECT name, code FROM organisations WHERE name IN (?) OR code IN (?)', [
      rows.map((r) => r.name),
      rows.map((r) => r.code),
    ]);
    const names = new Set(existing.map((e) => e.name.toLowerCase()));
    const codes = new Set(existing.map((e) => e.code.toUpperCase()));
    for (const r of rows) {
      if (names.has(r.name.toLowerCase())) addRowError(errors, r.line, 'name', 'Organisation name already exists');
      if (codes.has(r.code)) addRowError(errors, r.line, 'code', 'Organisation code already exists');
    }
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    await conn.query(
      'INSERT INTO organisations (name, code, address, contact_email, contact_phone, is_active) VALUES ?',
      [rows.map((r) => [r.name, r.code, r.address, r.contact_email, r.contact_phone ?? null, r.is_active])],
    );
    await logAudit({ userId: user.id, action: 'import', entity: 'organisations', meta: { count: rows.length } }, conn);
  });
  return { imported: rows.length };
}

module.exports = { list, getById, create, update, remove, listAdmins, createAdmin, updateAdmin, importCsv };
