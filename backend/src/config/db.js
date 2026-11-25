const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci',
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  namedPlaceholders: false,
});

// Keep every session in UTC so TIMESTAMP columns round-trip consistently.
pool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (err) => {
    if (err) console.error('[db] could not set session time zone:', err.message);
  });
});

function describeDbError(err) {
  const target = `${env.DB_HOST}:${env.DB_PORT}`;
  switch (err.code) {
    case 'ECONNREFUSED':
    case 'ENOTFOUND':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
      return `Cannot reach MySQL at ${target} (${err.code}). Is the MySQL 8 server running?`;
    case 'ER_ACCESS_DENIED_ERROR':
      return `MySQL rejected the credentials for user "${env.DB_USER}". Check DB_USER / DB_PASSWORD in backend/.env.`;
    case 'ER_BAD_DB_ERROR':
      return `Database "${env.DB_NAME}" does not exist. Run "npm run setup" (or "npm run db:setup --prefix backend").`;
    case 'ER_NO_SUCH_TABLE':
      return `Database "${env.DB_NAME}" has no tables yet. Run "npm run setup" to apply migrations and seeds.`;
    default:
      return `MySQL error (${err.code || 'unknown'}): ${err.message}`;
  }
}

/**
 * Verifies connectivity and that migrations have been applied.
 * Throws an Error with a human readable message on failure.
 */
async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT 1 FROM organisations LIMIT 1');
  } catch (err) {
    const wrapped = new Error(describeDbError(err));
    wrapped.code = err.code;
    throw wrapped;
  }
}

/**
 * Runs `fn` inside a transaction on a dedicated connection.
 */
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, healthCheck, withTransaction, describeDbError };
