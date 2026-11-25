const { z } = require('zod');
const { listQuery, id, isoDate } = require('../../utils/schemas');

const createAllocationSchema = z.object({
  studentId: id,
  roomId: id,
  startDate: z.preprocess((v) => (v === '' ? undefined : v), isoDate.optional()),
});

const vacateSchema = z.object({
  endDate: z.preprocess((v) => (v === '' ? undefined : v), isoDate.optional()),
});

const listAllocationsSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(['active', 'vacated']).optional()),
});

/** One CSV row: register_no, hostel_code, room_number, start_date */
const allocationImportRow = z.object({
  register_no: z.string().trim().toUpperCase().min(1, 'register_no is required').max(30),
  hostel_code: z.string().trim().toUpperCase().min(1, 'hostel_code is required').max(20),
  room_number: z.string().trim().min(1, 'room_number is required').max(20),
  start_date: z.preprocess((v) => (v === '' || v === undefined ? null : v), isoDate.nullable()),
});

module.exports = { createAllocationSchema, vacateSchema, listAllocationsSchema, allocationImportRow };
