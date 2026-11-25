const { z } = require('zod');
const { listQuery, optionalString, phone, gender, isoDate } = require('../../utils/schemas');
const { password } = require('../auth/validation');

const registerNo = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'Register number is required')
  .max(30)
  .regex(/^[A-Z0-9/-]+$/, 'Register number may contain letters, digits, "/" and "-" only');

const optionalDate = z.preprocess((v) => (v === '' ? null : v), isoDate.nullable().optional());

const profileFields = {
  guardianName: optionalString(120),
  guardianPhone: phone,
  address: optionalString(255),
};

const createStudentSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
  password,
  gender,
  phone,
  registerNo,
  department: z.string().trim().min(2, 'Department is required').max(100),
  year: z.coerce.number().int().min(1, 'Year must be between 1 and 5').max(5, 'Year must be between 1 and 5'),
  dateOfBirth: optionalDate,
  ...profileFields,
});

const updateStudentSchema = createStudentSchema
  .omit({ password: true, gender: true })
  .partial()
  .extend({
    gender: gender.optional(),
    isActive: z.boolean().optional(),
    password: z.preprocess((v) => (v === '' ? undefined : v), password.optional()),
  });

const updateOwnProfileSchema = z.object({
  phone,
  ...profileFields,
});

const listStudentsSchema = listQuery.extend({
  status: z.preprocess(
    (v) => (v === '' || v === 'all' ? undefined : v),
    z.enum(['allocated', 'unallocated', 'inactive']).optional(),
  ),
  department: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(100).optional()),
});

const importSchema = z.object({
  csv: z.string().min(1, 'CSV content is required').max(1_500_000, 'CSV file is too large'),
  defaultPassword: password,
});

/** One CSV row, keyed by snake_case headers. */
const importRowSchema = z.object({
  name: z.string().trim().min(2, 'name is required').max(120),
  email: z.string().trim().toLowerCase().email('email is invalid').max(150),
  gender: z.string().trim().toLowerCase().pipe(gender),
  register_no: registerNo,
  department: z.string().trim().min(2, 'department is required').max(100),
  year: z.coerce.number().int().min(1, 'year must be 1-5').max(5, 'year must be 1-5'),
  phone,
  guardian_name: optionalString(120),
  guardian_phone: phone,
  address: optionalString(255),
  date_of_birth: optionalDate,
});

module.exports = {
  createStudentSchema,
  updateStudentSchema,
  updateOwnProfileSchema,
  listStudentsSchema,
  importSchema,
  importRowSchema,
};
