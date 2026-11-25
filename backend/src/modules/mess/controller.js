const service = require('./service');
const { sendData } = require('../../utils/pagination');
const { sendCsv, fmt } = require('../../utils/exporter');

async function month(req, res) {
  const result = await service.month(req.user, req.query);
  res.json({
    success: true,
    data: result,
    meta: { page: 1, limit: result.menus.length, total: result.menus.length, totalPages: 1 },
  });
}

async function upsert(req, res) {
  sendData(res, await service.upsert(req.user, req.params, req.body));
}

async function remove(req, res) {
  await service.remove(req.user, req.params);
  sendData(res, { deleted: true });
}

const MESS_COLUMNS = [
  { header: 'hostel_code', value: (m) => m.hostelCode },
  { header: 'date', value: (m) => fmt.date(m.date) },
  { header: 'breakfast', value: (m) => m.breakfast },
  { header: 'lunch', value: (m) => m.lunch },
  { header: 'snacks', value: (m) => m.snacks },
  { header: 'dinner', value: (m) => m.dinner },
  { header: 'notes', value: (m) => m.notes },
];

async function exportCsv(req, res) {
  const result = await service.month(req.user, req.query);
  const code = result.hostel ? result.hostel.code : null;
  const rows = result.menus.map((m) => ({ ...m, hostelCode: code }));
  sendCsv(res, ['mess-menu', code || 'none', result.month].join('-'), MESS_COLUMNS, rows);
}

async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { month, upsert, remove, exportCsv, importCsv };
