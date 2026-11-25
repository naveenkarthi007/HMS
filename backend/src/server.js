const env = require('./config/env');
const { pool, healthCheck } = require('./config/db');
const app = require('./app');

async function start() {
  try {
    await healthCheck();
  } catch (err) {
    console.error(`\n[startup] ${err.message}\n`);
    await pool.end().catch(() => {});
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[api] Hostel Management API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[startup] Port ${env.PORT} is already in use. Stop the other process or change PORT in backend/.env.\n`,
      );
    } else {
      console.error('[startup] Server error:', err.message);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  console.error('[api] Unhandled promise rejection:', reason);
});

start();
