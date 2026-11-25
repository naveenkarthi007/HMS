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

async function checkOut(req, res) {
  sendData(res, await service.checkOut(req.user, req.params.id));
}

async function checkIn(req, res) {
  sendData(res, await service.checkIn(req.user, req.params.id));
}

async function cancel(req, res) {
  sendData(res, await service.cancel(req.user, req.params.id));
}

const OUTING_COLUMNS = [
  { header: 'id', value: (o) => o.id },
  { header: 'student', value: (o) => o.studentName },
  { header: 'register_no', value: (o) => o.registerNo },
  { header: 'gender', value: (o) => o.gender },
  { header: 'hostel', value: (o) => o.hostelName },
  { header: 'room_number', value: (o) => o.roomNumber },
  { header: 'destination', value: (o) => o.destination },
  { header: 'reason', value: (o) => o.reason },
  { header: 'out_at', value: (o) => fmt.dateTime(o.outAt) },
  { header: 'due_back', value: (o) => fmt.dateTime(o.expectedReturnAt) },
  { header: 'left_at', value: (o) => fmt.dateTime(o.checkedOutAt) },
  { header: 'returned_at', value: (o) => fmt.dateTime(o.returnedAt) },
  { header: 'status', value: (o) => o.status },
  { header: 'late', value: (o) => fmt.yesNo(o.isLate) },
  { header: 'reviewed_by', value: (o) => o.reviewedByName },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'outings', OUTING_COLUMNS, rows);
}

module.exports = { list, getById, create, review, checkOut, checkIn, cancel, exportCsv };
