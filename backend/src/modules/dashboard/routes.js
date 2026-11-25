const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { STAFF_ROLES } = require('../../utils/roles');
const controller = require('./controller');
const { summaryQuerySchema } = require('./validation');

const router = express.Router();

router.get(
  '/summary',
  authenticate,
  authorize('super_admin', ...STAFF_ROLES),
  validate({ query: summaryQuerySchema }),
  asyncHandler(controller.summary),
);

router.get('/platform', authenticate, authorize('super_admin'), asyncHandler(controller.platform));

module.exports = router;
