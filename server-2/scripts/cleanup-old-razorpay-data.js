/**
 * Cleanup Old Razorpay Data Script
 * 
 * Purpose: Clean up old Razorpay subscription IDs from the database
 * after switching to a new Razorpay account.
 * 
 * This script:
 * 1. Finds all Payment records with old Razorpay subscription IDs
 * 2. Cancels pending/created subscriptions locally
 * 3. Clears old Razorpay IDs from Firm records
 * 4. Resets firms to Starter plan if they had invalid subscriptions
 * 
 * Run: node scripts/cleanup-old-razorpay-data.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Payment = require('../src/models/Payment');
const Firm = require('../src/models/Firm');

async function cleanupOldRazorpayData() {
  try {
    console.log('🔧 Starting cleanup of old Razorpay data...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Find all pending/created subscription payments
    const pendingPayments = await Payment.find({
      paymentType: 'subscription',
      subscriptionStatus: { $in: ['created', 'authenticated', 'pending'] },
      status: { $in: ['created', 'pending'] }
    });

    console.log(`📋 Found ${pendingPayments.length} pending subscription payment(s)\n`);

    if (pendingPayments.length > 0) {
      for (const payment of pendingPayments) {
        console.log(`Processing Payment ID: ${payment._id}`);
        console.log(`  - Razorpay Subscription ID: ${payment.razorpaySubscriptionId}`);
        console.log(`  - Status: ${payment.status}`);
        console.log(`  - Subscription Status: ${payment.subscriptionStatus}`);
        
        // Cancel the payment locally (don't try to cancel on Razorpay)
        payment.status = 'cancelled';
        payment.subscriptionStatus = 'cancelled';
        
        // Add note about cleanup
        if (!payment.notes) {
          payment.notes = new Map();
        }
        payment.notes.set('cancelReason', 'Cancelled during Razorpay account migration');
        payment.notes.set('cleanupDate', new Date().toISOString());
        
        await payment.save();
        console.log(`  ✅ Cancelled locally\n`);
      }
    }

    // Step 2: Find all firms with old Razorpay subscription IDs
    const firmsWithSubscriptions = await Firm.find({
      'subscription.razorpaySubscriptionId': { $exists: true, $ne: null }
    });

    console.log(`📋 Found ${firmsWithSubscriptions.length} firm(s) with Razorpay subscription IDs\n`);

    if (firmsWithSubscriptions.length > 0) {
      for (const firm of firmsWithSubscriptions) {
        console.log(`Processing Firm: ${firm.firmName} (${firm._id})`);
        console.log(`  - Current Plan: ${firm.subscription?.planId}`);
        console.log(`  - Razorpay Subscription ID: ${firm.subscription?.razorpaySubscriptionId}`);
        
        // Check if there's an active paid subscription for this firm
        const activePaidSubscription = await Payment.findOne({
          firmId: firm._id,
          paymentType: 'subscription',
          status: 'paid',
          subscriptionStatus: 'active'
        });

        if (activePaidSubscription) {
          console.log(`  ℹ️  Has active paid subscription, keeping Pro plan`);
          // Keep the subscription but clear the old Razorpay ID
          firm.subscription.razorpaySubscriptionId = activePaidSubscription.razorpaySubscriptionId;
        } else {
          console.log(`  ⚠️  No active paid subscription, reverting to Starter plan`);
          // Revert to Starter plan
          firm.subscription = {
            planId: 'plan_ca_flow_free',
            status: 'active',
            razorpayCustomerId: firm.subscription?.razorpayCustomerId // Keep customer ID
          };
        }
        
        await firm.save();
        console.log(`  ✅ Updated\n`);
      }
    }

    // Step 3: Summary
    console.log('\n📊 Cleanup Summary:');
    console.log(`  - Cancelled ${pendingPayments.length} pending payment(s)`);
    console.log(`  - Updated ${firmsWithSubscriptions.length} firm(s)`);
    
    // Step 4: Show current state
    const starterFirms = await Firm.countDocuments({
      'subscription.planId': 'plan_ca_flow_free',
      isDeleted: false
    });
    
    const proFirms = await Firm.countDocuments({
      'subscription.planId': 'plan_ca_flow_pro',
      isDeleted: false
    });
    
    console.log(`\n📈 Current Subscription Distribution:`);
    console.log(`  - Starter Plan: ${starterFirms} firm(s)`);
    console.log(`  - Pro Plan: ${proFirms} firm(s)`);

    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupOldRazorpayData()
  .then(() => {
    console.log('\n✨ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
