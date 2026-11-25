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
  validate({ query: v.listAttendanceSchema }),
  asyncHandler(controller.exportCsv),
);
router.post(
  '/import',
  authorize(...STAFF_ROLES),
  validate({ body: importBodySchema }),
  asyncHandler(controller.importCsv),
);

router.get(
  '/',
  authorize(...STAFF_ROLES, 'student'),
  validate({ query: v.listAttendanceSchema }),
  asyncHandler(controller.list),
);
router.get(
  '/sheet',
  authorize(...STAFF_ROLES),
  validate({ query: v.sheetQuerySchema }),
  asyncHandler(controller.sheet),
);
router.post(
  '/',
  authorize(...STAFF_ROLES),
  validate({ body: v.markAttendanceSchema }),
  asyncHandler(controller.mark),
);

module.exports = router;
