/**
 * Phone Number Utility
 * Handles phone number validation, normalization, and formatting for Twilio
 * Supports multiple input formats with or without country code
 */

const { logger } = require('../middleware/logger');

class PhoneNumberUtil {
  constructor() {
    // Default country code for India
    this.defaultCountryCode = '91';
    
    // Valid country codes (can be extended)
    this.validCountryCodes = ['91', '1', '44', '61', '971']; // India, US, UK, Australia, UAE
  }

  /**
   * Clean phone number - remove all non-digit characters
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} Cleaned phone number (digits only)
   */
  cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return '';
    }
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * Normalize phone number to E.164 format
   * Handles multiple input formats:
   * - +91 9822685547
   * - +919822685547
   * - 91 9822685547
   * - 919822685547
   * - 9822685547
   * - 09822685547
   * 
   * @param {string} phoneNumber - Phone number in any format
   * @param {string} defaultCountryCode - Default country code (default: '91' for India)
   * @returns {string|null} Normalized phone number in E.164 format (+919822685547) or null if invalid
   */
  normalizePhoneNumber(phoneNumber, defaultCountryCode = this.defaultCountryCode) {
    try {
      if (!phoneNumber) {
        return null;
      }

      // Clean the phone number (remove all non-digits)
      let cleaned = this.cleanPhoneNumber(phoneNumber);

      if (!cleaned) {
        logger.warn('Phone number is empty after cleaning', { original: phoneNumber });
        return null;
      }

      // Remove leading zeros (common in Indian format: 09822685547)
      while (cleaned.startsWith('0') && cleaned.length > 10) {
        cleaned = cleaned.substring(1);
      }

      // Determine if country code is present
      let countryCode = defaultCountryCode;
      let nationalNumber = cleaned;

      // Check if number starts with a valid country code
      for (const code of this.validCountryCodes) {
        if (cleaned.startsWith(code)) {
          // Extract country code and national number
          countryCode = code;
          nationalNumber = cleaned.substring(code.length);
          break;
        }
      }

      // Validate national number length (should be 10 digits for India)
      if (countryCode === '91') {
        if (nationalNumber.length !== 10) {
          logger.warn('Invalid Indian phone number length', {
            original: phoneNumber,
            cleaned,
            nationalNumber,
            length: nationalNumber.length
          });
          return null;
        }

        // Validate Indian mobile number (should start with 6, 7, 8, or 9)
        if (!/^[6-9]/.test(nationalNumber)) {
          logger.warn('Invalid Indian mobile number prefix', {
            original: phoneNumber,
            nationalNumber
          });
          return null;
        }
      }

      // Construct E.164 format: +{countryCode}{nationalNumber}
      const e164Number = `+${countryCode}${nationalNumber}`;

      logger.debug('Phone number normalized', {
        original: phoneNumber,
        normalized: e164Number,
        countryCode,
        nationalNumber
      });

      return e164Number;
    } catch (error) {
      logger.error('Error normalizing phone number', {
        error: error.message,
        phoneNumber
      });
      return null;
    }
  }

  /**
   * Validate phone number format (before normalization)
   * Accepts various formats with or without country code
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} True if valid format
   */
  isValidFormat(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // Allow digits, +, -, spaces, parentheses, and dots
    const formatRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    
    if (!formatRegex.test(phoneNumber)) {
      return false;
    }

    // Additional validation: must have at least 10 digits
    const cleaned = this.cleanPhoneNumber(phoneNumber);
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  /**
   * Validate normalized phone number (E.164 format)
   * @param {string} phoneNumber - Phone number in E.164 format
   * @returns {boolean} True if valid E.164 format
   */
  isValidE164(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // E.164 format: +{1-3 digit country code}{4-14 digit number}
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  /**
   * Format phone number for display (Indian format)
   * Converts +919822685547 to +91 98226 85547
   * @param {string} phoneNumber - Phone number in E.164 format
   * @returns {string} Formatted phone number for display
   */
  formatForDisplay(phoneNumber) {
    try {
      if (!phoneNumber) {
        return '';
      }

      // If already formatted, return as-is
      if (phoneNumber.includes(' ') || phoneNumber.includes('-')) {
        return phoneNumber;
      }

      // Normalize first
      const normalized = this.normalizePhoneNumber(phoneNumber);
      if (!normalized) {
        return phoneNumber;
      }

      // Extract country code and national number
      const countryCode = this.extractCountryCode(normalized);
      const nationalNumber = this.extractNationalNumber(normalized);

      if (!countryCode || !nationalNumber) {
        return phoneNumber;
      }

      // Format Indian numbers: +91 98226 85547
      if (countryCode === '91' && nationalNumber.length === 10) {
        return `+${countryCode} ${nationalNumber.substring(0, 5)} ${nationalNumber.substring(5)}`;
      }

      // Default format: +{code} {number}
      return `+${countryCode} ${nationalNumber}`;
    } catch (error) {
      logger.error('Error formatting phone number for display', {
        error: error.message,
        phoneNumber
      });
      return phoneNumber;
    }
  }

  /**
   * Batch normalize phone numbers
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   * @param {string} defaultCountryCode - Default country code
   * @returns {Array<Object>} Array of {original, normalized, valid}
   */
  batchNormalize(phoneNumbers, defaultCountryCode = this.defaultCountryCode) {
    return phoneNumbers.map(phone => {
      const normalized = this.normalizePhoneNumber(phone, defaultCountryCode);
      return {
        original: phone,
        normalized,
        valid: normalized !== null
      };
    });
  }

  /**
   * Extract country code from phone number
   * @param {string} phoneNumber - Phone number
   * @returns {string|null} Country code or null
   */
  extractCountryCode(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return null;
    }

    // Match country code (1-3 digits after +)
    const match = normalized.match(/^\+(\d{1,3})/);
    if (!match) {
      return null;
    }

    // For known country codes, return the correct one
    const fullNumber = normalized.substring(1); // Remove +
    for (const code of this.validCountryCodes) {
      if (fullNumber.startsWith(code)) {
        return code;
      }
    }

    // Default to first 1-3 digits
    return match[1];
  }

  /**
   * Extract national number from phone number
   * @param {string} phoneNumber - Phone number
   * @returns {string|null} National number or null
   */
  extractNationalNumber(phoneNumber) {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    if (!normalized) {
      return null;
    }

    const countryCode = this.extractCountryCode(phoneNumber);
    if (!countryCode) {
      return null;
    }

    // Remove + and country code to get national number
    return normalized.substring(1 + countryCode.length);
  }
}

// Export singleton instance
const phoneNumberUtil = new PhoneNumberUtil();

module.exports = phoneNumberUtil;
