const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const { pool } = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const asyncHandler = require('./utils/asyncHandler');

const authRoutes = require('./modules/auth/routes');
const organisationRoutes = require('./modules/organisations/routes');
const hostelRoutes = require('./modules/hostels/routes');
const roomRoutes = require('./modules/rooms/routes');
const wardenRoutes = require('./modules/wardens/routes');
const hostelManagerRoutes = require('./modules/hostel-managers/routes');
const studentRoutes = require('./modules/students/routes');
const allocationRoutes = require('./modules/allocations/routes');
const complaintRoutes = require('./modules/complaints/routes');
const leaveRoutes = require('./modules/leaves/routes');
const noticeRoutes = require('./modules/notices/routes');
const attendanceRoutes = require('./modules/attendance/routes');
const dashboardRoutes = require('./modules/dashboard/routes');
const messRoutes = require('./modules/mess/routes');
const applicationRoutes = require('./modules/applications/routes');
const outingRoutes = require('./modules/outings/routes');

const app = express();

app.disable('x-powered-by');
app.set('etag', false);

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
if (env.NODE_ENV !== 'test') app.use(morgan(env.isDev ? 'dev' : 'combined'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.', details: null } },
});

const api = express.Router();

api.get(
  '/health',
  asyncHandler(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', db: 'up', time: new Date().toISOString() } });
  }),
);

api.use('/auth', authRoutes);
api.use('/organisations', organisationRoutes);
api.use('/hostels', hostelRoutes);
api.use('/rooms', roomRoutes);
api.use('/wardens', wardenRoutes);
api.use('/hostel-managers', hostelManagerRoutes);
api.use('/students', studentRoutes);
api.use('/allocations', allocationRoutes);
api.use('/complaints', complaintRoutes);
api.use('/leaves', leaveRoutes);
api.use('/notices', noticeRoutes);
api.use('/attendance', attendanceRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/mess', messRoutes);
api.use('/applications', applicationRoutes);
api.use('/outings', outingRoutes);

app.use('/api/v1', apiLimiter, api);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
