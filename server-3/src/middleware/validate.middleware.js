import { BadRequestError } from '../utils/api-error.js';
import { storeValidatedRequestData } from '../utils/request-validation.utils.js';
import { cleanupUploadedAssets } from '../utils/upload-cleanup.utils.js';

/**
 * Generic validation middleware factory.
 *
 * Pass a Joi schema (or any object with a `.validate()` method) and the
 * source to validate ('body', 'query', or 'params').
 *
 * Usage:
 *   router.post('/booking', validate(bookingSchema, 'body'), controller);
 *   router.get('/services', validate(serviceListQuerySchema, 'query'), controller);
 *
 * Sanitized values are stored only under `req.validated[source]`.
 * Native Express request properties are left untouched so controllers can
 * explicitly choose validated input and avoid mutating framework-owned state.
 */
export const validate = (schema, source = 'body') => {
    return async (req, _res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map((d) => d.message);
            await cleanupUploadedAssets(req, `validate:${source}`);
            return next(new BadRequestError('Validation failed', errors));
        }

        storeValidatedRequestData(req, source, value);
        next();
    };
};
