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

router.use(authenticate);

// Declared before /:id. CSV of every row matching the same filters as the list.
router.get(
  '/export',
  authorize(...ADMIN_ROLES, 'student'),
  validate({ query: v.listApplicationsSchema }),
  asyncHandler(controller.exportCsv),
);

router.get('/options', authorize('student'), asyncHandler(controller.options));
router.get(
  '/',
  authorize(...ADMIN_ROLES, 'student'),
  validate({ query: v.listApplicationsSchema }),
  asyncHandler(controller.list),
);
router.post('/', authorize('student'), validate({ body: v.createApplicationSchema }), asyncHandler(controller.create));
router.get('/:id', authorize(...ADMIN_ROLES, 'student'), validate({ params: idParam }), asyncHandler(controller.getById));
router.post('/:id/cancel', authorize('student'), validate({ params: idParam }), asyncHandler(controller.cancel));
router.post(
  '/:id/review',
  authorize(...ADMIN_ROLES),
  validate({ params: idParam, body: v.reviewApplicationSchema }),
  asyncHandler(controller.review),
);

module.exports = router;
