const { z } = require('zod');
const { listQuery, id, isoDate, optionalString } = require('../../utils/schemas');

const ROOM_TYPES = ['single', 'double', 'quad'];

const createApplicationSchema = z.object({
  preferredHostelId: z.preprocess((v) => (v === '' || v === undefined ? null : v), id.nullable()),
  preferredRoomType: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.enum(ROOM_TYPES).nullable()),
  studentNote: optionalString(500),
});

const reviewApplicationSchema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('approved'),
    roomId: id,
    startDate: z.preprocess((v) => (v === '' ? undefined : v), isoDate.optional()),
    note: optionalString(500),
  }),
  z.object({
    decision: z.literal('rejected'),
    note: z.string().trim().min(3, 'Give a short reason for the student').max(500),
  }),
]);

const listApplicationsSchema = listQuery.extend({
  status: z.preprocess(
    (v) => (v === '' || v === 'all' ? undefined : v),
    z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  ),
});

module.exports = { createApplicationSchema, reviewApplicationSchema, listApplicationsSchema };
