import mongoose from 'mongoose';
import { ALL_GENDERS } from '../utils/constants.js';

/**
 * Employee model - linked to a Shop via shopId.
 */
const employeeSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            enum: ALL_GENDERS,
            required: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        photoUrl: {
            type: String,
            default: null,
        },
        cloudinaryId: {
            type: String,
            default: null,
        },
        workingHours: {
            start: { type: String },
            end: { type: String },
        },
        bookedSlots: [
            {
                date: { type: String },
                time: { type: String },
            },
        ],
        bookedRanges: [
            {
                bookingId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Booking',
                },
                date: { type: String, required: true },
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
                startMinute: { type: Number, required: true, min: 0, max: 1439 },
                endMinute: { type: Number, required: true, min: 1, max: 1440 },
                _id: false,
            },
        ],
        blockedDates: [{ type: Date }],
        isActive: {
            type: Boolean,
            default: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
employeeSchema.index({ shopId: 1, isActive: 1 });
employeeSchema.index({ 'bookedRanges.date': 1, 'bookedRanges.startMinute': 1, 'bookedRanges.endMinute': 1 });
employeeSchema.index({ 'bookedRanges.bookingId': 1 });
employeeSchema.index(
    { shopId: 1, phoneNumber: 1 },
    {
        unique: true,
        partialFilterExpression: {
            deletedAt: null,
        },
    },
);

// ---------------------------------------------------------------------------
// Soft-delete query middleware
// ---------------------------------------------------------------------------
employeeSchema.pre(/^(find|count)/, function () {
    if (!this.getOptions()?.includeDeleted) {
        this.where({ deletedAt: null });
    }
});

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
