import Joi from 'joi';

export const healthQuerySchema = Joi.object({
  details: Joi.boolean().default(false),
});
