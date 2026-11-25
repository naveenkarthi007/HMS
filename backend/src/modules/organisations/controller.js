const service = require('./service');
const { sendList, sendData } = require('../../utils/pagination');
const { sendCsv, fmt } = require('../../utils/exporter');

async function list(req, res) {
  const { rows, total, pagination } = await service.list(req.query);
  sendList(res, rows, pagination, total);
}

async function getById(req, res) {
  sendData(res, await service.getById(req.params.id));
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

async function listAdmins(req, res) {
  sendData(res, await service.listAdmins(req.params.id));
}

async function createAdmin(req, res) {
  sendData(res, await service.createAdmin(req.user, req.params.id, req.body), 201);
}

async function updateAdmin(req, res) {
  sendData(res, await service.updateAdmin(req.user, req.params.id, req.params.adminId, req.body));
}

const ORGANISATION_COLUMNS = [
  { header: 'name', value: (o) => o.name },
  { header: 'code', value: (o) => o.code },
  { header: 'address', value: (o) => o.address },
  { header: 'contact_email', value: (o) => o.contactEmail },
  { header: 'contact_phone', value: (o) => o.contactPhone },
  { header: 'is_active', value: (o) => fmt.yesNo(o.isActive) },
  { header: 'hostels', value: (o) => o.hostelCount },
  { header: 'students', value: (o) => o.studentCount },
  { header: 'admins', value: (o) => o.adminCount },
];

async function exportCsv(req, res) {
  const { rows } = await service.list({ ...req.query, exportAll: true });
  sendCsv(res, 'organisations', ORGANISATION_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, getById, create, update, remove, listAdmins, createAdmin, updateAdmin, exportCsv, importCsv };
