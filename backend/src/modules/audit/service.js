const { pool } = require('../../config/db');

/**
 * Writes an audit log row. Pass `conn` to include it in an open transaction.
 * Audit failures are logged but never break the business operation when used outside a transaction.
 */
async function logAudit({ organisationId = null, userId = null, action, entity, entityId = null, meta = null }, conn) {
  const sql =
    'INSERT INTO audit_logs (organisation_id, user_id, action, entity, entity_id, meta) VALUES (?, ?, ?, ?, ?, ?)';
  const params = [organisationId, userId, action, entity, entityId, meta ? JSON.stringify(meta) : null];
  if (conn) {
    await conn.query(sql, params);
    return;
  }
  try {
    await pool.query(sql, params);
  } catch (err) {
    console.error('[audit] failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
