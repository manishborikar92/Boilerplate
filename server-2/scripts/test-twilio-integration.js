/**
 * Test Twilio Integration
 * Tests SMS and WhatsApp notification functionality
 * 
 * Usage:
 *   node scripts/test-twilio-integration.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const twilioService = require('../src/services/twilioService');
const smsNotificationService = require('../src/services/smsNotificationService');
const whatsappNotificationService = require('../src/services/whatsappNotificationService');

// Test phone number (replace with your test number)
const TEST_PHONE_NUMBER = process.env.TEST_PHONE_NUMBER || '+919876543210';

async function testTwilioIntegration() {
  console.log('🧪 Testing Twilio Integration...\n');

  try {
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ca-flow');
    console.log('✅ Connected to MongoDB\n');

    // Test 1: Check Twilio Configuration
    console.log('='.repeat(60));
    console.log('TEST 1: Twilio Configuration');
    console.log('='.repeat(60));
    
    const twilioConfig = require('../src/config/twilio');
    console.log('Account SID:', twilioConfig.accountSid ? '✅ Configured' : '❌ Missing');
    console.log('Auth Token:', twilioConfig.authToken ? '✅ Configured' : '❌ Missing');
    console.log('SMS Number:', twilioConfig.phoneNumber || '❌ Not configured');
    console.log('WhatsApp Number:', twilioConfig.whatsappNumber || '❌ Not configured');
    console.log('');

    if (!twilioConfig.isConfigured()) {
      console.log('⚠️  Twilio is not fully configured. Please set:');
      console.log('   - TWILIO_ACCOUNT_SID');
      console.log('   - TWILIO_AUTH_TOKEN');
      console.log('   - TWILIO_PHONE_NUMBER');
      console.log('   - TWILIO_WHATSAPP_NUMBER (optional)\n');
      process.exit(1);
    }

    // Test 2: Send Test SMS
    console.log('='.repeat(60));
    console.log('TEST 2: Send Test SMS');
    console.log('='.repeat(60));
    console.log(`Sending test SMS to: ${TEST_PHONE_NUMBER}`);
    
    const smsResult = await twilioService.testSMS(TEST_PHONE_NUMBER);
    
    if (smsResult.success) {
      console.log('✅ SMS sent successfully!');
      console.log(`   Message ID: ${smsResult.messageId}`);
    } else {
      console.log('❌ SMS failed:', smsResult.error);
    }
    console.log('');

    // Test 3: Send Test WhatsApp (if configured)
    if (twilioConfig.isWhatsAppConfigured()) {
      console.log('='.repeat(60));
      console.log('TEST 3: Send Test WhatsApp');
      console.log('='.repeat(60));
      console.log(`Sending test WhatsApp to: ${TEST_PHONE_NUMBER}`);
      
      const whatsappResult = await twilioService.testWhatsApp(TEST_PHONE_NUMBER);
      
      if (whatsappResult.success) {
        console.log('✅ WhatsApp sent successfully!');
        console.log(`   Message ID: ${whatsappResult.messageId}`);
      } else {
        console.log('❌ WhatsApp failed:', whatsappResult.error);
      }
      console.log('');
    } else {
      console.log('='.repeat(60));
      console.log('TEST 3: WhatsApp Configuration');
      console.log('='.repeat(60));
      console.log('⚠️  WhatsApp not configured (optional)');
      console.log('   Set TWILIO_WHATSAPP_NUMBER to enable WhatsApp notifications\n');
    }

    // Test 4: Test Notification Services
    console.log('='.repeat(60));
    console.log('TEST 4: Notification Services');
    console.log('='.repeat(60));
    
    // Create a mock notification object
    const mockNotification = {
      _id: new mongoose.Types.ObjectId(),
      type: 'payment',
      subtype: 'payment_received',
      priority: 'high',
      title: 'Test Payment Notification',
      message: 'This is a test payment notification from CA-Flow',
      recipientId: new mongoose.Types.ObjectId(),
      firmId: new mongoose.Types.ObjectId(),
      metadata: {
        amount: 50000,
        amountInRupees: '500.00',
        clientName: 'Test Client',
        paymentType: 'invoice'
      },
      actionUrl: '/app/settings?tab=payments',
      actionLabel: 'View Payment',
      createdAt: new Date()
    };

    console.log('Mock notification created:');
    console.log(`  Type: ${mockNotification.type}`);
    console.log(`  Priority: ${mockNotification.priority}`);
    console.log(`  Title: ${mockNotification.title}`);
    console.log('');

    // Test SMS formatting
    console.log('📱 SMS Message Format:');
    console.log('-'.repeat(60));
    const smsMessage = smsNotificationService.formatSMSMessage(mockNotification);
    console.log(smsMessage);
    console.log('-'.repeat(60));
    console.log(`Length: ${smsMessage.length} characters\n`);

    // Test WhatsApp formatting
    console.log('💬 WhatsApp Message Format:');
    console.log('-'.repeat(60));
    const whatsappMessage = whatsappNotificationService.formatWhatsAppMessage(
      mockNotification,
      'Test User'
    );
    console.log(whatsappMessage);
    console.log('-'.repeat(60));
    console.log(`Length: ${whatsappMessage.length} characters\n`);

    // Test 5: Subscription Service Integration
    console.log('='.repeat(60));
    console.log('TEST 5: Subscription Service Integration');
    console.log('='.repeat(60));
    
    const subscriptionService = require('../src/services/subscriptionService');
    
    // Test with a mock firm ID
    const mockFirmId = new mongoose.Types.ObjectId();
    
    console.log('Testing notification channel permissions:');
    console.log(`  Email: ${await subscriptionService.isNotificationChannelAllowed(mockFirmId, 'email') ? '✅' : '❌'}`);
    console.log(`  SMS: ${await subscriptionService.isNotificationChannelAllowed(mockFirmId, 'sms') ? '✅' : '❌'}`);
    console.log(`  WhatsApp: ${await subscriptionService.isNotificationChannelAllowed(mockFirmId, 'whatsapp') ? '✅' : '❌'}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
    console.log('\n📝 Next Steps:');
    console.log('1. Check your phone for test messages');
    console.log('2. Verify SMS and WhatsApp delivery');
    console.log('3. Update .env with correct Twilio credentials if needed');
    console.log('4. Test with real notifications in the application\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run tests
testTwilioIntegration();
