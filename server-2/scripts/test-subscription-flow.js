/**
 * Test Subscription Flow
 * Quick test to verify subscription plans are correctly configured
 * 
 * Usage: node test-subscription-flow.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');

const testSubscriptionFlow = async () => {
  try {
    console.log('🧪 Testing Subscription Flow...\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all plans from database
    const plans = await Subscription.find({ isActive: true, isDeleted: false });
    
    if (plans.length === 0) {
      console.log('❌ No plans found in database!');
      console.log('   Run: node scripts/seed-subscription-plans.js');
      process.exit(1);
    }

    console.log(`📋 Found ${plans.length} active plans:\n`);

    // Verify each plan
    let allValid = true;
    for (const plan of plans) {
      console.log(`📦 ${plan.planName}`);
      console.log(`   MongoDB ID: ${plan._id}`);
      console.log(`   Razorpay Plan ID: ${plan.razorpayPlanId || '❌ MISSING'}`);
      console.log(`   Amount: ₹${plan.amount / 100}`);
      console.log(`   Billing: ${plan.billingPeriod}`);
      console.log(`   Popular: ${plan.isPopular ? '⭐ Yes' : 'No'}`);

      // Verify Razorpay plan ID exists
      if (!plan.razorpayPlanId) {
        console.log('   ❌ ERROR: Missing Razorpay Plan ID!');
        allValid = false;
      } else {
        console.log('   ✅ Valid');
      }
      console.log('');
    }

    // Verify environment variables
    console.log('🔧 Environment Variables:');
    console.log(`   RAZORPAY_KEY_ID: ${process.env.RAZORPAY_KEY_ID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   RAZORPAY_KEY_SECRET: ${process.env.RAZORPAY_KEY_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`   RAZORPAY_PLAN_MONTHLY_ID: ${process.env.RAZORPAY_PLAN_MONTHLY_ID || '❌ Missing'}`);
    console.log(`   RAZORPAY_PLAN_QUARTERLY_ID: ${process.env.RAZORPAY_PLAN_QUARTERLY_ID || '❌ Missing'}`);
    console.log(`   RAZORPAY_PLAN_HALFYEARLY_ID: ${process.env.RAZORPAY_PLAN_HALFYEARLY_ID || '❌ Missing'}`);
    console.log('');

    // Final verdict
    if (allValid && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      console.log('✅ All checks passed! Subscription flow is ready.');
      console.log('\n📝 Next steps:');
      console.log('   1. Start the server: npm start');
      console.log('   2. Test subscription purchase via API or frontend');
      console.log('   3. Monitor logs: tail -f logs/combined.log');
    } else {
      console.log('❌ Some checks failed. Please fix the issues above.');
      allValid = false;
    }

    await mongoose.connection.close();
    process.exit(allValid ? 0 : 1);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testSubscriptionFlow();
