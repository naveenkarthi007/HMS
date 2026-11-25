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

async function options(req, res) {
  sendData(res, await service.options(req.user));
}

async function create(req, res) {
  sendData(res, await service.create(req.user, req.body), 201);
}

async function cancel(req, res) {
  sendData(res, await service.cancel(req.user, req.params.id));
}

async function review(req, res) {
  sendData(res, await service.review(req.user, req.params.id, req.body));
}

const APPLICATION_COLUMNS = [
  { header: 'id', value: (a) => a.id },
  { header: 'student', value: (a) => a.studentName },
  { header: 'register_no', value: (a) => a.registerNo },
  { header: 'email', value: (a) => a.email },
  { header: 'gender', value: (a) => a.gender },
  { header: 'department', value: (a) => a.department },
  { header: 'year', value: (a) => a.year },
  { header: 'preferred_hostel', value: (a) => a.preferredHostelName },
  { header: 'preferred_room_type', value: (a) => a.preferredRoomType },
  { header: 'student_note', value: (a) => a.studentNote },
  { header: 'status', value: (a) => a.status },
  { header: 'allocated_hostel', value: (a) => a.allocatedHostelName },
  { header: 'allocated_room', value: (a) => a.allocatedRoomNumber },
  { header: 'reviewed_by', value: (a) => a.reviewedByName },
  { header: 'review_note', value: (a) => a.reviewNote },
  { header: 'applied_at', value: (a) => fmt.dateTime(a.createdAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'hostel-applications', APPLICATION_COLUMNS, rows);
}

module.exports = { list, getById, options, create, cancel, review, exportCsv };
