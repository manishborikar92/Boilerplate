/**
 * Fix Invalid Razorpay Customer IDs
 * 
 * This script clears invalid razorpayCustomerId from firms
 * so that new customers can be created on next subscription purchase
 * 
 * Usage: node scripts/fix-customer-ids.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Firm = require('../src/models/Firm');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const fixCustomerIds = async () => {
  try {
    console.log('🔍 Checking for invalid Razorpay customer IDs...\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all firms with razorpayCustomerId
    const firms = await Firm.find({ 
      'subscription.razorpayCustomerId': { $exists: true, $ne: null } 
    });

    console.log(`Found ${firms.length} firms with customer IDs\n`);

    let invalidCount = 0;
    let validCount = 0;

    for (const firm of firms) {
      const customerId = firm.subscription.razorpayCustomerId;
      
      try {
        // Try to fetch customer from Razorpay
        await razorpay.customers.fetch(customerId);
        console.log(`✅ ${firm.firmName}: ${customerId} - Valid`);
        validCount++;
      } catch (error) {
        console.log(`❌ ${firm.firmName}: ${customerId} - Invalid (doesn't exist)`);
        
        // Clear the invalid customer ID
        firm.subscription.razorpayCustomerId = undefined;
        await firm.save();
        
        console.log(`   → Cleared invalid customer ID`);
        invalidCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log(`  Valid customer IDs: ${validCount}`);
    console.log(`  Invalid customer IDs cleared: ${invalidCount}`);
    console.log('='.repeat(60));

    if (invalidCount > 0) {
      console.log('\n✅ Fixed! New customers will be created on next subscription purchase.');
    } else {
      console.log('\n✅ All customer IDs are valid!');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixCustomerIds();
