const { z } = require('zod');
const { listQuery, isoDateTime, optionalString } = require('../../utils/schemas');

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'out', 'returned'];
/** Longer absences are leave requests, not outings. */
const MAX_OUTING_HOURS = 24;

const createOutingSchema = z
  .object({
    destination: z.string().trim().min(2, 'Where are you going?').max(150),
    reason: z.string().trim().min(3, 'Give a short reason').max(500),
    outAt: isoDateTime,
    expectedReturnAt: isoDateTime,
  })
  .refine((v) => v.expectedReturnAt > v.outAt, {
    message: 'Return time must be after the time you go out',
    path: ['expectedReturnAt'],
  })
  .refine((v) => Date.parse(`${v.expectedReturnAt}Z`) - Date.parse(`${v.outAt}Z`) <= MAX_OUTING_HOURS * 3600 * 1000, {
    message: `An outing can last at most ${MAX_OUTING_HOURS} hours — apply for leave instead`,
    path: ['expectedReturnAt'],
  });

const reviewOutingSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: optionalString(500),
});

const listOutingsSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum([...STATUSES, 'late']).optional()),
});

module.exports = { createOutingSchema, reviewOutingSchema, listOutingsSchema, MAX_OUTING_HOURS };
