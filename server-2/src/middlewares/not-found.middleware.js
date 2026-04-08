import { NotFoundError } from '../utils/app-error.js';

const notFoundHandler = (req, _res, next) => {
  next(
    new NotFoundError('Route not found', {
      method: req.method,
      path: req.originalUrl,
    }),
  );
};

export default notFoundHandler;
