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

async function me(req, res) {
  sendData(res, await service.getOwnProfile(req.user));
}

async function updateMe(req, res) {
  sendData(res, await service.updateOwnProfile(req.user, req.body));
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

async function importCsv(req, res) {
  sendData(res, await service.importCsv(req.user, req.body), 201);
}

const STUDENT_COLUMNS = [
  { header: 'name', value: (s) => s.name },
  { header: 'email', value: (s) => s.email },
  { header: 'gender', value: (s) => s.gender },
  { header: 'register_no', value: (s) => s.registerNo },
  { header: 'department', value: (s) => s.department },
  { header: 'year', value: (s) => s.year },
  { header: 'phone', value: (s) => s.phone },
  { header: 'guardian_name', value: (s) => s.guardianName },
  { header: 'guardian_phone', value: (s) => s.guardianPhone },
  { header: 'address', value: (s) => s.address },
  { header: 'date_of_birth', value: (s) => fmt.date(s.dateOfBirth) },
  { header: 'hostel', value: (s) => s.hostelName },
  { header: 'room_number', value: (s) => s.roomNumber },
  { header: 'allocated_on', value: (s) => fmt.date(s.allocatedOn) },
  { header: 'is_active', value: (s) => fmt.yesNo(s.isActive) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'students', STUDENT_COLUMNS, rows);
}

module.exports = { list, getById, me, updateMe, create, update, remove, importCsv, exportCsv };
