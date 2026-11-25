const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { ADMIN_ROLES, STAFF_ROLES } = require('../../utils/roles');
const { importBodySchema } = require('../../utils/importer');
const { idParam } = require('../../utils/schemas');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

router.use(authenticate);

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get(
  '/export',
  authorize(...STAFF_ROLES),
  validate({ query: v.listAllocationsSchema }),
  asyncHandler(controller.exportCsv),
);
router.post(
  '/import',
  authorize(...ADMIN_ROLES),
  validate({ body: importBodySchema }),
  asyncHandler(controller.importCsv),
);

router.get(
  '/',
  authorize(...STAFF_ROLES),
  validate({ query: v.listAllocationsSchema }),
  asyncHandler(controller.list),
);
router.post('/', authorize(...ADMIN_ROLES), validate({ body: v.createAllocationSchema }), asyncHandler(controller.create));
router.get('/:id', authorize(...STAFF_ROLES), validate({ params: idParam }), asyncHandler(controller.getById));
router.post(
  '/:id/vacate',
  authorize(...ADMIN_ROLES),
  validate({ params: idParam, body: v.vacateSchema }),
  asyncHandler(controller.vacate),
);

module.exports = router;
