import { ValidationError } from '../errors/app-error.js';

const DEFAULT_OPTIONS = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
  stripUnknown: true,
};

const validate = (schema, source = 'body', options = {}) => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], {
    ...DEFAULT_OPTIONS,
    ...options,
  });

  if (error) {
    next(
      new ValidationError(
        'Request validation failed',
        error.details.map((detail) => ({
          message: detail.message,
          path: detail.path.join('.'),
          type: detail.type,
        })),
      ),
    );
    return;
  }

  req.validated ??= Object.create(null);
  req.validated[source] = value;

  next();
};

export default validate;
