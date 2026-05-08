import mongoose from 'mongoose';

import bookingRepository from '../repositories/booking.repository.js';
import customerRepository from '../repositories/customer.repository.js';
import ratingRepository from '../repositories/rating.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import notificationService from './notification.service.js';
import logger from '../utils/logger.js';
import {
    BOOKING_STATUS,
    NOTIFICATION_EVENT,
    NOTIFICATION_TYPE,
    PAYMENT_STATUS,
    PAYOUT_TRANSACTION_STATUS,
} from '../utils/constants.js';
import { toDateOnlyString } from '../utils/slot-lock.utils.js';

const toObjectIdString = (value) => String(value?._id || value || '');
const isObjectIdLike = (value) => mongoose.Types.ObjectId.isValid(toObjectIdString(value));

const customerName = (customer) => [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(' ')
    || 'Customer';

const safeNotify = async (operation, context) => {
    try {
        return await operation();
    } catch (error) {
        logger.error('[NotificationEvents] Notification event failed', {
            ...context,
            error: error.message,
        });
        return {
            skipped: true,
            reason: 'notification_error',
            error: error.message,
        };
    }
};

const loadBookingContext = async (bookingId) => {
    if (!isObjectIdLike(bookingId)) {
        return { skipped: true, reason: 'booking_id_invalid' };
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
        return { skipped: true, reason: 'booking_not_found' };
    }

    if (!isObjectIdLike(booking.shopId) || !isObjectIdLike(booking.customerId)) {
        return { skipped: true, reason: 'booking_context_ids_invalid', booking };
    }

    const [shop, customer] = await Promise.all([
        shopRepository.findById(booking.shopId),
        customerRepository.findById(booking.customerId),
    ]);

    if (!shop || !customer) {
        return { skipped: true, reason: 'booking_context_missing', booking, shop, customer };
    }

    return { booking, shop, customer };
};

const bookingData = (booking, shop, customer, extra = {}) => ({
    bookingId: toObjectIdString(booking._id),
    shopId: toObjectIdString(shop._id),
    customerId: toObjectIdString(customer._id),
    customerUserId: toObjectIdString(customer.userId),
    ...extra,
    status: booking.status,
    date: toDateOnlyString(booking.date),
    time: booking.time,
    requiresFetch: true,
});

export const notifyBookingAwaitingConfirmation = async ({ bookingId, paymentId = null }) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        if (!shop.ownerId) return { skipped: true, reason: 'shop_owner_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: shop.ownerId,
            actorUserId: customer.userId,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.BOOKING_AWAITING_CONFIRMATION,
            title: 'New paid booking',
            body: `${customerName(customer)} is waiting for your confirmation.`,
            data: bookingData(booking, shop, customer, {
                paymentId: paymentId ? toObjectIdString(paymentId) : null,
            }),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.BOOKING_AWAITING_CONFIRMATION}:${bookingId}:${paymentId || 'payment'}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.BOOKING_AWAITING_CONFIRMATION, bookingId, paymentId },
);

export const notifyBookingConfirmed = async ({ bookingId, actorUserId = null }) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: customer.userId,
            actorUserId,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.BOOKING_CONFIRMED,
            title: 'Booking confirmed',
            body: `${shop.shopName || 'Your barber'} confirmed your appointment.`,
            data: bookingData(booking, shop, customer),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.BOOKING_CONFIRMED}:${bookingId}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.BOOKING_CONFIRMED, bookingId },
);

export const notifyBookingCancelled = async ({
    bookingId,
    actorUserId = null,
    cancelledBy = 'system',
    reason = null,
}) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        const recipientUserId = cancelledBy === 'customer' ? shop.ownerId : customer.userId;
        if (!recipientUserId) return { skipped: true, reason: 'recipient_missing' };

        const title = cancelledBy === 'customer' ? 'Booking cancelled by customer' : 'Booking cancelled';
        const body = cancelledBy === 'customer'
            ? `${customerName(customer)} cancelled a booking.`
            : `${shop.shopName || 'Your barber'} cancelled your booking.`;

        const result = await notificationService.notifyUser({
            recipientUserId,
            actorUserId,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.BOOKING_CANCELLED,
            title,
            body,
            data: bookingData(booking, shop, customer, {
                cancelledBy,
                reason,
            }),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.BOOKING_CANCELLED}:${bookingId}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.BOOKING_CANCELLED, bookingId, cancelledBy },
);

export const notifyBookingAutoCancelled = async ({ bookingId }) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: customer.userId,
            actorUserId: shop.ownerId || null,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.BOOKING_AUTO_CANCELLED,
            title: 'Booking auto-cancelled',
            body: 'Your booking was cancelled because the barber did not confirm it in time.',
            data: bookingData(booking, shop, customer),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.BOOKING_AUTO_CANCELLED}:${bookingId}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.BOOKING_AUTO_CANCELLED, bookingId },
);

export const notifyBookingEmployeeUnavailable = async ({
    bookingId,
    employeeId,
    employeeName,
    date,
}) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: customer.userId,
            actorUserId: shop.ownerId || null,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.BOOKING_EMPLOYEE_UNAVAILABLE,
            title: 'Booking update',
            body: `Your assigned barber ${employeeName} is unavailable. Your appointment time is still reserved.`,
            data: bookingData(booking, shop, customer, {
                employeeId: toObjectIdString(employeeId),
                employeeName,
                date,
            }),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.BOOKING_EMPLOYEE_UNAVAILABLE}:${bookingId}:${employeeId}:${date}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.BOOKING_EMPLOYEE_UNAVAILABLE, bookingId, employeeId, date },
);

export const notifyBookingStatusChanged = async ({ bookingId, status, actorUserId = null }) => {
    if (status === BOOKING_STATUS.CONFIRMED) {
        return notifyBookingConfirmed({ bookingId, actorUserId });
    }

    if (status === BOOKING_STATUS.CANCELLED) {
        return notifyBookingCancelled({ bookingId, actorUserId, cancelledBy: 'barber' });
    }

    const statusEvent = status === BOOKING_STATUS.NO_SHOW
        ? NOTIFICATION_EVENT.BOOKING_NO_SHOW
        : NOTIFICATION_EVENT.BOOKING_COMPLETED;
    const title = status === BOOKING_STATUS.NO_SHOW ? 'Booking marked no-show' : 'Booking completed';
    const body = status === BOOKING_STATUS.NO_SHOW
        ? 'Your barber marked this booking as no-show.'
        : 'Your appointment has been completed.';

    return safeNotify(
        async () => {
            const context = await loadBookingContext(bookingId);
            if (context.skipped) return context;

            const { booking, shop, customer } = context;
            if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

            const result = await notificationService.notifyUser({
                recipientUserId: customer.userId,
                actorUserId,
                type: NOTIFICATION_TYPE.HYBRID,
                eventType: statusEvent,
                title,
                body,
                data: bookingData(booking, shop, customer, { status }),
                entityType: 'booking',
                entityId: booking._id,
                dedupeKey: `${statusEvent}:${bookingId}`,
            });

            return { ...result, skipped: false };
        },
        { eventType: statusEvent, bookingId, status },
    );
};

export const notifyPaymentFailed = async ({ bookingId, paymentId = null, reason = null }) => safeNotify(
    async () => {
        const context = await loadBookingContext(bookingId);
        if (context.skipped) return context;

        const { booking, shop, customer } = context;
        if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: customer.userId,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.PAYMENT_FAILED,
            title: 'Payment failed',
            body: 'Your payment did not complete. Please create a new booking.',
            data: bookingData(booking, shop, customer, {
                paymentId: paymentId ? toObjectIdString(paymentId) : null,
                paymentStatus: PAYMENT_STATUS.FAILED,
                reason,
            }),
            entityType: 'booking',
            entityId: booking._id,
            dedupeKey: `${NOTIFICATION_EVENT.PAYMENT_FAILED}:${bookingId}:${paymentId || 'payment'}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.PAYMENT_FAILED, bookingId, paymentId },
);

export const notifyRefundStatus = async ({
    bookingId,
    paymentId = null,
    status,
    amountInRupees = null,
}) => {
    const eventType = status === PAYMENT_STATUS.REFUNDED
        ? NOTIFICATION_EVENT.PAYMENT_REFUNDED
        : (status === PAYMENT_STATUS.REFUND_FAILED
            ? NOTIFICATION_EVENT.PAYMENT_REFUND_FAILED
            : NOTIFICATION_EVENT.PAYMENT_REFUND_PENDING);
    const title = status === PAYMENT_STATUS.REFUNDED
        ? 'Refund completed'
        : (status === PAYMENT_STATUS.REFUND_FAILED ? 'Refund needs attention' : 'Refund initiated');
    const body = amountInRupees
        ? `${title}: Rs. ${amountInRupees}`
        : title;

    return safeNotify(
        async () => {
            const context = await loadBookingContext(bookingId);
            if (context.skipped) return context;

            const { booking, shop, customer } = context;
            if (!customer.userId) return { skipped: true, reason: 'customer_user_missing' };

            const result = await notificationService.notifyUser({
                recipientUserId: customer.userId,
                type: NOTIFICATION_TYPE.HYBRID,
                eventType,
                title,
                body,
                data: bookingData(booking, shop, customer, {
                    paymentId: paymentId ? toObjectIdString(paymentId) : null,
                    paymentStatus: status,
                    amountInRupees,
                }),
                entityType: 'booking',
                entityId: booking._id,
                dedupeKey: `${eventType}:${bookingId}:${paymentId || 'payment'}`,
            });

            return { ...result, skipped: false };
        },
        { eventType, bookingId, paymentId, status },
    );
};

export const notifyRatingReceived = async ({ ratingId }) => safeNotify(
    async () => {
        const rating = await ratingRepository.findById(ratingId);
        if (!rating) return { skipped: true, reason: 'rating_not_found' };
        if (!isObjectIdLike(rating.shopId) || !isObjectIdLike(rating.customerId)) {
            return { skipped: true, reason: 'rating_context_ids_invalid' };
        }

        const [shop, customer] = await Promise.all([
            shopRepository.findById(rating.shopId),
            customerRepository.findById(rating.customerId),
        ]);
        if (!shop?.ownerId || !customer) return { skipped: true, reason: 'rating_context_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: shop.ownerId,
            actorUserId: customer.userId || null,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.RATING_RECEIVED,
            title: 'New rating received',
            body: `${customerName(customer)} rated your shop ${rating.rating} stars.`,
            data: {
                ratingId: toObjectIdString(rating._id),
                shopId: toObjectIdString(shop._id),
                customerId: toObjectIdString(customer._id),
                rating: rating.rating,
                requiresFetch: true,
            },
            entityType: 'rating',
            entityId: rating._id,
            dedupeKey: `${NOTIFICATION_EVENT.RATING_RECEIVED}:${ratingId}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.RATING_RECEIVED, ratingId },
);

export const notifyRatingReply = async ({ ratingId, actorUserId = null }) => safeNotify(
    async () => {
        const rating = await ratingRepository.findById(ratingId);
        if (!rating) return { skipped: true, reason: 'rating_not_found' };
        if (!isObjectIdLike(rating.shopId) || !isObjectIdLike(rating.customerId)) {
            return { skipped: true, reason: 'rating_context_ids_invalid' };
        }

        const [shop, customer] = await Promise.all([
            shopRepository.findById(rating.shopId),
            customerRepository.findById(rating.customerId),
        ]);
        if (!customer?.userId) return { skipped: true, reason: 'customer_user_missing' };

        const result = await notificationService.notifyUser({
            recipientUserId: customer.userId,
            actorUserId,
            type: NOTIFICATION_TYPE.HYBRID,
            eventType: NOTIFICATION_EVENT.RATING_REPLY,
            title: 'Barber replied to your rating',
            body: `${shop?.shopName || 'Your barber'} replied to your review.`,
            data: {
                ratingId: toObjectIdString(rating._id),
                shopId: toObjectIdString(rating.shopId),
                requiresFetch: true,
            },
            entityType: 'rating',
            entityId: rating._id,
            dedupeKey: `${NOTIFICATION_EVENT.RATING_REPLY}:${ratingId}`,
        });

        return { ...result, skipped: false };
    },
    { eventType: NOTIFICATION_EVENT.RATING_REPLY, ratingId },
);

export const notifyAccountUpdated = async ({ userId, updateType }) => safeNotify(
    async () => {
        if (!userId) return { skipped: true, reason: 'recipient_missing' };

        return notificationService.notifyUser({
            recipientUserId: userId,
            type: NOTIFICATION_TYPE.SILENT,
            eventType: NOTIFICATION_EVENT.ACCOUNT_UPDATED,
            title: null,
            body: null,
            data: {
                updateType,
                requiresFetch: true,
            },
            entityType: 'account',
            entityId: toObjectIdString(userId),
        });
    },
    { eventType: NOTIFICATION_EVENT.ACCOUNT_UPDATED, userId, updateType },
);

export const notifyShopStatusUpdated = async ({ ownerId, shopId, isOpen }) => safeNotify(
    async () => {
        if (!ownerId) return { skipped: true, reason: 'recipient_missing' };

        return notificationService.notifyUser({
            recipientUserId: ownerId,
            type: NOTIFICATION_TYPE.SILENT,
            eventType: NOTIFICATION_EVENT.SHOP_STATUS_UPDATED,
            title: null,
            body: null,
            data: {
                shopId: toObjectIdString(shopId),
                isOpen,
                requiresFetch: true,
            },
            entityType: 'shop',
            entityId: shopId,
        });
    },
    { eventType: NOTIFICATION_EVENT.SHOP_STATUS_UPDATED, ownerId, shopId },
);

export const notifyPayoutStatus = async ({
    payoutId,
    barberId,
    status,
    amountInRupees = null,
    failureReason = null,
}) => {
    const eventType = status === PAYOUT_TRANSACTION_STATUS.SUCCESS
        ? NOTIFICATION_EVENT.PAYOUT_COMPLETED
        : NOTIFICATION_EVENT.PAYOUT_FAILED;
    const title = status === PAYOUT_TRANSACTION_STATUS.SUCCESS ? 'Payout completed' : 'Payout failed';

    return safeNotify(
        async () => {
            if (!barberId) return { skipped: true, reason: 'recipient_missing' };

            return notificationService.notifyUser({
                recipientUserId: barberId,
                type: NOTIFICATION_TYPE.HYBRID,
                eventType,
                title,
                body: amountInRupees ? `${title}: Rs. ${amountInRupees}` : title,
                data: {
                    payoutId: toObjectIdString(payoutId),
                    status,
                    amountInRupees,
                    failureReason,
                    requiresFetch: true,
                },
                entityType: 'payout',
                entityId: payoutId,
                dedupeKey: `${eventType}:${payoutId}:${status}`,
            });
        },
        { eventType, payoutId, barberId, status },
    );
};

const notificationEventsService = {
    notifyBookingAwaitingConfirmation,
    notifyBookingConfirmed,
    notifyBookingCancelled,
    notifyBookingAutoCancelled,
    notifyBookingEmployeeUnavailable,
    notifyBookingStatusChanged,
    notifyPaymentFailed,
    notifyRefundStatus,
    notifyRatingReceived,
    notifyRatingReply,
    notifyAccountUpdated,
    notifyShopStatusUpdated,
    notifyPayoutStatus,
};

export default notificationEventsService;
