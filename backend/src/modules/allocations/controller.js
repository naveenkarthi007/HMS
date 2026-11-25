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

async function vacate(req, res) {
  sendData(res, await service.vacate(req.user, req.params.id, req.body));
}

const ALLOCATION_COLUMNS = [
  { header: 'register_no', value: (a) => a.registerNo },
  { header: 'hostel_code', value: (a) => a.hostelCode },
  { header: 'room_number', value: (a) => a.roomNumber },
  { header: 'start_date', value: (a) => fmt.date(a.startDate) },
  { header: 'student', value: (a) => a.studentName },
  { header: 'gender', value: (a) => a.gender },
  { header: 'hostel', value: (a) => a.hostelName },
  { header: 'end_date', value: (a) => fmt.date(a.endDate) },
  { header: 'status', value: (a) => a.status },
  { header: 'allocated_by', value: (a) => a.allocatedByName },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'allocations', ALLOCATION_COLUMNS, rows);
}
async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

module.exports = { list, getById, create, vacate, exportCsv, importCsv };
