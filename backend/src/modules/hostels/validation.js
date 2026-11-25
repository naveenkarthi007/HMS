const { z } = require('zod');
const { listQuery, optionalString, gender, booleanish } = require('../../utils/schemas');
const { enumColumn, optionalText, yesNo } = require('../../utils/importer');

const hostelBody = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Code is required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code may contain letters, digits and dashes only'),
  gender,
  address: optionalString(255),
  isActive: booleanish.optional(),
});

const createHostelSchema = hostelBody;
const updateHostelSchema = hostelBody.partial();

const listHostelsSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(['active', 'inactive']).optional()),
  hasAvailability: z.preprocess((v) => (v === '' ? undefined : v), booleanish.optional()),
});

/** One CSV row: name, code, gender, address, is_active */
const hostelImportRow = z.object({
  name: z.string().trim().min(2, 'name is required').max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'code is required')
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'code may contain letters, digits and dashes only'),
  gender: enumColumn(['male', 'female'], 'gender'),
  address: optionalText(255),
  is_active: yesNo(true),
});

module.exports = { createHostelSchema, updateHostelSchema, listHostelsSchema, hostelImportRow };
