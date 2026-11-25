#!/bin/sh
set -e

echo "[backend] Checking database connection..."
until node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
}).then(c => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" > /dev/null 2>&1; do
  echo "[backend] Waiting for MySQL database '${DB_NAME}' to be ready..."
  sleep 2
done

echo "[backend] Database connected. Running migrations..."
npm run migrate

if [ "$SEED_DB" = "true" ]; then
  echo "[backend] SEED_DB=true: Populating demo/initial seed data..."
  npm run seed || echo "[backend] Seeding skipped or already populated."
fi

echo "[backend] Starting API server on port ${PORT:-5000}..."
exec "$@"
