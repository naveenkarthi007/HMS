const AppError = require('../utils/AppError');

/**
 * Role + organisation guard. Every role except super_admin must belong to an organisation.
 * Usage: authorize('org_admin', 'warden')
 *
 * Platform view: a super_admin may send `X-Organisation-Id` to look inside one organisation.
 * On organisation-scoped routes (those open to org_admin) the request is then scoped exactly
 * like that organisation's admin, but only for GET requests — platform view is read-only.
 * The organisation id still never comes from the request body.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized());

    const user = req.user;
    const viewOrg = user.role === 'super_admin' ? Number(req.get('x-organisation-id')) : NaN;
    if (Number.isInteger(viewOrg) && viewOrg > 0 && roles.includes('org_admin')) {
      if (req.method !== 'GET') {
        return next(
          AppError.forbidden('Platform view is read-only. Sign in as the organisation admin to make changes.'),
        );
      }
      req.user = { ...user, role: 'org_admin', organisationId: viewOrg, platformView: true, realRole: 'super_admin' };
      return next();
    }

    if (roles.length && !roles.includes(user.role)) return next(AppError.forbidden());
    if (user.role !== 'super_admin' && !user.organisationId) {
      return next(AppError.forbidden('Your account is not linked to an organisation'));
    }
    return next();
  };
}

module.exports = authorize;
