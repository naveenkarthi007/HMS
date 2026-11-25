const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

function formatZodError(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Validates and replaces req.body / req.query / req.params with the parsed zod output.
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const part of ['params', 'query', 'body']) {
        if (schemas[part]) {
          req[part] = schemas[part].parse(req[part] ?? {});
        }
      }
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new AppError(400, 'VALIDATION_ERROR', 'Validation failed', formatZodError(err)));
      }
      return next(err);
    }
  };
}

module.exports = { validate, formatZodError };
