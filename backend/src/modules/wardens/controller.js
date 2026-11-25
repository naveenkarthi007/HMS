const service = require('./service');
const { sendList, sendData } = require('../../utils/pagination');
const { sendCsv, fmt } = require('../../utils/exporter');

async function list(req, res) {
  const { rows, total, pagination } = await service.list(req.user, req.query);
  sendList(res, rows, pagination, total);
}

async function getById(req, res) {
  sendData(res, await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  sendData(res, await service.create(req.user, req.body), 201);
}

async function update(req, res) {
  sendData(res, await service.update(req.user, req.params.id, req.body));
}

async function assignHostels(req, res) {
  sendData(res, await service.assignHostels(req.user, req.params.id, req.body));
}

async function remove(req, res) {
  await service.remove(req.user, req.params.id);
  sendData(res, { deleted: true });
}

const WARDEN_COLUMNS = [
  { header: 'name', value: (w) => w.name },
  { header: 'email', value: (w) => w.email },
  { header: 'gender', value: (w) => w.gender },
  { header: 'phone', value: (w) => w.phone },
  { header: 'hostel_codes', value: (w) => w.hostelCodes },
  { header: 'hostels', value: (w) => w.hostelNames },
  { header: 'assignments', value: (w) => w.assignmentSummary },
  { header: 'is_active', value: (w) => fmt.yesNo(w.isActive) },
  { header: 'last_login', value: (w) => fmt.dateTime(w.lastLoginAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'wardens', WARDEN_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, getById, create, update, assignHostels, remove, exportCsv, importCsv };
