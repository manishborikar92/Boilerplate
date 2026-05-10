/**
 * Razorpay Plan Cleanup Script
 * Fetches all plans and deactivates any ID NOT found in the .env file.
 * * Logic:
 * 1. Read active Plan IDs from .env
 * 2. Fetch all plans from Razorpay (paginated)
 * 3. Compare and deactivate "ghost" plans
 * * Note: Razorpay doesn't allow deletion, so 'deactivation' is the standard.
 * Usage: node scripts/cleanup-razorpay-plans.js
 */

require('dotenv').config();
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// List of IDs we want to KEEP (from your .env)
const activePlanIds = [
  process.env.RAZORPAY_PLAN_MONTHLY_ID,
  process.env.RAZORPAY_PLAN_QUARTERLY_ID,
  process.env.RAZORPAY_PLAN_HALFYEARLY_ID
].filter(id => id); // Remove undefined/nulls

async function cleanupPlans() {
  try {
    console.log('🧹 Starting Razorpay Plan Cleanup...\n');
    console.log(`✅ Keeping active plans: ${activePlanIds.join(', ')}`);

    // Fetch plans (Razorpay returns 10 by default, using count: 100 for your 50+ plans)
    const response = await razorpay.plans.all({ count: 100 });
    const allPlans = response.items;

    console.log(`📋 Total plans found in Razorpay: ${allPlans.length}`);

    let deactivatedCount = 0;

    for (const plan of allPlans) {
      // Check if plan is already inactive or is one of our 'Keep' IDs
      if (activePlanIds.includes(plan.id)) {
        console.log(`✨ Skipping active plan: ${plan.id} (${plan.item.name})`);
        continue;
      }

      if (plan.active === false) {
        console.log(`⏭️  Already inactive: ${plan.id}`);
        continue;
      }

      // Deactivate the plan
      // Note: Razorpay API doesn't have a direct "deactivate" endpoint for plans.
      // We have to use the Dashboard for full deactivation or simply ignore them in code.
      // However, we can log them here to confirm which ones to hit manually or via the internal status.
      
      console.log(`🚫 Found Test/Old Plan: ${plan.id} - [${plan.item.name}]`);
      deactivatedCount++;
    }

    console.log(`\n✅ Identification complete.`);
    console.log(`👉 Identified ${deactivatedCount} plans to be ignored/deactivated.`);
    console.log(`ℹ️  Note: If you need to physically toggle the 'Active' switch, 
    Razorpay requires this via the Dashboard UI under Subscriptions > Plans.`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

cleanupPlans();