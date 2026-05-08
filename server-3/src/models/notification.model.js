import mongoose from 'mongoose';

import {
    ALL_NOTIFICATION_EVENTS,
    ALL_NOTIFICATION_STATUSES,
    ALL_NOTIFICATION_TYPES,
    NOTIFICATION_STATUS,
    NOTIFICATION_TYPE,
} from '../utils/constants.js';

const deliverySchema = new mongoose.Schema(
    {
        successCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        failureCount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false },
);

const notificationSchema = new mongoose.Schema(
    {
        recipientUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        actorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },
        type: {
            type: String,
            enum: ALL_NOTIFICATION_TYPES,
            default: NOTIFICATION_TYPE.HYBRID,
            index: true,
        },
        eventType: {
            type: String,
            enum: ALL_NOTIFICATION_EVENTS,
            required: true,
            index: true,
        },
        title: {
            type: String,
            trim: true,
            maxlength: 120,
            default: null,
        },
        body: {
            type: String,
            trim: true,
            maxlength: 500,
            default: null,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        entityType: {
            type: String,
            trim: true,
            maxlength: 64,
            default: null,
            index: true,
        },
        entityId: {
            type: String,
            trim: true,
            maxlength: 128,
            default: null,
            index: true,
        },
        dedupeKey: {
            type: String,
            trim: true,
            maxlength: 256,
            default: null,
        },
        status: {
            type: String,
            enum: ALL_NOTIFICATION_STATUSES,
            default: NOTIFICATION_STATUS.QUEUED,
            index: true,
        },
        delivery: {
            type: deliverySchema,
            default: () => ({ successCount: 0, failureCount: 0 }),
        },
        deliveredAt: {
            type: Date,
            default: null,
        },
        readAt: {
            type: Date,
            default: null,
            index: true,
        },
        failureReason: {
            type: String,
            default: null,
            maxlength: 512,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

notificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, eventType: 1, createdAt: -1 });
notificationSchema.index(
    { dedupeKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            dedupeKey: { $type: 'string' },
        },
    },
);
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
