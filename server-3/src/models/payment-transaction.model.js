import mongoose from 'mongoose';

import { ALL_PAYMENT_TRANSACTION_STATUSES } from '../utils/constants.js';

const refundRecordSchema = new mongoose.Schema(
    {
        merchantRefundId: {
            type: String,
            default: null,
            maxlength: 63,
        },
        gatewayRefundId: {
            type: String,
            default: null,
        },
        amount: {
            type: Number,
            default: null,
        },
        refundFee: {
            type: Number,
            default: null,
        },
        platformFee: {
            type: Number,
            default: null,
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: null,
        },
        type: {
            type: String,
            enum: ['cancellation', 'manual'],
            default: 'cancellation',
        },
        initiatedAt: {
            type: Date,
            default: null,
        },
        completedAt: {
            type: Date,
            default: null,
        },
        reason: {
            type: String,
            default: null,
        },
        failureReason: {
            type: String,
            default: null,
        },
        manualResolutionRequired: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false },
);

const paymentTransactionSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true,
        },
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
        },
        merchantOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        gatewayOrderId: {
            type: String,
            default: null,
            index: true,
        },
        gatewayTransactionId: {
            type: String,
            default: null,
        },
        sdkOrderToken: {
            type: String,
            default: null,
        },
        sdkOrderTokenIssued: {
            type: Boolean,
            default: false,
        },
        sdkOrderTokenIssuedAt: {
            type: Date,
            default: null,
        },
        amount: {
            type: Number,
            required: true,
            min: 100,
        },
        amountInRupees: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        status: {
            type: String,
            enum: ALL_PAYMENT_TRANSACTION_STATUSES,
            default: 'initiated',
            index: true,
        },
        gatewayState: {
            type: String,
            default: null,
        },
        paymentMode: {
            type: String,
            default: null,
        },
        paymentInstrument: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        rail: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        refund: {
            type: refundRecordSchema,
            default: null,
        },
        settlement: {
            serviceAmount: {
                type: Number,
                default: null,
            },
            platformFee: {
                type: Number,
                default: null,
            },
            barberPayout: {
                type: Number,
                default: null,
            },
            isBundle: {
                type: Boolean,
                default: false,
            },
            settled: {
                type: Boolean,
                default: false,
            },
            settledAt: {
                type: Date,
                default: null,
            },
            _id: false,
        },
        refundFee: {
            type: Number,
            default: null,
        },
        errorCode: {
            type: String,
            default: null,
        },
        detailedErrorCode: {
            type: String,
            default: null,
        },
        errorSource: {
            type: String,
            default: null,
        },
        errorStage: {
            type: String,
            default: null,
        },
        errorDescription: {
            type: String,
            default: null,
        },
        gatewayResponse: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        webhookReceivedAt: {
            type: Date,
            default: null,
        },
        statusPolledAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        webhookProcessed: {
            type: Boolean,
            default: false,
        },
        webhookEventId: {
            type: String,
            default: null,
        },
        pollAttempts: {
            type: Number,
            default: 0,
        },
        lastPollAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        collection: 'payment_transactions',
    },
);

paymentTransactionSchema.index({ status: 1, createdAt: 1 });
paymentTransactionSchema.index({ bookingId: 1, status: 1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
