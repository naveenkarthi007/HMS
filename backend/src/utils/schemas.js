const { z } = require('zod');

/** Treats '' / null as "not provided" so optional query params can be sent empty. */
const emptyToUndefined = (schema) =>
  z.preprocess((v) => (v === '' || v === null || v === 'all' ? undefined : v), schema);

const optionalString = (max = 255) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

const id = z.coerce.number().int().positive();

const idParam = z.object({ id });

const gender = z.enum(['male', 'female']);

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  // Round-trip check so impossible dates like 2030-02-30 (which JS rolls over to March) are rejected.
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid date');

/** An ISO-8601 date-time (e.g. from `new Date().toISOString()`), output as a MySQL UTC DATETIME string. */
const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, 'Use an ISO date-time with a timezone')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date-time')
  .transform((v) => new Date(v).toISOString().slice(0, 19).replace('T', ' '));

const phone = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z
    .string()
    .trim()
    .regex(/^[+0-9 ()-]{7,20}$/, 'Enter a valid phone number')
    .nullable()
    .optional(),
);

/** Base list query: ?page=&limit=&search=&gender=&hostelId=&status=&sort= */
const listQuery = z.object({
  page: emptyToUndefined(z.coerce.number().int().min(1).default(1)),
  limit: emptyToUndefined(z.coerce.number().int().min(1).max(100).default(10)),
  search: emptyToUndefined(z.string().trim().max(100).optional()),
  gender: emptyToUndefined(gender.optional()),
  hostelId: emptyToUndefined(id.optional()),
  status: emptyToUndefined(z.string().trim().max(30).optional()),
  sort: emptyToUndefined(
    z
      .string()
      .regex(/^-?[a-zA-Z_]+$/)
      .optional(),
  ),
});

const booleanish = z.preprocess((v) => {
  if (v === 'true' || v === '1' || v === 1) return true;
  if (v === 'false' || v === '0' || v === 0) return false;
  return v;
}, z.boolean());

module.exports = {
  emptyToUndefined,
  optionalString,
  id,
  idParam,
  gender,
  isoDate,
  isoDateTime,
  phone,
  listQuery,
  booleanish,
};
