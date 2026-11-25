const { pool, withTransaction } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { parseImport, addRowError, checkDuplicates, failIfErrors } = require('../../utils/importer');
const { logAudit } = require('../audit/service');
const { assertAccessible, hostelScope } = require('../hostels/service');
const { messImportRow } = require('./validation');

function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** The hostel a student currently lives in (from the active allocation), or null. */
async function studentHostel(user) {
  const [rows] = await pool.query(
    `SELECT h.id, h.name, h.code, h.gender
       FROM students s
       JOIN allocations a ON a.student_id = s.id AND a.status = 'active'
       JOIN rooms r ON r.id = a.room_id
       JOIN hostels h ON h.id = r.hostel_id
      WHERE s.user_id = ? AND s.organisation_id = ?`,
    [user.id, user.organisationId],
  );
  return rows[0] || null;
}

async function month(user, { month: monthValue, hostelId }) {
  let hostel;
  if (user.role === 'student') {
    hostel = await studentHostel(user);
    if (!hostel) return { hostel: null, month: monthValue, menus: [] };
  } else {
    if (!hostelId) throw AppError.badRequest('Select a hostel', { hostelId: 'Select a hostel' });
    await assertAccessible(user, hostelId);
    const [rows] = await pool.query('SELECT id, name, code, gender FROM hostels WHERE id = ?', [hostelId]);
    hostel = rows[0];
  }

  const { from, to } = monthRange(monthValue);
  const [menus] = await pool.query(
    `SELECT m.id, m.date, m.breakfast, m.lunch, m.snacks, m.dinner, m.notes, m.updated_at AS updatedAt,
            u.name AS updatedByName
       FROM mess_menus m
       LEFT JOIN users u ON u.id = m.updated_by
      WHERE m.hostel_id = ? AND m.date BETWEEN ? AND ?
      ORDER BY m.date`,
    [hostel.id, from, to],
  );
  return { hostel, month: monthValue, menus };
}

async function upsert(user, { hostelId, date }, body) {
  await assertAccessible(user, hostelId);
  const values = [
    body.breakfast ?? null,
    body.lunch ?? null,
    body.snacks ?? null,
    body.dinner ?? null,
    body.notes ?? null,
  ];
  await pool.query(
    `INSERT INTO mess_menus (hostel_id, date, breakfast, lunch, snacks, dinner, notes, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) AS incoming
     ON DUPLICATE KEY UPDATE breakfast = incoming.breakfast, lunch = incoming.lunch, snacks = incoming.snacks,
                             dinner = incoming.dinner, notes = incoming.notes, updated_by = incoming.updated_by`,
    [hostelId, date, ...values, user.id],
  );
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'upsert',
    entity: 'mess_menus',
    entityId: hostelId,
    meta: { date },
  });
  const [rows] = await pool.query(
    `SELECT m.id, m.date, m.breakfast, m.lunch, m.snacks, m.dinner, m.notes, m.updated_at AS updatedAt,
            u.name AS updatedByName
       FROM mess_menus m LEFT JOIN users u ON u.id = m.updated_by
      WHERE m.hostel_id = ? AND m.date = ?`,
    [hostelId, date],
  );
  return rows[0];
}

async function remove(user, { hostelId, date }) {
  await assertAccessible(user, hostelId);
  const [result] = await pool.query('DELETE FROM mess_menus WHERE hostel_id = ? AND date = ?', [hostelId, date]);
  if (!result.affectedRows) throw AppError.notFound('No menu for this day');
  await logAudit({
    organisationId: user.organisationId,
    userId: user.id,
    action: 'delete',
    entity: 'mess_menus',
    entityId: hostelId,
    meta: { date },
  });
}

/**
 * CSV import: hostel_code, date, breakfast, lunch, snacks, dinner, notes.
 * Creates or replaces each day's menu. Wardens may only import for their own hostels.
 */
async function importCsv(user, { csv }) {
  const { rows, errors } = parseImport(csv, { required: ['hostel_code', 'date'], rowSchema: messImportRow });
  checkDuplicates(rows, errors, 'date', (r) => `${r.hostel_code}|${r.date}`);

  const scope = hostelScope(user);
  const [hostels] = await pool.query(`SELECT h.id, h.code FROM hostels h WHERE ${scope.sql}`, scope.params);
  const hostelByCode = new Map(hostels.map((h) => [h.code.toUpperCase(), h.id]));
  for (const r of rows) {
    r.hostelId = hostelByCode.get(r.hostel_code);
    if (!r.hostelId) addRowError(errors, r.line, 'hostel_code', `No hostel with code ${r.hostel_code} that you manage`);
  }
  failIfErrors(errors);

  await withTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO mess_menus (hostel_id, date, breakfast, lunch, snacks, dinner, notes, updated_by)
       VALUES ? AS incoming
       ON DUPLICATE KEY UPDATE breakfast = incoming.breakfast, lunch = incoming.lunch, snacks = incoming.snacks,
                               dinner = incoming.dinner, notes = incoming.notes, updated_by = incoming.updated_by`,
      [rows.map((r) => [r.hostelId, r.date, r.breakfast, r.lunch, r.snacks, r.dinner, r.notes, user.id])],
    );
    await logAudit(
      {
        organisationId: user.organisationId,
        userId: user.id,
        action: 'import',
        entity: 'mess_menus',
        meta: { count: rows.length },
      },
      conn,
    );
  });
  return { imported: rows.length };
}

module.exports = { month, upsert, remove, importCsv };
