import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeBooking } from '../booking.serializer.js';
import { serializeCustomerProfile, serializeCustomerSummary } from '../customer.serializer.js';
import { serializeEmployee } from '../employee.serializer.js';
import { serializeNotification, serializeFcmTokenRegistration } from '../notification.serializer.js';
import { serializePayment, serializePaymentInitiation, serializePaymentStatus } from '../payment.serializer.js';
import { serializePayout } from '../payout.serializer.js';
import { serializePhoto } from '../photo.serializer.js';
import { serializeRating } from '../rating.serializer.js';
import { serializeService } from '../service.serializer.js';
import { serializeBarberProfile, serializeShopProfile, serializeShopSummary } from '../shop.serializer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', '..');

const ownIdAliasByResource = {
    booking: ['bookingId'],
    customerSummary: ['customerId'],
    customerProfile: ['customerId'],
    employee: ['employeeId'],
    notification: ['notificationId'],
    fcmToken: ['tokenId'],
    payment: ['paymentId'],
    paymentInitiation: ['paymentId'],
    paymentStatus: ['paymentId'],
    payout: ['payoutId'],
    photo: ['photoId'],
    rating: ['ratingId'],
    service: ['serviceId'],
    shopProfile: ['shopId'],
    shopSummary: ['shopId'],
    barberProfile: ['shopId'],
};

const assertNoOwnIdAliases = (resourceName, payload) => {
    const aliases = Object.keys(payload).filter((key) => ownIdAliasByResource[resourceName]?.includes(key));
    assert.deepEqual(aliases, [], `${resourceName} exposes own-id aliases: ${aliases.join(', ')}`);
};

test('resource serializers expose only id for each resource own identity', () => {
    const id = '507f1f77bcf86cd799439011';
    const shop = {
        _id: id,
        shopName: 'EverCut Studio',
        ownerName: 'Asha Rao',
        ownerFirstName: 'Asha',
        ownerLastName: 'Rao',
        ownerGender: 'female',
        ownerDateOfBirth: '1990-01-01',
        facilities: ['Wi-Fi'],
        availableDays: ['Monday'],
        openTime: '09:00',
        closeTime: '18:00',
        upiId: 'asha@upi',
        accountHolderName: 'Asha Rao',
        bankName: 'Ever Bank',
        coverUrl: 'https://cdn.example/cover.jpg',
        ownerPhotoUrl: 'https://cdn.example/owner.jpg',
    };

    const samples = {
        booking: serializeBooking({ _id: id, date: '2026-05-05', time: '10:00' }),
        customerSummary: serializeCustomerSummary({ _id: id, firstName: 'Mina', lastName: 'Shah' }),
        customerProfile: serializeCustomerProfile({ _id: id, firstName: 'Mina', lastName: 'Shah' }),
        employee: serializeEmployee({ _id: id, firstName: 'Dev', lastName: 'Patel' }),
        notification: serializeNotification({ _id: id, type: 'booking', eventType: 'booking.created', title: 'Title', body: 'Body' }),
        fcmToken: serializeFcmTokenRegistration({ _id: id, userId: id, platform: 'android' }),
        payment: serializePayment({ _id: id, status: 'initiated' }),
        paymentInitiation: serializePaymentInitiation({ payment: { _id: id, merchantOrderId: 'EC-1', amount: 100, amountInRupees: 1 }, bookingId: id }),
        paymentStatus: serializePaymentStatus({ payment: { _id: id, bookingId: id, merchantOrderId: 'EC-1', status: 'initiated' } }),
        payout: serializePayout({ _id: id }),
        photo: serializePhoto({ _id: id, photoUrl: 'https://cdn.example/photo.jpg' }),
        rating: serializeRating({ _id: id, rating: 5 }),
        service: serializeService({ _id: id, serviceName: 'Haircut', serviceType: 'single', duration: 30 }),
        shopProfile: serializeShopProfile(shop, { privateView: true }),
        shopSummary: serializeShopSummary(shop),
        barberProfile: serializeBarberProfile(shop, { email: 'owner@example.com', phoneNumber: '+919999999999' }),
    };

    for (const [resourceName, payload] of Object.entries(samples)) {
        assertNoOwnIdAliases(resourceName, payload);
    }
});

test('serializers do not duplicate populated relation ids beside relation objects', () => {
    const id = '507f1f77bcf86cd799439011';
    const booking = serializeBooking({
        _id: id,
        customerId: { _id: '507f1f77bcf86cd799439012', firstName: 'Mina' },
        shopId: { _id: '507f1f77bcf86cd799439013', shopName: 'EverCut Studio' },
        employeeId: { _id: '507f1f77bcf86cd799439014', firstName: 'Dev' },
        serviceIds: [{ _id: '507f1f77bcf86cd799439015', serviceName: 'Haircut' }],
    });

    assert.ok(booking.customer);
    assert.ok(booking.shop);
    assert.ok(booking.employee);
    assert.ok(booking.services.length > 0);
    assert.equal('customerId' in booking, false);
    assert.equal('shopId' in booking, false);
    assert.equal('employeeId' in booking, false);
    assert.equal('serviceIds' in booking, false);

    const payment = serializePayment({
        _id: id,
        bookingId: { _id: '507f1f77bcf86cd799439016', date: '2026-05-05' },
        customerId: { _id: '507f1f77bcf86cd799439017', firstName: 'Mina' },
        shopId: { _id: '507f1f77bcf86cd799439018', shopName: 'EverCut Studio' },
    });

    assert.ok(payment.booking);
    assert.ok(payment.customer);
    assert.ok(payment.shop);
    assert.equal('bookingId' in payment, false);
    assert.equal('customerId' in payment, false);
    assert.equal('shopId' in payment, false);
});

test('booking serializer adds employee availability for the booking date without exposing blockedDates', () => {
    const booking = serializeBooking({
        _id: '507f1f77bcf86cd799439011',
        date: '2026-06-15',
        time: '10:00',
        employeeId: {
            _id: '507f1f77bcf86cd799439014',
            firstName: 'Dev',
            lastName: 'Patel',
            blockedDates: [new Date('2026-06-15T00:00:00.000Z')],
        },
    });

    assert.equal(booking.employee.isAvailableOnBookingDate, false);
    assert.equal('blockedDates' in booking.employee, false);
});

test('serializers no longer export deprecated API aliases', async () => {
    const shopSerializer = await readFile(path.join(srcDir, 'serializers', 'shop.serializer.js'), 'utf8');
    const barberProfileUtils = await readFile(path.join(srcDir, 'utils', 'barber-profile.utils.js'), 'utf8');
    const coreSerializer = await readFile(path.join(srcDir, 'serializers', 'core.serializer.js'), 'utf8');

    assert.doesNotMatch(shopSerializer, /serializeUpiDetails/);
    assert.doesNotMatch(shopSerializer, /serializePayoutConfig/);
    assert.doesNotMatch(barberProfileUtils, /serializeUpiDetails/);
    assert.doesNotMatch(barberProfileUtils, /serializePayoutConfig/);
    assert.doesNotMatch(coreSerializer, /serializeList/);
});
