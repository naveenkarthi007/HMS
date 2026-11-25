const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { STAFF_ROLES } = require('../../utils/roles');
const { importBodySchema } = require('../../utils/importer');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

router.use(authenticate);

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get(
  '/export',
  authorize(...STAFF_ROLES, 'student'),
  validate({ query: v.exportMonthSchema }),
  asyncHandler(controller.exportCsv),
);
router.post(
  '/import',
  authorize(...STAFF_ROLES),
  validate({ body: importBodySchema }),
  asyncHandler(controller.importCsv),
);

// Students always see their own hostel's menu; staff pass ?hostelId=.
router.get(
  '/',
  authorize(...STAFF_ROLES, 'student'),
  validate({ query: v.monthQuerySchema }),
  asyncHandler(controller.month),
);
router.put(
  '/:hostelId/:date',
  authorize(...STAFF_ROLES),
  validate({ params: v.dayParams, body: v.upsertMenuSchema }),
  asyncHandler(controller.upsert),
);
router.delete(
  '/:hostelId/:date',
  authorize(...STAFF_ROLES),
  validate({ params: v.dayParams }),
  asyncHandler(controller.remove),
);

module.exports = router;
