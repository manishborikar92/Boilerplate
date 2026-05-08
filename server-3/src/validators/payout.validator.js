import Joi from 'joi';

import { objectId } from './common.validator.js';

export const payoutIdParamSchema = Joi.object({
    payoutId: objectId.required().messages({
        'any.required': 'Payout ID is required',
    }),
});
