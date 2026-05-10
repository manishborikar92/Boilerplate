/**
 * Seed Subscription Plans
 * Creates the Pro plan billing options in database
 * 
 * As per Subscription Development Guide:
 * - 2-Tier Model: Starter (Free) & Pro (Paid)
 * - Starter (plan_ca_flow_free) is NOT stored in DB - it's the default absence of paid plan
 * - Pro (plan_ca_flow_pro) has monthly and quarterly billing active
 * - Half-Yearly is seeded as inactive (temporarily deactivated)
 * 
 * Plans: Monthly, Quarterly, Half-Yearly (all Pro tier variants)
 * - Monthly: ₹349 (Original ₹499 - 30% OFF) - Ideal for growing CA firms
 * - Quarterly: ₹799 (Original ₹1,199 - 33% OFF) - Save more with quarterly billing
 * - Half-Yearly: ₹1,299 (Original ₹2,599 - 50% OFF) - Best value with half-yearly billing
 * 
 * Note: 'plan_ca_flow_free' (Starter) is handled as default state, not stored in DB.
 * Usage: node scripts/seed-subscription-plans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Subscription = require('../src/models/Subscription');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * Pro Plan Billing Options
 * 
 * All these are variants of 'plan_ca_flow_pro' with different billing cycles.
 * They all have the same limits (100 clients, 500 records/month) as defined in PLAN_CONFIG.
 * 
 * Note: "Starter" (Free) plan with planId 'plan_ca_flow_free' is NOT stored in DB.
 * It's simply the default state when a firm has no active paid subscription.
 */
const plans = [
  // Pro Plan - Monthly Billing (30% OFF - Most Popular)
  {
    planName: 'Monthly',
    planDescription: 'Ideal for growing CA firms',
    razorpayPlanId: process.env.RAZORPAY_PLAN_MONTHLY_ID,
    amount: 34900, // ₹349
    originalAmount: 49900, // ₹499
    discount: 30,
    currency: 'INR',
    billingPeriod: 'monthly',
    interval: 1,
    features: [
      'Up to 100 clients',
      '500 documents per month',
      '500 payments per month',
      'Email notifications',
      'Priority support'
    ],
    maxClients: 100,
    maxStorage: 50, // GB
    maxUsers: -1,
    isActive: true,
    isPopular: true // Most Popular
  },
  // Pro Plan - Quarterly Billing (33% OFF)
  {
    planName: 'Quarterly',
    planDescription: 'Save more with quarterly billing',
    razorpayPlanId: process.env.RAZORPAY_PLAN_QUARTERLY_ID,
    amount: 79900, // ₹799
    originalAmount: 119900, // ₹1,199
    discount: 33,
    currency: 'INR',
    billingPeriod: 'quarterly',
    interval: 1,
    features: [
      'Up to 100 clients',
      '500 documents per month',
      '500 payments per month',
      'Email notifications',
      'Priority support',
      'Actual Savings vs Monthly: ₹248'
    ],
    maxClients: 100,
    maxStorage: 50,
    maxUsers: -1,
    isActive: true,
    isPopular: false
  },
  // Pro Plan - Half-Yearly Billing (50% OFF) - Temporarily deactivated
  {
    planName: 'Half-Yearly',
    planDescription: 'Best value with half-yearly billing',
    razorpayPlanId: process.env.RAZORPAY_PLAN_HALFYEARLY_ID,
    amount: 129900, // ₹1,299
    originalAmount: 259900, // ₹2,599
    discount: 50,
    currency: 'INR',
    billingPeriod: 'half-yearly',
    interval: 1,
    features: [
      'Up to 100 clients',
      '500 documents per month',
      '500 payments per month',
      'Email notifications',
      'Priority support',
      'Actual Savings vs Monthly: ₹795'
    ],
    maxClients: 100,
    maxStorage: 50,
    maxUsers: -1,
    isActive: false,
    isPopular: false
  }
];

// Seed function
const seedPlans = async () => {
  try {
    console.log('🌱 Starting subscription plans seeding...\n');
    console.log('📋 2-Tier Model with Promotional Pricing:');
    console.log('   - Starter (plan_ca_flow_free): ₹0 - NOT stored in DB');
    console.log('   - Pro (plan_ca_flow_pro): ₹349-1299 (30%-50% OFF) - 3 billing cycle options\n');
    console.log('📋 Plans:');
    console.log('   - Monthly: ₹349 (Original ₹499 - 30% OFF)');
    console.log('   - Quarterly: ₹799 (Original ₹1,199 - 33% OFF) [Actual Savings vs Monthly: ₹248]');
    console.log('   - Half-Yearly: ₹1,299 (Original ₹2,599 - 50% OFF) [Actual Savings vs Monthly: ₹795]\n');

    // Check if Razorpay keys are present
    if (!process.env.RAZORPAY_PLAN_MONTHLY_ID) {
      console.warn('⚠️  WARNING: RAZORPAY_PLAN_MONTHLY_ID not found in .env.');
      console.warn('   Run "node scripts/create_razorpay_plans.js" first to create Razorpay plans.');
    }

    // Clear existing plans
    const deleteResult = await Subscription.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing plans\n`);

    // Insert new plans
    const createdPlans = await Subscription.insertMany(plans);

    console.log('✅ Successfully created subscription plans:\n');

    createdPlans.forEach(plan => {
      console.log(`📦 ${plan.planName}`);
      console.log(`   ID: ${plan._id}`);
      console.log(`   Amount: ₹${plan.amount / 100}/${plan.billingPeriod}`);
      console.log(`   Original: ₹${plan.originalAmount / 100} (${plan.discount}% OFF)`);
      console.log(`   Description: ${plan.planDescription}`);
      console.log(`   Razorpay Plan ID: ${plan.razorpayPlanId || 'N/A (run create_razorpay_plans.js)'}`);
      console.log(`   Features: ${plan.features.length} features`);
      console.log(`   Popular: ${plan.isPopular}`);
      console.log('');
    });

    console.log('ℹ️  Note: Starter (Free) plan is NOT in database.');
    console.log('   Firms default to planId "plan_ca_flow_free" when no paid subscription exists.\n');
    console.log('✅ Seeding completed successfully!\n');

  } catch (error) {
    console.error('❌ Error seeding plans:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run seeding
connectDB().then(seedPlans);
