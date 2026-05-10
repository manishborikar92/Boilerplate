import { BadRequestError } from '../utils/api-error.js';
import { storeValidatedRequestData } from '../utils/request-validation.js';

export const validate = (schema, source = 'body') => (req, _res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      path: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));

    return next(new BadRequestError('Validation failed', { errors }));
  }

  storeValidatedRequestData(req, source, value);
  return next();
};
