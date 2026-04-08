import env from '../config/env.js';
import * as healthService from '../services/health.service.js';
import { sendSuccess } from '../utils/api-response.js';
import asyncHandler from '../utils/async-handler.js';

export const getHealth = asyncHandler(async (req, res) => {
  const query = req.validated?.query ?? {};
  const data = healthService.getHealth({
    detailed: env.healthDetailsEnabled && Boolean(query.details),
  });

  return sendSuccess(res, {
    message: 'Service health retrieved successfully',
    data,
    meta: { requestId: req.id },
  });
});

export const getLiveness = asyncHandler(async (req, res) => {
  const data = healthService.getLiveness();

  return sendSuccess(res, {
    message: 'Service is alive',
    data,
    meta: { requestId: req.id },
  });
});

export const getReadiness = asyncHandler(async (req, res) => {
  const query = req.validated?.query ?? {};
  const data = healthService.getReadiness({
    detailed: env.healthDetailsEnabled && Boolean(query.details),
  });

  return sendSuccess(res, {
    message: 'Service is ready',
    data,
    meta: { requestId: req.id },
  });
});
