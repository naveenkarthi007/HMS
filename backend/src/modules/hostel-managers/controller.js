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

async function remove(req, res) {
  await service.remove(req.user, req.params.id);
  sendData(res, { deleted: true });
}

const MANAGER_COLUMNS = [
  { header: 'name', value: (m) => m.name },
  { header: 'email', value: (m) => m.email },
  { header: 'role', value: (m) => m.role },
  { header: 'gender', value: (m) => m.gender },
  { header: 'phone', value: (m) => m.phone },
  { header: 'is_active', value: (m) => fmt.yesNo(m.isActive) },
  { header: 'last_login', value: (m) => fmt.dateTime(m.lastLoginAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'hostel-managers', MANAGER_COLUMNS, rows);
}

module.exports = { list, getById, create, update, remove, exportCsv };
