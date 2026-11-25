/**
 * CSV export helpers shared by every module's `GET /<resource>/export` route.
 */

/**
 * Escapes one cell. Values that a spreadsheet would run as a formula (=, +, -, @, tab, CR)
 * are prefixed with an apostrophe to prevent CSV/formula injection.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {Array<{ header: string, value: (row: any) => unknown }>} columns
 * @param {Array<any>} rows
 */
function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

const BOM = String.fromCharCode(0xfeff);

/** Sends a CSV download; the UTF-8 BOM makes Excel read non-ASCII names correctly. */
function sendCsv(res, name, columns, rows) {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${name}-${stamp}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('X-Row-Count', String(rows.length));
  res.send(BOM + toCsv(columns, rows));
}

// Small formatting helpers for export columns.
const fmt = {
  date: (v) => (v ? String(v).slice(0, 10) : ''),
  dateTime: (v) => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
  },
  yesNo: (v) => (v ? 'yes' : 'no'),
};

module.exports = { csvCell, toCsv, sendCsv, fmt };
