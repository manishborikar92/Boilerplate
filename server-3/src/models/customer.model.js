import mongoose from 'mongoose';
import { ALL_GENDERS } from '../utils/constants.js';

/**
 * Customer-specific data.
 *
 * Linked 1:1 to a User with roleType 'CUSTOMER'.
 * This separates customer-specific fields (name, DOB, photo, favourites)
 * from the core identity table – following the Persona-Based pattern.
 */
const customerSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
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
        gender: {
            type: String,
            enum: ALL_GENDERS,
            required: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        photoUrl: {
            type: String,
            default: null,
        },
        cloudinaryId: {
            type: String,
            default: null,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true,
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
            },
        },
        favoriteBookings: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking',
            },
        ],
        favoriteShops: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Shop',
            },
        ],
    },
    { timestamps: true },
);

// Geospatial index for location-based queries
customerSchema.index({ location: '2dsphere' });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
