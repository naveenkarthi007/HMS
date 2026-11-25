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
  validate({ query: v.listRoomsSchema }),
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
  validate({ query: v.listRoomsSchema }),
  asyncHandler(controller.list),
);
router.post('/', authorize(...ADMIN_ROLES), validate({ body: v.createRoomSchema }), asyncHandler(controller.create));
router.get('/:id', authorize(...STAFF_ROLES), validate({ params: idParam }), asyncHandler(controller.getById));
router.patch(
  '/:id',
  authorize(...ADMIN_ROLES),
  validate({ params: idParam, body: v.updateRoomSchema }),
  asyncHandler(controller.update),
);
router.delete('/:id', authorize(...ADMIN_ROLES), validate({ params: idParam }), asyncHandler(controller.remove));

module.exports = router;
