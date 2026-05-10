import { ForbiddenError, UnauthorizedError } from '../utils/api-error.js';

export const authorize = (...allowedRoles) => (req, _res, next) => {
  if (!req.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (allowedRoles.length === 0) {
    return next();
  }

  if (!allowedRoles.includes(req.auth.role)) {
    return next(new ForbiddenError('Insufficient permissions'));
  }

  return next();
};

export const requirePermissions = (...requiredPermissions) => (req, _res, next) => {
  if (!req.auth) {
    return next(new UnauthorizedError('Authentication required'));
  }

  const granted = new Set(req.auth.permissions || []);
  const missing = requiredPermissions.filter((permission) => !granted.has(permission));
  if (missing.length > 0) {
    return next(new ForbiddenError('Missing required permissions', { missing }));
  }

  return next();
};
