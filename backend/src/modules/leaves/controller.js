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

async function review(req, res) {
  sendData(res, await service.review(req.user, req.params.id, req.body));
}

async function cancel(req, res) {
  await service.cancel(req.user, req.params.id);
  sendData(res, { deleted: true });
}

const LEAVE_COLUMNS = [
  { header: 'id', value: (l) => l.id },
  { header: 'student', value: (l) => l.studentName },
  { header: 'register_no', value: (l) => l.registerNo },
  { header: 'gender', value: (l) => l.gender },
  { header: 'hostel', value: (l) => l.hostelName },
  { header: 'room_number', value: (l) => l.roomNumber },
  { header: 'from_date', value: (l) => fmt.date(l.fromDate) },
  { header: 'to_date', value: (l) => fmt.date(l.toDate) },
  { header: 'days', value: (l) => l.days },
  { header: 'reason', value: (l) => l.reason },
  { header: 'status', value: (l) => l.status },
  { header: 'reviewed_by', value: (l) => l.reviewedByName },
  { header: 'review_note', value: (l) => l.reviewNote },
  { header: 'applied_at', value: (l) => fmt.dateTime(l.createdAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'leaves', LEAVE_COLUMNS, rows);
}

module.exports = { list, getById, create, review, cancel, exportCsv };
