const { ZodError } = require('zod');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { formatZodError } = require('./validate');

function notFoundHandler(req, res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function mapError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(400, 'VALIDATION_ERROR', 'Validation failed', formatZodError(err));
  }
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return new AppError(409, 'DUPLICATE', 'A record with the same unique value already exists');
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError(409, 'IN_USE', 'This record is referenced by other data and cannot be deleted');
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError(400, 'INVALID_REFERENCE', 'A referenced record does not exist');
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new AppError(400, 'CONSTRAINT_VIOLATION', 'A value is outside the allowed range');
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
    case 'ER_WRONG_VALUE':
    case 'ER_DATA_TOO_LONG':
    case 'ER_WARN_DATA_OUT_OF_RANGE':
      return new AppError(400, 'INVALID_VALUE', 'A value is invalid or out of range');
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const mapped = mapError(err);
  const appErr = mapped || new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.');

  if (!mapped || appErr.statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  }

  const body = {
    success: false,
    error: {
      code: appErr.code,
      message: appErr.message,
      details: appErr.details ?? null,
    },
  };
  if (env.isDev && !mapped && err.stack) body.error.stack = err.stack;

  res.status(appErr.statusCode).json(body);
}

module.exports = { errorHandler, notFoundHandler };
