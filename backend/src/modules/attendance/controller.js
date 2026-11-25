const service = require('./service');
const { buildMeta, sendData } = require('../../utils/pagination');
const { sendCsv, fmt } = require('../../utils/exporter');

async function list(req, res) {
  const { rows, total, pagination, summary } = await service.list(req.user, req.query);
  res.json({ success: true, data: rows, meta: { ...buildMeta(pagination, total), summary } });
}

async function sheet(req, res) {
  const result = await service.sheet(req.user, req.query);
  res.json({
    success: true,
    data: result,
    meta: { page: 1, limit: result.rows.length, total: result.rows.length, totalPages: 1 },
  });
}

async function mark(req, res) {
  sendData(res, await service.mark(req.user, req.body), 201);
}

const ATTENDANCE_COLUMNS = [
  { header: 'register_no', value: (a) => a.registerNo },
  { header: 'date', value: (a) => fmt.date(a.date) },
  { header: 'status', value: (a) => a.status },
  { header: 'student', value: (a) => a.studentName },
  { header: 'gender', value: (a) => a.gender },
  { header: 'hostel', value: (a) => a.hostelName },
  { header: 'marked_by', value: (a) => a.markedByName },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'attendance', ATTENDANCE_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, sheet, mark, exportCsv, importCsv };
