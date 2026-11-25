const { z } = require('zod');
const { listQuery, id, isoDateTime, booleanish } = require('../../utils/schemas');

const CATEGORIES = ['general', 'maintenance', 'mess', 'event', 'academic', 'emergency'];
const TARGET_TYPES = ['all', 'hostel', 'floor', 'year'];

const nullable = (schema) => z.preprocess((v) => (v === '' || v === undefined ? null : v), schema.nullable());

const noticeFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  body: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000),
  category: z.enum(CATEGORIES),
  targetType: z.enum(TARGET_TYPES),
  hostelId: nullable(id),
  // Floors 0 (ground) … 5 for floor-wise, years 1 … 5 for year-wise.
  targetValues: z.array(z.coerce.number().int().min(0).max(5)).max(6).default([]),
  audienceGender: z.enum(['all', 'male', 'female']),
  isPinned: booleanish,
  startsAt: nullable(isoDateTime),
  expiresAt: nullable(isoDateTime),
};

/** Cross-field rules for the "Send To" section. */
function checkTarget(v, ctx) {
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  if ((v.targetType === 'hostel' || v.targetType === 'floor') && !v.hostelId) issue('hostelId', 'Select a hostel');
  if (v.targetType === 'floor' && !v.targetValues.length) issue('targetValues', 'Select at least one floor');
  if (v.targetType === 'year') {
    if (!v.targetValues.length) issue('targetValues', 'Select at least one year');
    if (v.targetValues.some((n) => n < 1)) issue('targetValues', 'Years are 1 to 5');
  }
  if (v.startsAt && v.expiresAt && v.expiresAt <= v.startsAt) issue('expiresAt', 'Expiry must be after the start date');
}

const createNoticeSchema = z
  .object({
    ...noticeFields,
    category: noticeFields.category.default('general'),
    targetType: noticeFields.targetType.default('all'),
    audienceGender: noticeFields.audienceGender.default('all'),
    isPinned: booleanish.default(false),
  })
  .superRefine(checkTarget);

// Updates send the whole form, so the same rules apply.
const updateNoticeSchema = createNoticeSchema;

const listNoticesSchema = listQuery.extend({
  status: z.preprocess(
    (v) => (v === '' || v === 'all' ? undefined : v),
    z.enum(['active', 'scheduled', 'expired']).optional(),
  ),
  category: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(CATEGORIES).optional()),
});

module.exports = { createNoticeSchema, updateNoticeSchema, listNoticesSchema, CATEGORIES, TARGET_TYPES };
