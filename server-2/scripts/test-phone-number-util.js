/**
 * Test Phone Number Utility
 * Tests phone number normalization with various formats
 */

require('dotenv').config();
const phoneNumberUtil = require('../src/utils/phoneNumber');

console.log('='.repeat(80));
console.log('PHONE NUMBER UTILITY TEST');
console.log('='.repeat(80));
console.log();

// Test cases with various formats
const testCases = [
  // Indian formats with +91
  '+91 9822685547',
  '+919822685547',
  '+91-9822685547',
  '+91(9822685547)',
  
  // Indian formats with 91 (no +)
  '91 9822685547',
  '919822685547',
  '91-9822685547',
  
  // Indian formats without country code
  '9822685547',
  '09822685547',
  '9822 685 547',
  '9822-685-547',
  '(9822) 685547',
  
  // Edge cases
  '  +91 9822685547  ', // With spaces
  '+91  9822  685  547', // Multiple spaces
  
  // Invalid cases
  '123456', // Too short
  '12345678901234567890', // Too long
  '5822685547', // Invalid Indian prefix (should start with 6-9)
  'abcd1234567890', // Contains letters
  '+1 2025551234', // US number (should work if country code is valid)
];

console.log('Testing phone number normalization:\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: "${testCase}"`);
  
  // Test validation
  const isValid = phoneNumberUtil.isValidFormat(testCase);
  console.log(`  ✓ Valid format: ${isValid}`);
  
  // Test normalization
  const normalized = phoneNumberUtil.normalizePhoneNumber(testCase);
  console.log(`  ✓ Normalized: ${normalized || 'null (invalid)'}`);
  
  // Test E.164 validation
  if (normalized) {
    const isE164 = phoneNumberUtil.isValidE164(normalized);
    console.log(`  ✓ Valid E.164: ${isE164}`);
    
    // Test display format
    const display = phoneNumberUtil.formatForDisplay(normalized);
    console.log(`  ✓ Display format: ${display}`);
    
    // Extract components
    const countryCode = phoneNumberUtil.extractCountryCode(normalized);
    const nationalNumber = phoneNumberUtil.extractNationalNumber(normalized);
    console.log(`  ✓ Country code: ${countryCode}`);
    console.log(`  ✓ National number: ${nationalNumber}`);
  }
  
  console.log();
});

// Test batch normalization
console.log('='.repeat(80));
console.log('BATCH NORMALIZATION TEST');
console.log('='.repeat(80));
console.log();

const batchNumbers = [
  '+91 9822685547',
  '919876543210',
  '9988776655',
  'invalid',
  '123'
];

console.log('Batch normalizing:', batchNumbers);
console.log();

const batchResults = phoneNumberUtil.batchNormalize(batchNumbers);
batchResults.forEach((result, index) => {
  console.log(`${index + 1}. Original: "${result.original}"`);
  console.log(`   Normalized: ${result.normalized || 'null'}`);
  console.log(`   Valid: ${result.valid}`);
  console.log();
});

// Test with Twilio service
console.log('='.repeat(80));
console.log('TWILIO SERVICE INTEGRATION TEST');
console.log('='.repeat(80));
console.log();

const twilioService = require('../src/services/twilioService');

const twilioTestNumbers = [
  '+91 9822685547',
  '919822685547',
  '9822685547'
];

console.log('Testing Twilio formatPhoneNumber method:\n');

twilioTestNumbers.forEach((number, index) => {
  const formatted = twilioService.formatPhoneNumber(number);
  console.log(`${index + 1}. Input: "${number}"`);
  console.log(`   Twilio formatted: ${formatted || 'null'}`);
  console.log();
});

console.log('='.repeat(80));
console.log('TEST COMPLETED');
console.log('='.repeat(80));
