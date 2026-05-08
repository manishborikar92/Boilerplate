import mongoose from 'mongoose';

const isPlainObject = (value) => (
    Object.prototype.toString.call(value) === '[object Object]'
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

export const trustQueryOperators = (value) => {
    if (Array.isArray(value)) {
        return value.map(trustQueryOperators);
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const trustedValue = Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [key, trustQueryOperators(nestedValue)]),
    );

    return Object.keys(trustedValue).some((key) => key.startsWith('$'))
        ? mongoose.trusted(trustedValue)
        : trustedValue;
};
