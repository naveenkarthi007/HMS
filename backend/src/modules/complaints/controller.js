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

const COMPLAINT_COLUMNS = [
  { header: 'id', value: (c) => c.id },
  { header: 'raised_at', value: (c) => fmt.dateTime(c.createdAt) },
  { header: 'title', value: (c) => c.title },
  { header: 'category', value: (c) => c.category },
  { header: 'priority', value: (c) => c.priority },
  { header: 'status', value: (c) => c.status },
  { header: 'description', value: (c) => c.description },
  { header: 'student', value: (c) => c.studentName },
  { header: 'register_no', value: (c) => c.registerNo },
  { header: 'gender', value: (c) => c.gender },
  { header: 'hostel', value: (c) => c.hostelName },
  { header: 'room_number', value: (c) => c.roomNumber },
  { header: 'assigned_to', value: (c) => c.assignedToName },
  { header: 'resolved_at', value: (c) => fmt.dateTime(c.resolvedAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'complaints', COMPLAINT_COLUMNS, rows);
}

module.exports = { list, getById, create, update, exportCsv };
