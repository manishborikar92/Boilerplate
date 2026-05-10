/**
 * Test script for CA-Flow Email Service Integration
 * 
 * This script tests the email service integration to ensure
 * all email functions work correctly.
 */

require('dotenv').config();
const emailService = require('../src/services/emailService');
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  sendWelcomeEmail,
  sendTaskNotificationEmail,
  sendDocumentRequestEmail,
  testEmailConfiguration
} = require('../src/utils/email');

async function testEmailIntegration() {
  console.log('🧪 Testing CA-Flow Email Service Integration...\n');

  const testEmail = process.argv[2] || 'manishborikar07@gmail.com';
  const testName = 'Test User';

  try {
    // Test 1: Email Configuration
    console.log('1️⃣ Testing email configuration...');
    const configTest = await testEmailConfiguration(testEmail);
    console.log('✅ Configuration test:', configTest.success ? 'PASSED' : 'FAILED');
    if (!configTest.success) {
      console.log('❌ Error:', configTest.error);
    }
    console.log('');

    // Test 2: Verification Email (backward compatibility)
    console.log('2️⃣ Testing verification email (backward compatibility)...');
    try {
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/test-token-123`;
      await sendVerificationEmail(testEmail, testName, verificationUrl);
      console.log('✅ Verification email: SENT');
    } catch (error) {
      console.log('❌ Verification email failed:', error.message);
    }
    console.log('');

    // Test 3: Password Reset Email (backward compatibility)
    console.log('3️⃣ Testing password reset email (backward compatibility)...');
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/test-reset-token-456`;
      await sendPasswordResetEmail(testEmail, testName, resetUrl);
      console.log('✅ Password reset email: SENT');
    } catch (error) {
      console.log('❌ Password reset email failed:', error.message);
    }
    console.log('');

    // Test 4: Welcome Email (new functionality)
    console.log('4️⃣ Testing welcome email (new functionality)...');
    try {
      await sendWelcomeEmail(testEmail, testName, 'CA-Admin');
      console.log('✅ Welcome email: SENT');
    } catch (error) {
      console.log('❌ Welcome email failed:', error.message);
    }
    console.log('');

    // Test 5: Task Notification Email (new functionality)
    console.log('5️⃣ Testing task notification email (new functionality)...');
    try {
      await sendTaskNotificationEmail(
        testEmail, 
        testName, 
        'Q4 Tax Filing', 
        'In Progress', 
        'Your documents have been received and we are processing your tax filing.'
      );
      console.log('✅ Task notification email: SENT');
    } catch (error) {
      console.log('❌ Task notification email failed:', error.message);
    }
    console.log('');

    // Test 6: Document Request Email (new functionality)
    console.log('6️⃣ Testing document request email (new functionality)...');
    try {
      await sendDocumentRequestEmail(
        testEmail, 
        testName, 
        'Annual GST Return', 
        ['Bank Statements', 'Invoice Records', 'Purchase Bills', 'Expense Receipts']
      );
      console.log('✅ Document request email: SENT');
    } catch (error) {
      console.log('❌ Document request email failed:', error.message);
    }
    console.log('');

    // Test 7: Direct Email Service Test
    console.log('7️⃣ Testing direct email service...');
    try {
      await emailService.sendTaskNotificationEmail(
        testEmail,
        testName,
        'Direct Service Test',
        'Completed',
        'This is a direct test of the email service.'
      );
      console.log('✅ Direct email service: SENT');
    } catch (error) {
      console.log('❌ Direct email service failed:', error.message);
    }
    console.log('');

    console.log('🎉 Email integration testing completed!');
    console.log(`📧 Check your email at: ${testEmail}`);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('💡 In development mode, check console for email preview URLs');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
if (require.main === module) {
  testEmailIntegration().then(() => {
    console.log('\n✨ Test script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Test script failed:', error);
    process.exit(1);
  });
}

module.exports = { testEmailIntegration };