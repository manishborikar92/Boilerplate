jest.mock('../../src/middleware/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const phoneNumberUtil = require('../../src/utils/phoneNumber');

describe('phoneNumber util', () => {
  it('cleans phone numbers', () => {
    expect(phoneNumberUtil.cleanPhoneNumber('+91-98226 85547')).toBe('919822685547');
    expect(phoneNumberUtil.cleanPhoneNumber(null)).toBe('');
  });

  it('normalizes valid Indian numbers', () => {
    expect(phoneNumberUtil.normalizePhoneNumber('9822685547')).toBe('+919822685547');
    expect(phoneNumberUtil.normalizePhoneNumber('09822685547')).toBe('+919822685547');
    expect(phoneNumberUtil.normalizePhoneNumber('+91 9822685547')).toBe('+919822685547');
  });

  it('returns null for invalid numbers', () => {
    expect(phoneNumberUtil.normalizePhoneNumber('')).toBeNull();
    expect(phoneNumberUtil.normalizePhoneNumber('5123456789')).toBeNull();
  });

  it('validates formats and e164', () => {
    expect(phoneNumberUtil.isValidFormat('+919822685547')).toBe(true);
    expect(phoneNumberUtil.isValidFormat('abc')).toBe(false);
    expect(phoneNumberUtil.isValidE164('+919822685547')).toBe(true);
    expect(phoneNumberUtil.isValidE164('919822685547')).toBe(false);
  });

  it('formats for display', () => {
    expect(phoneNumberUtil.formatForDisplay('+919822685547')).toBe('+91 98226 85547');
    expect(phoneNumberUtil.formatForDisplay('')).toBe('');
  });

  it('batch normalizes', () => {
    const result = phoneNumberUtil.batchNormalize(['9822685547', '']);
    expect(result[0].valid).toBe(true);
    expect(result[1].valid).toBe(false);
  });

  it('extracts country and national numbers', () => {
    expect(phoneNumberUtil.extractCountryCode('+919822685547')).toBe('91');
    expect(phoneNumberUtil.extractNationalNumber('+919822685547')).toBe('9822685547');
  });
});
