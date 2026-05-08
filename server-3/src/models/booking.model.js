import mongoose from 'mongoose';
import {
    ALL_BOOKING_STATUSES,
    ALL_PAYMENT_STATUSES,
    ALL_PAYOUT_STATUSES,
    BOOKING_STATUS,
    PAYMENT_GATEWAYS,
    PAYMENT_STATUS,
} from '../utils/constants.js';

/**
 * Booking model.
 *
 * Changes from old schema:
 *   - `userId`   → `customerId` (clearer naming)
 *   - `salonist` → `employeeId` (clearer naming)
 *   - `amount`   → `totalAmount`
 *   - Removed duplicate manual createdAt (let { timestamps: true } handle it)
 *   - Added proper composite indexes for query performance
 */
const bookingSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
            index: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        serviceIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Service',
                required: true,
            },
        ],
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            required: true,
        },
        endTime: {
            type: String,
            required: true,
        },
        startMinute: {
            type: Number,
            required: true,
            min: 0,
            max: 1439,
        },
        endMinute: {
            type: Number,
            required: true,
            min: 1,
            max: 1440,
        },
        totalAmount: {
            type: Number,
            default: 0,
        },
        durationMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },
        slotLockTimes: [
            {
                type: String,
                trim: true,
            },
        ],
        status: {
            type: String,
            enum: ALL_BOOKING_STATUSES,
            default: BOOKING_STATUS.PENDING,
        },
        paymentStatus: {
            type: String,
            enum: ALL_PAYMENT_STATUSES,
            default: PAYMENT_STATUS.PENDING,
        },
        paymentTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PaymentTransaction',
            default: null,
        },
        merchantOrderId: {
            type: String,
            default: null,
            index: true,
        },
        paymentGateway: {
            type: String,
            enum: Object.values(PAYMENT_GATEWAYS),
            default: PAYMENT_GATEWAYS.PHONEPE,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        paymentMode: {
            type: String,
            default: null,
        },
        payoutTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PayoutTransaction',
            default: null,
        },
        payoutStatus: {
            type: String,
            enum: ALL_PAYOUT_STATUSES,
            default: 'not_initiated',
            index: true,
        },
        payoutCompletedAt: {
            type: Date,
            default: null,
        },
        barberUtr: {
            type: String,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        cancellationNote: {
            type: String,
            default: null,
            maxlength: 500,
        },
        rescheduleCount: {
            type: Number,
            default: 0,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        barberCancelledAt: {
            type: Date,
            default: null,
        },
        barberConfirmedAt: {
            type: Date,
            default: null,
        },
        autoCancelledAt: {
            type: Date,
            default: null,
        },
        noShowAt: {
            type: Date,
            default: null,
        },
        idempotencyKey: {
            type: String,
            trim: true,
            default: null,
            maxlength: 128,
        },
    },
    { timestamps: true },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ shopId: 1, date: 1 });
bookingSchema.index({ employeeId: 1, date: 1, time: 1 });
bookingSchema.index({ employeeId: 1, date: 1, startMinute: 1, endMinute: 1 });
bookingSchema.index({ customerId: 1, date: 1 });
bookingSchema.index({ payoutStatus: 1, status: 1, paymentStatus: 1 });
bookingSchema.index(
    { customerId: 1, idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            idempotencyKey: { $type: 'string' },
        },
    },
);

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
