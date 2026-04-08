import { NotFoundError } from '../errors/app-error.js';

const createNotFoundHandler = () => (req, _res, next) => {
  next(
    new NotFoundError('Route not found', {
      method: req.method,
      path: req.originalUrl,
    }),
  );
};

export default createNotFoundHandler;
