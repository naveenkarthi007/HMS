const { z } = require('zod');
const { listQuery, id } = require('../../utils/schemas');

const CATEGORIES = ['electrical', 'plumbing', 'cleaning', 'furniture', 'internet', 'mess', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const createComplaintSchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  description: z.string().trim().min(10, 'Please describe the issue (at least 10 characters)').max(2000),
  priority: z.enum(PRIORITIES).default('medium'),
});

const updateComplaintSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedTo: z.preprocess((v) => (v === '' ? null : v), id.nullable().optional()),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update' });

const optionalEnum = (values) =>
  z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(values).optional());

const listComplaintsSchema = listQuery.extend({
  status: optionalEnum(STATUSES),
  category: optionalEnum(CATEGORIES),
  priority: optionalEnum(PRIORITIES),
});

module.exports = {
  createComplaintSchema,
  updateComplaintSchema,
  listComplaintsSchema,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
};
