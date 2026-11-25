const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { idParam } = require('../../utils/schemas');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

// Only org_admin (or super_admin in read-only platform view) may manage hostel managers.
router.use(authenticate, authorize('org_admin'));

router.get('/export', validate({ query: v.listManagersSchema }), asyncHandler(controller.exportCsv));
router.get('/', validate({ query: v.listManagersSchema }), asyncHandler(controller.list));
router.post('/', validate({ body: v.createManagerSchema }), asyncHandler(controller.create));
router.get('/:id', validate({ params: idParam }), asyncHandler(controller.getById));
router.patch('/:id', validate({ params: idParam, body: v.updateManagerSchema }), asyncHandler(controller.update));
router.delete('/:id', validate({ params: idParam }), asyncHandler(controller.remove));

module.exports = router;
