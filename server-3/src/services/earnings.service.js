import bookingRepository from '../repositories/booking.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import paymentRepository from '../repositories/payment.repository.js';
import { NotFoundError, ForbiddenError } from '../utils/api-error.js';
import { buildPagination } from '../utils/pagination.utils.js';
import { PAYMENT_TRANSACTION_STATUS } from '../utils/constants.js';

/**
 * Earnings service — calculates barber earnings and manages transactions.
 */

const toObjectIdString = (value) => String(value?._id || value || '');

/**
 * Format customer name from customer object
 */
const formatCustomerName = (customer) => {
    if (!customer) return 'Unknown Customer';
    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Customer';
};

/**
 * Format employee/barber name
 */
const formatEmployeeName = (employee) => {
    if (!employee) return 'Unknown Barber';
    const firstName = employee.firstName || '';
    const lastName = employee.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Barber';
};

/**
 * Format date to display format (e.g., "13 DECEMBER 2024")
 */
const formatTransactionDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
};

/**
 * Format booking date to display format
 */
const formatBookingDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
};

/**
 * Calculate monthly revenue and percentage change
 */
const calculateMonthlyRevenue = async (shopId) => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Get completed payments for current and last month
    const [currentMonthPayments, lastMonthPayments] = await Promise.all([
        paymentRepository.findAll({
            shopId,
            status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
            createdAt: { $gte: currentMonthStart, $lte: currentMonthEnd },
        }),
        paymentRepository.findAll({
            shopId,
            status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
            createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
        }),
    ]);

    const currentMonthTotal = currentMonthPayments.reduce(
        (sum, payment) => sum + (payment.settlement?.barberPayout || 0),
        0,
    );
    const lastMonthTotal = lastMonthPayments.reduce(
        (sum, payment) => sum + (payment.settlement?.barberPayout || 0),
        0,
    );

    let changePercentage = 0;
    let changeDirection = 'neutral';

    if (lastMonthTotal > 0) {
        changePercentage = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
        changeDirection = changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'neutral';
    } else if (currentMonthTotal > 0) {
        changePercentage = 100;
        changeDirection = 'up';
    }

    return {
        amount: currentMonthTotal / 100, // Convert paisa to rupees
        currency: 'INR',
        changePercentage: Math.abs(parseFloat(changePercentage.toFixed(1))),
        changeDirection,
        period: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
};

/**
 * Build transaction list item for API response
 */
const buildTransactionListItem = (payment, booking) => {
    const customer = booking?.customerId;
    const customerUser = customer?.userId;

    return {
        id: toObjectIdString(payment._id),
        transactionId: payment.gatewayTransactionId || `TXN${payment._id.toString().slice(-8).toUpperCase()}`,
        customer: {
            name: formatCustomerName(customer),
            upiId: customerUser?.phoneNumber ? `${customerUser.phoneNumber.slice(-10)}@upi` : null,
        },
        amount: (payment.settlement?.barberPayout || payment.amount) / 100,
        currency: payment.currency || 'INR',
        status: payment.status,
        timestamp: payment.createdAt,
        date: formatTransactionDate(payment.createdAt),
    };
};

/**
 * Get effective service price (same logic as booking creation)
 */
const getServicePrice = (service) => {
    // Priority 1: finalPrice (pre-calculated price)
    if (service.finalPrice != null && service.finalPrice > 0) {
        return service.finalPrice;
    }
    
    // Priority 2: totalPrice (for bundled services)
    if (service.totalPrice != null && service.totalPrice > 0) {
        return service.totalPrice;
    }
    
    // Priority 3: actualPrice - offerPrice (discounted price)
    if (service.actualPrice != null) {
        const offerPrice = service.offerPrice || 0;
        return service.actualPrice - offerPrice;
    }
    
    // Fallback: offerPrice alone (shouldn't happen but safe fallback)
    return service.offerPrice || 0;
};

/**
 * Build detailed transaction response
 */
const buildTransactionDetail = async (payment, booking) => {
    const customer = booking?.customerId;
    const customerUser = customer?.userId;
    const employee = booking?.employeeId;
    const services = booking?.serviceIds || [];

    return {
        id: toObjectIdString(payment._id),
        transactionId: payment.gatewayTransactionId || `TXN${payment._id.toString().slice(-8).toUpperCase()}`,
        customer: {
            name: formatCustomerName(customer),
        },
        barber: {
            name: formatEmployeeName(employee),
        },
        booking: {
            date: formatBookingDate(booking?.date),
            time: booking?.time || '',
        },
        services: services.map((service) => ({
            id: toObjectIdString(service._id),
            name: service.serviceName || 'Service',
            price: getServicePrice(service),
        })),
        grandTotal: (payment.settlement?.serviceAmount || payment.amount) / 100,
        taxInclusive: true,
        paymentStatus: payment.status === PAYMENT_TRANSACTION_STATUS.COMPLETED
            ? 'Successfully Paid'
            : payment.status === PAYMENT_TRANSACTION_STATUS.REFUNDED
                ? 'Refunded'
                : payment.status === PAYMENT_TRANSACTION_STATUS.REFUND_PENDING
                    ? 'Refund Pending'
                    : 'Payment Pending',
        userUpi: customerUser?.phoneNumber ? `${customerUser.phoneNumber.slice(-10)}@upi` : null,
        currency: payment.currency || 'INR',
        timestamp: payment.createdAt,
        paymentMode: payment.paymentMode || 'UPI',
    };
};

export const getEarnings = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [result] = await bookingRepository.getEarningsAggregationForShop(
        shop._id,
        startOfToday,
        endOfToday,
        startOfLastMonth,
        endOfLastMonth,
    );

    const basicEarnings = result || { totalEarning: 0, lastMonthEarning: 0, todayEarning: 0 };

    // Calculate monthly revenue with percentage change (same as in transactions)
    const monthlyRevenue = await calculateMonthlyRevenue(shop._id);

    return {
        ...basicEarnings,
        monthlyRevenue,
    };
};

/**
 * Get transaction history for barber
 */
export const getTransactions = async (ownerId, query = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    // Build filter
    const filter = {
        shopId: shop._id,
        status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
    };

    if (query.status) {
        filter.status = query.status;
    }

    if (query.startDate || query.endDate) {
        filter.createdAt = {};
        if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
        if (query.endDate) {
            const endDate = new Date(query.endDate);
            endDate.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = endDate;
        }
    }

    // Get total count and pagination
    const total = await paymentRepository.countAll(filter);
    const { skip, limit, pagination } = buildPagination(query, total);

    // Fetch payments with populated booking data
    const payments = await paymentRepository.findAllForEarnings(filter, { skip, limit });

    // Calculate monthly revenue
    const monthlyRevenue = await calculateMonthlyRevenue(shop._id);

    // Build transaction list
    const transactions = payments.map((payment) => buildTransactionListItem(payment, payment.bookingId));

    return {
        monthlyRevenue,
        transactions,
        pagination,
    };
};

/**
 * Get detailed transaction information
 */
export const getTransactionDetail = async (ownerId, transactionId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const payment = await paymentRepository.findByIdForEarnings(transactionId);
    if (!payment) throw new NotFoundError('Transaction');

    // Verify the transaction belongs to this shop
    if (toObjectIdString(payment.shopId) !== toObjectIdString(shop._id)) {
        throw new ForbiddenError('You can only access transactions for your own shop');
    }

    // Booking is already populated from repository
    const booking = payment.bookingId;
    if (!booking) throw new NotFoundError('Booking associated with this transaction');

    return buildTransactionDetail(payment, booking);
};

/**
 * Generate transaction statement (PDF only)
 */
export const generateStatement = async (ownerId, query) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const filter = {
        shopId: shop._id,
        status: PAYMENT_TRANSACTION_STATUS.COMPLETED,
        createdAt: {
            $gte: new Date(query.startDate),
            $lte: (() => {
                const endDate = new Date(query.endDate);
                endDate.setHours(23, 59, 59, 999);
                return endDate;
            })(),
        },
    };

    const payments = await paymentRepository.findAllForEarnings(filter, {});

    // Import PDF generator
    const { generateTransactionStatementPDF, calculateTransactionSummary } = await import('../utils/pdf-generator.utils.js');
    
    // Prepare transaction data for PDF
    const transactions = payments.map((payment) => {
        const booking = payment.bookingId;
        const customer = booking?.customerId;
        
        return {
            date: payment.createdAt,
            transactionId: payment.gatewayTransactionId || `TXN${payment._id.toString().slice(-8).toUpperCase()}`,
            customerName: formatCustomerName(customer),
            amount: (payment.settlement?.barberPayout || payment.amount) / 100,
            currency: payment.currency || 'INR',
            status: payment.status,
            paymentMode: payment.paymentMode || 'N/A',
        };
    });
    
    // Calculate summary
    const summary = calculateTransactionSummary(transactions);
    
    // Get owner name from shop (shop already has owner information)
    const ownerName = shop.ownerName || `${shop.ownerFirstName || ''} ${shop.ownerLastName || ''}`.trim() || 'Shop Owner';
    
    // Generate PDF
    const pdfDoc = generateTransactionStatementPDF({
        shop: {
            shopName: shop.shopName,
            ownerName,
        },
        transactions,
        dateRange: {
            startDate: query.startDate,
            endDate: query.endDate,
        },
        summary,
    });
    
    const filename = `transactions_${query.startDate}_to_${query.endDate}.pdf`;
    
    return {
        stream: pdfDoc,
        contentType: 'application/pdf',
        filename,
    };
};

// Resource analytics
