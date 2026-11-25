const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { logAudit } = require('../audit/service');
const { fetchAssignmentsMap, formatAssignmentSummary } = require('../wardens/service');

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function toMysqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function findUserForAuth(where, param) {
  const [rows] = await pool.query(
    `SELECT u.id, u.organisation_id, u.name, u.email, u.password_hash, u.role, u.gender, u.phone, u.is_active,
            u.last_login_at, o.name AS organisation_name, o.code AS organisation_code, o.is_active AS organisation_active,
            s.id AS student_id
       FROM users u
       LEFT JOIN organisations o ON o.id = u.organisation_id
       LEFT JOIN students s ON s.user_id = u.id
      WHERE ${where}
      LIMIT 1`,
    [param],
  );
  return rows[0] || null;
}

function publicUser(row, assignmentSummary = null) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    gender: row.gender,
    phone: row.phone,
    studentId: row.student_id || null,
    assignmentSummary,
    lastLoginAt: row.last_login_at,
    organisation: row.organisation_id
      ? { id: row.organisation_id, name: row.organisation_name, code: row.organisation_code }
      : null,
  };
}

async function buildPublicUser(row) {
  if (row.role !== 'warden') return publicUser(row);
  const map = await fetchAssignmentsMap([row.id]);
  const summary = formatAssignmentSummary(map.get(row.id) || []);
  return publicUser(row, summary || null);
}

function assertCanSignIn(row) {
  if (!row.is_active) throw new AppError(403, 'ACCOUNT_DISABLED', 'Your account has been deactivated');
  if (row.role !== 'super_admin' && !row.organisation_active) {
    throw new AppError(403, 'ORGANISATION_DISABLED', 'Your organisation is currently inactive');
  }
}

function signAccessToken(row) {
  const expiresInSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;
  const token = jwt.sign(
    { sub: String(row.id), role: row.role, org: row.organisation_id, gender: row.gender, name: row.name },
    env.JWT_ACCESS_SECRET,
    { expiresIn: expiresInSeconds },
  );
  return { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
}

async function issueRefreshToken(conn, userId) {
  const expiresInSeconds = env.REFRESH_TOKEN_TTL_DAYS * 86400;
  const token = jwt.sign({ sub: String(userId), jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: expiresInSeconds,
  });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await conn.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    sha256(token),
    toMysqlDate(expiresAt),
  ]);
  return { token, expiresAt };
}

async function login({ email, password }, meta) {
  const row = await findUserForAuth('u.email = ?', email);
  const valid = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  assertCanSignIn(row);

  const refresh = await withTransaction(async (conn) => {
    await conn.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    // Housekeeping: drop this user's expired tokens.
    await conn.query('DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < CURRENT_TIMESTAMP', [row.id]);
    return issueRefreshToken(conn, row.id);
  });

  await logAudit({
    organisationId: row.organisation_id,
    userId: row.id,
    action: 'login',
    entity: 'users',
    entityId: row.id,
    meta: { ip: meta.ip },
  });

  return { user: await buildPublicUser(row), access: signAccessToken(row), refresh };
}

async function refresh(rawToken) {
  if (!rawToken) throw new AppError(401, 'NO_REFRESH_TOKEN', 'Session expired, please sign in again');

  try {
    jwt.verify(rawToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please sign in again');
  }

  const tokenHash = sha256(rawToken);

  return withTransaction(async (conn) => {
    const [rows] = await conn.query(
      'SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? FOR UPDATE',
      [tokenHash],
    );
    const stored = rows[0];
    if (!stored) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please sign in again');

    if (stored.revoked_at) {
      // Reuse of a rotated token: revoke every session of this user.
      await conn.query(
        'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
        [stored.user_id],
      );
      throw new AppError(401, 'REFRESH_TOKEN_REUSED', 'Session expired, please sign in again');
    }
    if (new Date(stored.expires_at).getTime() < Date.now()) {
      throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Session expired, please sign in again');
    }

    const user = await findUserForAuth('u.id = ?', stored.user_id);
    if (!user) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired, please sign in again');
    assertCanSignIn(user);

    await conn.query('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [stored.id]);
    const next = await issueRefreshToken(conn, user.id);
    return { user: await buildPublicUser(user), access: signAccessToken(user), refresh: next };
  });
}

async function logout(rawToken) {
  if (!rawToken) return;
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL',
    [sha256(rawToken)],
  );
}

async function me(userId) {
  const row = await findUserForAuth('u.id = ?', userId);
  if (!row) throw AppError.unauthorized('Account no longer exists');
  assertCanSignIn(row);
  return buildPublicUser(row);
}

async function changePassword(user, { currentPassword, newPassword }) {
  const row = await findUserForAuth('u.id = ?', user.id);
  if (!row) throw AppError.unauthorized();
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', {
      currentPassword: 'Current password is incorrect',
    });
  }
  const hash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'change_password',
    entity: 'users',
    entityId: user.id,
  });
}

module.exports = { login, refresh, logout, me, changePassword };
