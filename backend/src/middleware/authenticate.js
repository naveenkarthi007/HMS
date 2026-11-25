const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Reads the access token from the httpOnly cookie (or a Bearer header for API clients)
 * and attaches the decoded user to req.user. organisation_id always comes from the token.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = req.cookies?.access_token || bearer;

  if (!token) return next(AppError.unauthorized());

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
      organisationId: payload.org === null || payload.org === undefined ? null : Number(payload.org),
      gender: payload.gender || null,
      name: payload.name,
    };
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token';
    return next(new AppError(401, 'UNAUTHORIZED', message));
  }
}

module.exports = authenticate;
