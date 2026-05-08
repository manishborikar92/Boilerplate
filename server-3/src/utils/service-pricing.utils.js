const toFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

export const calculateDiscountedPrice = (actualPrice, offerPrice = 0) => {
    const normalizedActualPrice = toFiniteNumber(actualPrice) ?? 0;
    const normalizedOfferPrice = toFiniteNumber(offerPrice) ?? 0;
    return normalizedActualPrice - normalizedOfferPrice;
};

export const getEffectiveServicePrice = (service = {}) => {
    const finalPrice = toFiniteNumber(service.finalPrice);
    if (finalPrice !== null) return finalPrice;

    const totalPrice = toFiniteNumber(service.totalPrice);
    if (totalPrice !== null) return totalPrice;

    const actualPrice = toFiniteNumber(service.actualPrice);
    if (actualPrice !== null) {
        return calculateDiscountedPrice(actualPrice, service.offerPrice);
    }

    return null;
};

export const normalizeServicePricing = (service) => {
    const normalized = typeof service?.toObject === 'function'
        ? service.toObject()
        : { ...service };

    const effectivePrice = getEffectiveServicePrice(normalized);
    if (effectivePrice !== null && normalized.finalPrice == null) {
        normalized.finalPrice = effectivePrice;
    }

    if (normalized.serviceType === 'bundled' && effectivePrice !== null && normalized.totalPrice == null) {
        normalized.totalPrice = effectivePrice;
    }

    if (normalized.offerPrice == null) {
        normalized.offerPrice = 0;
    }

    return normalized;
};
