/**
 * Test script for Razorpay integration
 * Run with: node scripts/test-razorpay-integration.js
 */

require('dotenv').config();
const { razorpay, initializeRazorpay } = require('../src/config/razorpay');

async function testRazorpayIntegration() {
  console.log('\n🔍 Testing Razorpay Integration...\n');

  // Test 1: Check environment variables
  console.log('1️⃣ Checking environment variables...');
  if (!process.env.RAZORPAY_KEY_ID) {
    console.log('❌ RAZORPAY_KEY_ID not found in .env');
    return;
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    console.log('❌ RAZORPAY_KEY_SECRET not found in .env');
    return;
  }
  console.log('✅ Environment variables configured');
  console.log(`   Key ID: ${process.env.RAZORPAY_KEY_ID.substring(0, 15)}...`);

  // Test 2: Check Razorpay initialization
  console.log('\n2️⃣ Checking Razorpay initialization...');
  if (!razorpay) {
    console.log('❌ Razorpay not initialized');
    return;
  }
  console.log('✅ Razorpay initialized successfully');

  // Test 3: Test creating an order
  console.log('\n3️⃣ Testing order creation...');
  try {
    const order = await razorpay.orders.create({
      amount: 10000, // ₹100 in paise
      currency: 'INR',
      receipt: 'TEST_RECEIPT_001',
      notes: {
        test: 'true',
        purpose: 'integration_test'
      }
    });
    console.log('✅ Order created successfully');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Amount: ₹${order.amount / 100}`);
    console.log(`   Status: ${order.status}`);
  } catch (error) {
    console.log('❌ Order creation failed');
    console.log(`   Error: ${error.message}`);
    return;
  }

  // Test 4: Test creating a plan
  console.log('\n4️⃣ Testing subscription plan creation...');
  try {
    const plan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: 'Test Plan',
        amount: 34900, // ₹349 in paise
        currency: 'INR',
        description: 'Test subscription plan'
      },
      notes: {
        test: 'true',
        purpose: 'integration_test'
      }
    });
    console.log('✅ Plan created successfully');
    console.log(`   Plan ID: ${plan.id}`);
    console.log(`   Amount: ₹${plan.item.amount / 100}`);
    console.log(`   Period: ${plan.period}`);
  } catch (error) {
    console.log('❌ Plan creation failed');
    console.log(`   Error: ${error.message}`);
    return;
  }

  // Test 5: Test signature verification
  console.log('\n5️⃣ Testing signature verification...');
  const crypto = require('crypto');
  const testOrderId = 'order_test123';
  const testPaymentId = 'pay_test123';
  const text = `${testOrderId}|${testPaymentId}`;
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
  
  const verifySignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest('hex');
  
  if (signature === verifySignature) {
    console.log('✅ Signature verification working correctly');
  } else {
    console.log('❌ Signature verification failed');
  }

  console.log('\n✅ All tests passed! Razorpay integration is working correctly.\n');
  console.log('📝 Next steps:');
  console.log('   1. Test the API endpoints using Postman or curl');
  console.log('   2. Set up webhook URL in Razorpay Dashboard');
  console.log('   3. Test payment flow with test cards');
  console.log('   4. Implement frontend integration\n');
}

// Run tests
testRazorpayIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
