const { z } = require('zod');
const { listQuery, id, isoDate, emptyToUndefined } = require('../../utils/schemas');

const STATUSES = ['present', 'absent', 'on_leave'];

const sheetQuerySchema = z.object({
  hostelId: id,
  date: isoDate,
  search: emptyToUndefined(z.string().trim().max(100).optional()),
});

const markAttendanceSchema = z.object({
  hostelId: id,
  date: isoDate,
  records: z
    .array(z.object({ studentId: id, status: z.enum(STATUSES) }))
    .min(1, 'Mark at least one student')
    .max(500),
});

const listAttendanceSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(STATUSES).optional()),
  date: emptyToUndefined(isoDate.optional()),
  fromDate: emptyToUndefined(isoDate.optional()),
  toDate: emptyToUndefined(isoDate.optional()),
});

/** One CSV row: register_no, date, status */
const attendanceImportRow = z.object({
  register_no: z.string().trim().toUpperCase().min(1, 'register_no is required').max(30),
  date: isoDate,
  status: z.preprocess(
    (v) =>
      typeof v === 'string'
        ? v
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_')
        : v,
    z.enum(STATUSES, { error: 'status must be present, absent or on_leave' }),
  ),
});

module.exports = { sheetQuerySchema, markAttendanceSchema, listAttendanceSchema, STATUSES, attendanceImportRow };
