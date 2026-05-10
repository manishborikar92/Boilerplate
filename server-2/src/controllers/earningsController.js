const Payment = require('../models/Payment');
const Firm = require('../models/Firm');
const {
  asyncHandler
} = require('../utils/errorHandler');

/**
 * @desc    Get earnings data for firm (excludes subscriptions - those are CA expenses)
 * @route   GET /api/payments/earnings
 * @access  Private (CA-Admin)
 */
exports.getEarnings = asyncHandler(async (req, res) => {
  const firmId = req.user.firmId;
  const now = new Date();
  
  // Current month
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Previous month
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // Aggregate current month earnings (exclude subscriptions)
  const currentEarnings = await Payment.aggregate([
    {
      $match: {
        firmId: firmId,
        status: 'paid',
        paymentType: { $ne: 'subscription' }, // Exclude subscriptions
        paidAt: { $gte: currentMonthStart, $lte: now }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  // Aggregate previous month earnings (exclude subscriptions)
  const previousEarnings = await Payment.aggregate([
    {
      $match: {
        firmId: firmId,
        status: 'paid',
        paymentType: { $ne: 'subscription' }, // Exclude subscriptions
        paidAt: { $gte: previousMonthStart, $lte: previousMonthEnd }
      }
    },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$amount' }
      }
    }
  ]);

  const currentTotal = currentEarnings.length > 0 ? currentEarnings[0].totalEarnings : 0;
  const previousTotal = previousEarnings.length > 0 ? previousEarnings[0].totalEarnings : 0;

  // Calculate growth percentage
  let growthPercent = 0;
  if (previousTotal > 0) {
    growthPercent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
  } else if (currentTotal > 0) {
    growthPercent = 100;
  }

  res.json({
    success: true,
    data: {
      totalEarnings: currentTotal / 100, // Convert paise to rupees
      currency: 'INR',
      growthPercent,
      comparisonPeriod: 'last month'
    }
  });
});

module.exports = exports;
