const service = require('./service');
const roomService = require('../rooms/service');
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

async function listRooms(req, res) {
  await service.assertAccessible(req.user, req.params.id);
  const { rows, total, pagination } = await roomService.list(req.user, { ...req.query, hostelId: req.params.id });
  sendList(res, rows, pagination, total);
}

const HOSTEL_COLUMNS = [
  { header: 'name', value: (h) => h.name },
  { header: 'code', value: (h) => h.code },
  { header: 'gender', value: (h) => h.gender },
  { header: 'address', value: (h) => h.address },
  { header: 'is_active', value: (h) => fmt.yesNo(h.isActive) },
  { header: 'rooms', value: (h) => h.roomCount },
  { header: 'beds', value: (h) => h.beds },
  { header: 'occupied', value: (h) => h.occupied },
  { header: 'available', value: (h) => h.available },
  { header: 'wardens', value: (h) => h.wardenNames },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'hostels', HOSTEL_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, getById, create, update, remove, listRooms, exportCsv, importCsv };
