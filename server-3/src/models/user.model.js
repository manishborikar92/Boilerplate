import mongoose from 'mongoose';
import { ROLES, ALL_ROLES } from '../utils/constants.js';

/**
 * Core identity table — shared by ALL roles (Persona-Based / Type 4).
 *
 * This stores ONLY authentication-level data. Role-specific profile data
 * lives in separate models (Customer for CUSTOMER, Shop for BARBER).
 */
const userSchema = new mongoose.Schema(
    {
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        roleType: {
            type: String,
            required: true,
            enum: ALL_ROLES,
            default: ROLES.CUSTOMER,
        },
        refreshTokenHash: {
            type: String,
            default: null,
            select: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
            default: null,
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
userSchema.index({ roleType: 1, isActive: 1 });

// ---------------------------------------------------------------------------
// Query helpers — automatically exclude soft-deleted
// ---------------------------------------------------------------------------
userSchema.pre(/^find/, function () {
    // Only auto-filter if not explicitly including deleted records
    if (!this.getOptions()?.includeDeleted) {
        this.where({ deletedAt: null });
    }
});

const User = mongoose.model('User', userSchema);
export default User;
