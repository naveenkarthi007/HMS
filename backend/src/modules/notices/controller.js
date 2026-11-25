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

const NOTICE_COLUMNS = [
  { header: 'id', value: (n) => n.id },
  { header: 'title', value: (n) => n.title },
  { header: 'category', value: (n) => n.category },
  { header: 'send_to', value: (n) => n.targetType },
  { header: 'hostel', value: (n) => n.hostelName },
  { header: 'floors_or_years', value: (n) => n.targetValues.join(';') },
  { header: 'gender', value: (n) => n.audienceGender },
  { header: 'pinned', value: (n) => fmt.yesNo(n.isPinned) },
  { header: 'starts_at', value: (n) => fmt.dateTime(n.startsAt) },
  { header: 'expires_at', value: (n) => fmt.dateTime(n.expiresAt) },
  { header: 'message', value: (n) => n.body },
  { header: 'posted_by', value: (n) => n.publishedByName },
  { header: 'posted_at', value: (n) => fmt.dateTime(n.createdAt) },
];

async function exportCsv(req, res) {
  const { rows } = await service.list(req.user, { ...req.query, exportAll: true });
  sendCsv(res, 'notices', NOTICE_COLUMNS, rows);
}

module.exports = { list, getById, create, update, remove, exportCsv };
