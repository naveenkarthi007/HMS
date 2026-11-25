const { z } = require('zod');
const { listQuery, isoDate, optionalString } = require('../../utils/schemas');

const createLeaveSchema = z
  .object({
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().trim().min(5, 'Please give a reason (at least 5 characters)').max(500),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'To date must be on or after the from date', path: ['toDate'] });

const reviewLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: optionalString(500),
});

const listLeavesSchema = listQuery.extend({
  status: z.preprocess(
    (v) => (v === '' || v === 'all' ? undefined : v),
    z.enum(['pending', 'approved', 'rejected']).optional(),
  ),
});

module.exports = { createLeaveSchema, reviewLeaveSchema, listLeavesSchema };
