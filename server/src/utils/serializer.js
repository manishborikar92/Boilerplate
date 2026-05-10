const INTERNAL_KEYS = new Set(['__v', '$__', '$isNew', '$locals', '_doc']);
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'refreshToken',
  'refreshTokenHash',
  'token',
  'secret',
  'apiKey',
  'privateKey',
]);

const isObjectIdLike = (value) => (
  value
  && typeof value === 'object'
  && (typeof value.toHexString === 'function' || value._bsontype === 'ObjectId')
);

const toPlainObject = (value) => {
  if (value && typeof value.toObject === 'function') {
    return value.toObject({
      versionKey: false,
      virtuals: false,
      getters: false,
      transform: false,
    });
  }

  if (value && typeof value === 'object' && value._doc) {
    return value._doc;
  }

  return value;
};

const shouldDropKey = (key) => (
  INTERNAL_KEYS.has(key)
  || SENSITIVE_KEYS.has(key)
  || key.startsWith('$')
);

export const serialize = (value, seen = new WeakSet()) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (isObjectIdLike(value)) return value.toHexString ? value.toHexString() : String(value);
  if (typeof value !== 'object') return value;

  const plain = toPlainObject(value);
  if (plain !== value) return serialize(plain, seen);

  if (Array.isArray(value)) {
    return value
      .map((item) => serialize(item, seen))
      .filter((item) => item !== undefined);
  }

  if (value instanceof Map) {
    return serialize(Object.fromEntries(value.entries()), seen);
  }

  if (seen.has(value)) return undefined;
  seen.add(value);

  const output = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (shouldDropKey(key)) continue;

    const outputKey = key === '_id' ? 'id' : key;
    const serialized = serialize(nestedValue, seen);
    if (serialized !== undefined) {
      output[outputKey] = serialized;
    }
  }

  return output;
};
