const { z } = require('zod');
const { listQuery, phone, gender, id, booleanish } = require('../../utils/schemas');
const { password } = require('../auth/validation');
const { enumColumn } = require('../../utils/importer');

const hostelIds = z.array(id).max(50).default([]);

const assignmentItem = z
  .object({
    hostelId: id,
    scopeType: z.enum(['hostel', 'floor', 'room_range', 'room']).default('hostel'),
    floor: z.coerce.number().int().min(-5).max(100).nullable().optional(),
    roomStart: z.string().trim().max(20).nullable().optional(),
    roomEnd: z.string().trim().max(20).nullable().optional(),
    roomNumber: z.string().trim().max(20).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scopeType === 'floor' && (val.floor === null || val.floor === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Floor number is required', path: ['floor'] });
    }
    if (val.scopeType === 'room' && !val.roomNumber) {
      ctx.addIssue({ code: 'custom', message: 'Room number is required', path: ['roomNumber'] });
    }
    if (val.scopeType === 'room_range' && (!val.roomStart || !val.roomEnd)) {
      ctx.addIssue({ code: 'custom', message: 'Start and end room numbers are required', path: ['roomStart'] });
    }
  });

const assignments = z.array(assignmentItem).max(200).optional();

const createWardenSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(150),
  password,
  gender,
  phone,
  hostelIds,
  assignments,
});

const updateWardenSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120).optional(),
  gender: gender.optional(),
  phone,
  isActive: booleanish.optional(),
  password: z.preprocess((v) => (v === '' ? undefined : v), password.optional()),
});

const assignHostelsSchema = z.object({
  hostelIds: hostelIds.optional(),
  assignments,
});

const listWardensSchema = listQuery.extend({
  status: z.preprocess((v) => (v === '' || v === 'all' ? undefined : v), z.enum(['active', 'inactive']).optional()),
});

/** One CSV row: name, email, gender, phone, hostel_codes ("BH1;BH2") */
const wardenImportRow = z.object({
  name: z.string().trim().min(2, 'name is required').max(120),
  email: z.string().trim().toLowerCase().email('email is invalid').max(150),
  gender: enumColumn(['male', 'female'], 'gender'),
  phone,
  hostel_codes: z.preprocess(
    (v) =>
      String(v ?? '')
        .split(/[;|]/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    z.array(z.string().max(20)).max(50),
  ),
});

const wardenImportSchema = z.object({
  csv: z.string().min(1, 'CSV content is required').max(1_500_000, 'CSV file is too large'),
  defaultPassword: password,
});

module.exports = {
  createWardenSchema,
  updateWardenSchema,
  assignHostelsSchema,
  listWardensSchema,
  wardenImportRow,
  wardenImportSchema,
};
