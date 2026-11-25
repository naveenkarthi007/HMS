const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { STAFF_ROLES } = require('../../utils/roles');
const { idParam } = require('../../utils/schemas');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

router.use(authenticate);

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get(
  '/export',
  authorize(...STAFF_ROLES, 'student'),
  validate({ query: v.listComplaintsSchema }),
  asyncHandler(controller.exportCsv),
);

router.get(
  '/',
  authorize(...STAFF_ROLES, 'student'),
  validate({ query: v.listComplaintsSchema }),
  asyncHandler(controller.list),
);
router.post('/', authorize('student'), validate({ body: v.createComplaintSchema }), asyncHandler(controller.create));
router.get(
  '/:id',
  authorize(...STAFF_ROLES, 'student'),
  validate({ params: idParam }),
  asyncHandler(controller.getById),
);
router.patch(
  '/:id',
  authorize(...STAFF_ROLES),
  validate({ params: idParam, body: v.updateComplaintSchema }),
  asyncHandler(controller.update),
);

module.exports = router;
