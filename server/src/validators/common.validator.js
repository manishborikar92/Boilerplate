import Joi from 'joi';
import mongoose from 'mongoose';

export const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }

  return value;
}, 'ObjectId validation');

export const objectIdParamSchema = Joi.object({
  id: objectId.required(),
});

export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
