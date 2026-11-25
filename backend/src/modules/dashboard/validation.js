const { z } = require('zod');
const { emptyToUndefined, gender, id } = require('../../utils/schemas');

const summaryQuerySchema = z.object({
  gender: emptyToUndefined(gender.optional()),
  hostelId: emptyToUndefined(id.optional()),
});

module.exports = { summaryQuerySchema };
