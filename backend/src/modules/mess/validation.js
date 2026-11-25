const { z } = require('zod');
const { id, isoDate, optionalString } = require('../../utils/schemas');
const { optionalText } = require('../../utils/importer');

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM'),
  hostelId: z.preprocess((v) => (v === '' ? undefined : v), id.optional()),
});

const dayParams = z.object({ hostelId: id, date: isoDate });

const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];

const upsertMenuSchema = z
  .object({
    breakfast: optionalString(500),
    lunch: optionalString(500),
    snacks: optionalString(500),
    dinner: optionalString(500),
    notes: optionalString(500),
  })
  .refine((v) => MEALS.some((meal) => v[meal]), { message: 'Enter at least one meal', path: ['breakfast'] });

/** One CSV row: hostel_code, date, breakfast, lunch, snacks, dinner, notes */
const messImportRow = z
  .object({
    hostel_code: z.string().trim().toUpperCase().min(1, 'hostel_code is required').max(20),
    date: isoDate,
    breakfast: optionalText(500),
    lunch: optionalText(500),
    snacks: optionalText(500),
    dinner: optionalText(500),
    notes: optionalText(500),
  })
  .refine((v) => MEALS.some((meal) => v[meal]), { message: 'Enter at least one meal', path: ['breakfast'] });

const exportMonthSchema = monthQuerySchema;

module.exports = { monthQuerySchema, dayParams, upsertMenuSchema, MEALS, messImportRow, exportMonthSchema };
