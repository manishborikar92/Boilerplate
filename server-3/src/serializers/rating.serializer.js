import { sanitizeForResponse, toPlainObject } from './core.serializer.js';
import { serializeCustomerSummary } from './customer.serializer.js';

export const serializeRating = (rating) => {
    const plain = sanitizeForResponse(toPlainObject(rating));
    if (!plain) return null;

    return {
        id: plain.id,
        shopId: plain.shopId?.id || plain.shopId || null,
        rating: plain.rating,
        review: plain.review || '',
        user: serializeCustomerSummary(plain.customerId) || {
            firstName: 'Unknown',
            lastName: '',
            photoUrl: null,
        },
        reply: plain.reply?.text
            ? {
                text: plain.reply.text,
                repliedAt: plain.reply.repliedAt,
            }
            : null,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
};
