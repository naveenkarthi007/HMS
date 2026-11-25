/**
 * Creates the configured database (utf8mb4_unicode_ci) if it does not exist yet.
 * Used by `npm run db:setup` / `npm run db:reset` before running Knex migrations.
 */
const mysql = require('mysql2/promise');
const env = require('../config/env');
const { describeDbError } = require('../config/db');

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
    });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    console.log(`[db] Database "${env.DB_NAME}" is ready.`);
  } catch (err) {
    console.error(`\n[db] ${describeDbError(err)}\n`);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
}

main().then(() => {
  // The shared pool from config/db is never used here; exit explicitly so it does not keep the process alive.
  process.exit(process.exitCode || 0);
});
