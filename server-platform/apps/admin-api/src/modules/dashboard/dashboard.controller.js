import { asyncHandler, sendSuccess } from '../../shared.js';
import { buildDashboardSummary } from './dashboard.service.js';

export const createDashboardController = ({ app }) => ({
  getSummary: asyncHandler(async (req, res) =>
    sendSuccess(res, {
      message: 'Admin dashboard summary retrieved successfully',
      data: buildDashboardSummary(app),
      meta: { requestId: req.id },
    })),
});
