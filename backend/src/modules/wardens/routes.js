const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { ADMIN_ROLES } = require('../../utils/roles');
const { idParam } = require('../../utils/schemas');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

router.use(authenticate, authorize(...ADMIN_ROLES));

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get('/export', validate({ query: v.listWardensSchema }), asyncHandler(controller.exportCsv));
router.post('/import', validate({ body: v.wardenImportSchema }), asyncHandler(controller.importCsv));

router.get('/', validate({ query: v.listWardensSchema }), asyncHandler(controller.list));
router.post('/', validate({ body: v.createWardenSchema }), asyncHandler(controller.create));
router.get('/:id', validate({ params: idParam }), asyncHandler(controller.getById));
router.patch('/:id', validate({ params: idParam, body: v.updateWardenSchema }), asyncHandler(controller.update));
router.put(
  '/:id/hostels',
  validate({ params: idParam, body: v.assignHostelsSchema }),
  asyncHandler(controller.assignHostels),
);
router.delete('/:id', validate({ params: idParam }), asyncHandler(controller.remove));

module.exports = router;
