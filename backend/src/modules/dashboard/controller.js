const service = require('./service');
const { sendData } = require('../../utils/pagination');

async function summary(req, res) {
  sendData(res, await service.summary(req.user, req.query));
}

async function platform(req, res) {
  sendData(res, await service.platform());
}

module.exports = { summary, platform };
