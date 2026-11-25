const path = require('path');
const env = require('./src/config/env');

const base = {
  client: 'mysql2',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: ['DATE'],
    multipleStatements: false,
  },
  pool: {
    min: 0,
    max: 5,
    afterCreate(conn, done) {
      conn.query("SET time_zone = '+00:00'", (err) => done(err, conn));
    },
  },
  migrations: {
    directory: path.join(__dirname, 'src/db/migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'src/db/seeds'),
  },
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
