const { z } = require('zod');
const { emptyToUndefined, listQuery, phone, booleanish } = require('../../utils/schemas');
const { password } = require('../auth/validation');

const managerRole = z.enum(['boys_hostel_manager', 'girls_hostel_manager']);

const createManagerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
  password,
  role: managerRole,
  phone,
});

const updateManagerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120).optional(),
  role: managerRole.optional(),
  phone,
  isActive: booleanish.optional(),
  password: z.preprocess((v) => (v === '' ? undefined : v), password.optional()),
});

const listManagersSchema = listQuery.extend({
  role: emptyToUndefined(managerRole.optional()),
  status: emptyToUndefined(z.enum(['active', 'inactive']).optional()),
});

module.exports = {
  managerRole,
  createManagerSchema,
  updateManagerSchema,
  listManagersSchema,
};
