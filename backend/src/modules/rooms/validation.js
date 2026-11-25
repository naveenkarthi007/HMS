const { z } = require('zod');
const { listQuery, id, booleanish } = require('../../utils/schemas');
const { enumColumn } = require('../../utils/importer');

const ROOM_TYPES = ['single', 'double', 'quad'];

const roomBody = z.object({
  hostelId: id,
  roomNumber: z
    .string()
    .trim()
    .min(1, 'Room number is required')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Room number may contain letters, digits and dashes only'),
  floor: z.coerce.number().int().min(-2).max(100),
  capacity: z.coerce
    .number()
    .int()
    .min(1, 'Capacity must be between 1 and 6')
    .max(6, 'Capacity must be between 1 and 6'),
  roomType: z.enum(ROOM_TYPES),
  status: z.enum(['active', 'maintenance']).default('active'),
});

const createRoomSchema = roomBody;
const updateRoomSchema = roomBody
  .omit({ hostelId: true })
  .partial()
  .extend({
    status: z.enum(['active', 'maintenance']).optional(),
  });

const listRoomsSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(['active', 'maintenance']).optional()),
  available: z.preprocess((v) => (v === '' ? undefined : v), booleanish.optional()),
  limit: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).max(200).default(10)),
});

/** One CSV row: hostel_code, room_number, floor, capacity, room_type, status */
const roomImportRow = z.object({
  hostel_code: z.string().trim().toUpperCase().min(1, 'hostel_code is required'),
  room_number: z
    .string()
    .trim()
    .min(1, 'room_number is required')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'room_number may contain letters, digits and dashes only'),
  floor: z.coerce.number({ error: 'floor must be a number' }).int().min(-2).max(100),
  capacity: z.coerce
    .number({ error: 'capacity must be 1-6' })
    .int()
    .min(1, 'capacity must be 1-6')
    .max(6, 'capacity must be 1-6'),
  room_type: enumColumn(ROOM_TYPES, 'room_type'),
  status: z.preprocess(
    (v) => (v === '' || v === undefined ? 'active' : v),
    enumColumn(['active', 'maintenance'], 'status'),
  ),
});

module.exports = { createRoomSchema, updateRoomSchema, listRoomsSchema, ROOM_TYPES, roomImportRow };
