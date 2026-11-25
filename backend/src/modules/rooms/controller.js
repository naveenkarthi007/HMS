const service = require('./service');
const { sendList, sendData } = require('../../utils/pagination');
const { sendCsv } = require('../../utils/exporter');

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

const ROOM_COLUMNS = [
  { header: 'hostel_code', value: (r) => r.hostelCode },
  { header: 'room_number', value: (r) => r.roomNumber },
  { header: 'floor', value: (r) => r.floor },
  { header: 'capacity', value: (r) => r.capacity },
  { header: 'room_type', value: (r) => r.roomType },
  { header: 'status', value: (r) => r.status },
  { header: 'hostel', value: (r) => r.hostelName },
  { header: 'gender', value: (r) => r.gender },
  { header: 'occupied', value: (r) => r.occupied },
  { header: 'available', value: (r) => r.available },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'rooms', ROOM_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, getById, create, update, remove, exportCsv, importCsv };
