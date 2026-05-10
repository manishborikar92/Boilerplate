import { NotFoundError } from '../utils/api-error.js';

export const notFound = (req, _res, next) => {
  next(new NotFoundError('Route not found', {
    method: req.method,
    path: req.originalUrl,
  }));
};
