import { asyncHandler, sendSuccess } from '../../shared.js';
import { buildInfoPayload } from './info.service.js';

export const createInfoController = ({ app }) => ({
  getInfo: asyncHandler(async (req, res) =>
    sendSuccess(res, {
      message: 'Main API information retrieved successfully',
      data: buildInfoPayload(app),
      meta: { requestId: req.id },
    })),
});
