const express = require('express');
const asyncHandler = require('../../utils/asyncHandler');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { importBodySchema } = require('../../utils/importer');
const { idParam } = require('../../utils/schemas');
const controller = require('./controller');
const v = require('./validation');

const router = express.Router();

router.use(authenticate, authorize('super_admin'));

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get('/export', validate({ query: v.listOrganisationsSchema }), asyncHandler(controller.exportCsv));
router.post('/import', validate({ body: importBodySchema }), asyncHandler(controller.importCsv));

router.get('/', validate({ query: v.listOrganisationsSchema }), asyncHandler(controller.list));
router.post('/', validate({ body: v.createOrganisationSchema }), asyncHandler(controller.create));
router.get('/:id', validate({ params: idParam }), asyncHandler(controller.getById));
router.patch('/:id', validate({ params: idParam, body: v.updateOrganisationSchema }), asyncHandler(controller.update));
router.delete('/:id', validate({ params: idParam }), asyncHandler(controller.remove));
router.get('/:id/admins', validate({ params: idParam }), asyncHandler(controller.listAdmins));
router.post(
  '/:id/admins',
  validate({ params: idParam, body: v.createAdminSchema }),
  asyncHandler(controller.createAdmin),
);
router.patch(
  '/:id/admins/:adminId',
  validate({ params: v.adminParams, body: v.updateAdminSchema }),
  asyncHandler(controller.updateAdmin),
);

module.exports = router;
