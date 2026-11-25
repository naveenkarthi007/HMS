/**
 * CSV import helpers shared by every module's `POST /<resource>/import` route.
 * Flow: parse → validate every row → check against the database → insert all rows in one
 * transaction. If any row has a problem nothing is saved and the API returns 400 with
 * `details.rows = [{ line, errors: { column: message } }]`.
 */
const { z } = require('zod');
const AppError = require('./AppError');
const { parseCsv } = require('./csv');
const { formatZodError } = require('../middleware/validate');

const MAX_IMPORT_ROWS = 1000;

const importBodySchema = z.object({
  csv: z.string().min(1, 'CSV content is required').max(1_500_000, 'CSV file is too large'),
});

/** Optional yes/no column (yes, y, true, 1, active / no, n, false, 0, inactive). */
const yesNo = (fallback = true) =>
  z.preprocess(
    (v) => {
      if (v === undefined || v === null || String(v).trim() === '') return fallback;
      const s = String(v).trim().toLowerCase();
      if (['yes', 'y', 'true', '1', 'active'].includes(s)) return true;
      if (['no', 'n', 'false', '0', 'inactive'].includes(s)) return false;
      return s;
    },
    z.boolean({ error: 'Use yes or no' }),
  );

/** Case-insensitive enum column. */
const enumColumn = (values, label) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.enum(values, { error: `${label} must be one of: ${values.join(', ')}` }),
  );

/** Optional text column: missing column or '' → null. */
const optionalText = (max = 255) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().trim().max(max).nullable(),
  );

/**
 * Our exports prefix cells that start with = + - @ with an apostrophe (formula-injection guard).
 * Strip it again so an exported file can be imported back unchanged.
 */
const unguard = (value) => (typeof value === 'string' && /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

/**
 * Parses and validates the CSV. Returns { rows: [{ line, ...data }], errors: [] }.
 * Throws 400 straight away for structural problems (missing columns, no rows, too many rows).
 */
function parseImport(csv, { required, rowSchema }) {
  const { headers, records } = parseCsv(csv);
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    throw new AppError(400, 'IMPORT_INVALID_FILE', `CSV is missing required columns: ${missing.join(', ')}`, {
      csv: `Required columns: ${required.join(', ')}`,
    });
  }
  if (!records.length)
    throw new AppError(400, 'IMPORT_INVALID_FILE', 'CSV has no data rows', { csv: 'No data rows found' });
  if (records.length > MAX_IMPORT_ROWS) {
    throw new AppError(400, 'IMPORT_INVALID_FILE', `A single import is limited to ${MAX_IMPORT_ROWS} rows`, {
      csv: 'Too many rows',
    });
  }

  const rows = [];
  const errors = [];
  records.forEach((record, index) => {
    const line = index + 2; // header is line 1
    const cleaned = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, unguard(value)]));
    const result = rowSchema.safeParse(cleaned);
    if (result.success) rows.push({ line, ...result.data });
    else errors.push({ line, errors: formatZodError(result.error) });
  });
  return { rows, errors };
}

/** Records a problem for one line (merging with problems already found on that line). */
function addRowError(errors, line, field, message) {
  const existing = errors.find((e) => e.line === line);
  if (existing) {
    if (!existing.errors[field]) existing.errors[field] = message;
  } else {
    errors.push({ line, errors: { [field]: message } });
  }
}

/** Flags rows whose `keyFn` value already appeared on an earlier line of the same file. */
function checkDuplicates(rows, errors, field, keyFn) {
  const seen = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key === null || key === undefined || key === '') continue;
    if (seen.has(key)) addRowError(errors, row.line, field, `Duplicate of line ${seen.get(key)}`);
    else seen.set(key, row.line);
  }
}

function failIfErrors(errors) {
  if (!errors.length) return;
  errors.sort((a, b) => a.line - b.line);
  throw new AppError(400, 'IMPORT_VALIDATION_FAILED', `${errors.length} row(s) have errors. Nothing was imported.`, {
    rows: errors.slice(0, 200),
  });
}

module.exports = {
  MAX_IMPORT_ROWS,
  importBodySchema,
  yesNo,
  enumColumn,
  optionalText,
  parseImport,
  addRowError,
  checkDuplicates,
  failIfErrors,
  unguard,
};
