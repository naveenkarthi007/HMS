const { z } = require('zod');
const { listQuery, optionalString, phone, id, gender, booleanish } = require('../../utils/schemas');
const { password } = require('../auth/validation');
const { optionalText, yesNo } = require('../../utils/importer');

const organisationBody = z.object({
  name: z.string().trim().min(2, 'Name is required').max(150),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Code must be 2-20 characters')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code may contain letters, digits and dashes only'),
  address: optionalString(255),
  contactEmail: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().toLowerCase().email('Enter a valid email').max(150).nullable().optional(),
  ),
  contactPhone: phone,
  isActive: booleanish.optional(),
});

const createOrganisationSchema = organisationBody;
const updateOrganisationSchema = organisationBody.partial();

const listOrganisationsSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(['active', 'inactive']).optional()),
});

const adminParams = z.object({ id, adminId: id });

const createAdminSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
  password,
  gender: gender.nullable().optional(),
  phone,
});

const updateAdminSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone,
  isActive: booleanish.optional(),
  password: password.optional(),
});

/** One CSV row: name, code, address, contact_email, contact_phone, is_active */
const organisationImportRow = z.object({
  name: z.string().trim().min(2, 'name is required').max(150),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'code must be 2-20 characters')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'code may contain letters, digits and dashes only'),
  address: optionalText(255),
  contact_email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().toLowerCase().email('contact_email is invalid').max(150).nullable(),
  ),
  contact_phone: phone,
  is_active: yesNo(true),
});

module.exports = {
  createOrganisationSchema,
  updateOrganisationSchema,
  listOrganisationsSchema,
  adminParams,
  createAdminSchema,
  updateAdminSchema,
  organisationImportRow,
};
