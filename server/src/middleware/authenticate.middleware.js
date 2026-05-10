import jwt from 'jsonwebtoken';

import defaultConfig from '../config/env.js';
import { UnauthorizedError } from '../utils/api-error.js';

const extractBearerToken = (req) => {
  const authorization = req.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Bearer token required');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Bearer token required');
  }

  return token;
};

export const authenticate = (options = {}) => async (req, _res, next) => {
  try {
    const config = options.config || req.app.get('config') || defaultConfig;
    const token = extractBearerToken(req);
    const verifyOptions = {
      ...(config.auth.issuer ? { issuer: config.auth.issuer } : {}),
      ...(config.auth.audience ? { audience: config.auth.audience } : {}),
    };
    const decoded = jwt.verify(token, config.auth.accessTokenSecret, verifyOptions);

    let principal = {
      subject: decoded.sub,
      role: decoded.role,
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      claims: decoded,
    };

    if (typeof options.resolveUser === 'function') {
      const resolved = await options.resolveUser(decoded, req);
      if (!resolved) {
        throw new UnauthorizedError('Authenticated principal not found');
      }

      principal = {
        ...principal,
        user: resolved,
        role: resolved.role || resolved.roleType || principal.role,
      };
    }

    req.auth = principal;
    return next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return next(error);
    }

    return next(new UnauthorizedError('Invalid or expired token'));
  }
};
