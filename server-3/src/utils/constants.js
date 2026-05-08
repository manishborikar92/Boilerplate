/**
 * Application-wide constants and enum-like values.
 * Import from here instead of scattering magic strings.
 */

// ---------------------------------------------------------------------------
// User Roles
// ---------------------------------------------------------------------------

export const ROLES = Object.freeze({
    CUSTOMER: 'CUSTOMER',
    BARBER: 'BARBER',
    ADMIN: 'ADMIN',
});

export const ALL_ROLES = Object.values(ROLES);

// ---------------------------------------------------------------------------
// Booking Statuses
// ---------------------------------------------------------------------------

export const BOOKING_STATUS = Object.freeze({
    PENDING: 'pending',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no-show',
});

export const ALL_BOOKING_STATUSES = Object.values(BOOKING_STATUS);

export const BOOKING_MILESTONE_TARGETS = Object.freeze([500, 750, 1000]);

// ---------------------------------------------------------------------------
// Payment Statuses
// ---------------------------------------------------------------------------

export const PAYMENT_STATUS = Object.freeze({
    PENDING: 'pending',
    INITIATED: 'initiated',
    SUCCESS: 'success',
    FAILED: 'failed',
    REFUND_PENDING: 'refund_pending',
    REFUNDED: 'refunded',
    REFUND_FAILED: 'refund_failed',
});

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

export const PAYMENT_TRANSACTION_STATUS = Object.freeze({
    INITIATED: 'initiated',
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'expired',
    REFUND_PENDING: 'refund_pending',
    REFUNDED: 'refunded',
    REFUND_FAILED: 'refund_failed',
});

export const ALL_PAYMENT_TRANSACTION_STATUSES = Object.values(PAYMENT_TRANSACTION_STATUS);

export const PAYOUT_STATUS = Object.freeze({
    NOT_INITIATED: 'not_initiated',
    INITIATED: 'initiated',
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REVERSED: 'reversed',
});

export const ALL_PAYOUT_STATUSES = Object.values(PAYOUT_STATUS);

export const PAYOUT_TRANSACTION_STATUS = Object.freeze({
    INITIATED: 'INITIATED',
    PENDING: 'PENDING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    REVERSED: 'REVERSED',
});

export const ALL_PAYOUT_TRANSACTION_STATUSES = Object.values(PAYOUT_TRANSACTION_STATUS);

export const PHONEPE_WEBHOOK_EVENTS = Object.freeze({
    ORDER_COMPLETED: 'checkout.order.completed',
    ORDER_FAILED: 'checkout.order.failed',
    REFUND_COMPLETED: 'pg.refund.completed',
    REFUND_FAILED: 'pg.refund.failed',
});

export const CASHFREE_WEBHOOK_EVENTS = Object.freeze({
    TRANSFER_SUCCESS: 'TRANSFER_SUCCESS',
    TRANSFER_FAILED: 'TRANSFER_FAILED',
    TRANSFER_REVERSED: 'TRANSFER_REVERSED',
});

export const PAYMENT_GATEWAYS = Object.freeze({
    PHONEPE: 'phonepe',
    RAZORPAY: 'razorpay',
    CASHFREE: 'cashfree',
    MANUAL: 'manual',
});

export const PAYOUT_MODES = Object.freeze({
    UPI: 'upi',
    IMPS: 'imps',
    NEFT: 'neft',
    RTGS: 'rtgs',
    BANK: 'banktransfer',
});

export const PLATFORM_FEES = Object.freeze({
    SINGLE_SERVICE: 3,
    BUNDLE: 10,
});

export const REFUND_FEES = Object.freeze({
    SINGLE_SERVICE: 7,
    BUNDLE: 15,
});

// ---------------------------------------------------------------------------
// Booking Limits
// ---------------------------------------------------------------------------

export const BOOKING_LIMITS = Object.freeze({
    MAX_SERVICES_PER_BOOKING: 10,      // Maximum 10 services/bundles per booking
    MAX_BOOKING_DURATION_MINUTES: 480, // Maximum 8 hours per booking
    MAX_ADVANCE_BOOKING_DAYS: 7,       // Maximum 7 days in advance
});

// ---------------------------------------------------------------------------
// Bundle Rules
// ---------------------------------------------------------------------------

export const BUNDLE_RULES = Object.freeze({
    MIN_SERVICE_AMOUNT: 300,
});

// ---------------------------------------------------------------------------
// Shop Categories
// ---------------------------------------------------------------------------

export const SHOP_CATEGORY = Object.freeze({
    SALON: 'Salon',
    BEAUTY_PARLOUR: 'Beauty Parlour',
    BARBER: 'Barber',
    DOOR_STEP: 'Door-Step',
});

export const ALL_SHOP_CATEGORIES = Object.values(SHOP_CATEGORY);

// ---------------------------------------------------------------------------
// Shop Amenities
// ---------------------------------------------------------------------------

export const SHOP_AMENITY = Object.freeze({
    AIR_CONDITIONING: 'Air Conditioning',
    WAITING_AREA: 'Waiting Area',
    DRINKING_WATER: 'Drinking Water',
    WASHROOMS: 'Washrooms',
    PARKING_AREA: 'Parking Area',
    WIFI: 'Wi-Fi',
    CHARGING_POINTS: 'Charging Points',
});

export const ALL_SHOP_AMENITIES = Object.values(SHOP_AMENITY);

// ---------------------------------------------------------------------------
// Days of Week
// ---------------------------------------------------------------------------

export const DAYS_OF_WEEK = Object.freeze([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
]);

// ---------------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------------

export const SERVICE_TYPE = Object.freeze({
    SINGLE: 'single',
    BUNDLED: 'bundled',
});

export const ALL_SERVICE_TYPES = Object.values(SERVICE_TYPE);

// ---------------------------------------------------------------------------
// Service Gender
// ---------------------------------------------------------------------------

export const SERVICE_FOR = Object.freeze({
    MALE: 'male',
    FEMALE: 'female',
    UNISEX: 'unisex',
});

export const ALL_SERVICE_FOR = Object.values(SERVICE_FOR);

// ---------------------------------------------------------------------------
// Photo Types
// ---------------------------------------------------------------------------

export const PHOTO_TYPE = Object.freeze({
    SHOP_INTERIOR: 'shop_interior',
    SHOP_EXTERIOR: 'shop_exterior',
    WORK_SAMPLE: 'work_sample',
    TEAM_PHOTO: 'team_photo',
    CERTIFICATE: 'certificate',
    OTHER: 'other',
});

export const ALL_PHOTO_TYPES = Object.values(PHOTO_TYPE);

// ---------------------------------------------------------------------------
// Gender
// ---------------------------------------------------------------------------

export const GENDER = Object.freeze({
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
});

export const ALL_GENDERS = Object.values(GENDER);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPE = Object.freeze({
    PUSH: 'push',
    SILENT: 'silent',
    HYBRID: 'hybrid',
});

export const ALL_NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE);

export const NOTIFICATION_STATUS = Object.freeze({
    QUEUED: 'queued',
    SENT: 'sent',
    PARTIAL: 'partial',
    FAILED: 'failed',
    SKIPPED: 'skipped',
});

export const ALL_NOTIFICATION_STATUSES = Object.values(NOTIFICATION_STATUS);

export const FCM_PLATFORM = Object.freeze({
    ANDROID: 'android',
    IOS: 'ios',
    WEB: 'web',
    UNKNOWN: 'unknown',
});

export const ALL_FCM_PLATFORMS = Object.values(FCM_PLATFORM);

export const NOTIFICATION_EVENT = Object.freeze({
    BOOKING_AWAITING_CONFIRMATION: 'booking.awaiting_confirmation',
    BOOKING_CONFIRMED: 'booking.confirmed',
    BOOKING_CANCELLED: 'booking.cancelled',
    BOOKING_COMPLETED: 'booking.completed',
    BOOKING_NO_SHOW: 'booking.no_show',
    BOOKING_AUTO_CANCELLED: 'booking.auto_cancelled',
    BOOKING_EMPLOYEE_UNAVAILABLE: 'booking.employee_unavailable',
    PAYMENT_FAILED: 'payment.failed',
    PAYMENT_REFUND_PENDING: 'payment.refund_pending',
    PAYMENT_REFUNDED: 'payment.refunded',
    PAYMENT_REFUND_FAILED: 'payment.refund_failed',
    RATING_RECEIVED: 'rating.received',
    RATING_REPLY: 'rating.reply',
    ACCOUNT_UPDATED: 'account.updated',
    SHOP_STATUS_UPDATED: 'shop.status_updated',
    PAYOUT_COMPLETED: 'payout.completed',
    PAYOUT_FAILED: 'payout.failed',
    SYSTEM_ALERT: 'system.alert',
    CHAT_MESSAGE: 'chat.message',
});

export const ALL_NOTIFICATION_EVENTS = Object.values(NOTIFICATION_EVENT);

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export const SECURITY_PIN_LENGTH = 4;

// ---------------------------------------------------------------------------
// OTP Rate Limiting
// ---------------------------------------------------------------------------
// Used by otp-rate-limiter.middleware.js.
// OTP length and expiry are configured via msg91.config.js,
// not duplicated here.

export const OTP_RATE_LIMIT = Object.freeze({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxSendPerPhone: 5,
    maxSendPerIp: 10,
    maxVerifyPerPhone: 10,
});

// ---------------------------------------------------------------------------
// Token Types
// ---------------------------------------------------------------------------

export const TOKEN_TYPE = Object.freeze({
    ONBOARDING: 'onboarding',
    ACCESS: 'access',
    REFRESH: 'refresh',
});

// ---------------------------------------------------------------------------
// Miscellaneous
// ---------------------------------------------------------------------------

export const MAX_RESCHEDULE_COUNT = 1;
export const CANCELLATION_WINDOW_HOURS = 2;
export const NEARBY_DISTANCE_METERS = 2000;
export const MAX_PHOTOS_PER_SHOP = 10;
