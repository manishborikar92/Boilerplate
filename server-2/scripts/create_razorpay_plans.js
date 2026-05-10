/**
 * Create Razorpay Plans
 * 
 * As per Subscription Development Guide (Step 0):
 * Creates the Pro plan billing options on Razorpay to get RAZORPAY_PLAN_IDs.
 * 
 * 2-Tier Model:
 * - Starter (plan_ca_flow_free): ₹0 - No Razorpay plan needed
 * - Pro (plan_ca_flow_pro): ₹349-1,299 - 3 billing cycle options created on Razorpay
 * 
 * Billing Cycles:
 * Plans: Monthly, Quarterly, Half-Yearly (all Pro tier variants)
 * - Monthly: ₹349 (Original ₹499 - 30% OFF) - Ideal for growing CA firms
 * - Quarterly: ₹799 (Original ₹1,199 - 33% OFF) - Save more with quarterly billing
 * - Half-Yearly: ₹1,299 (Original ₹2,599 - 50% OFF) - Best value with half-yearly billing
 * 
 * This script creates 3 plans on Razorpay and updates your .env file.
 * After running this script:
 * 1. Copy the output IDs
 * 2. Add them to your .env file:
 *    - RAZORPAY_PLAN_MONTHLY_ID=plan_xxxxx
 *    - RAZORPAY_PLAN_QUARTERLY_ID=plan_xxxxx
 *    - RAZORPAY_PLAN_HALFYEARLY_ID=plan_xxxxx
 * 3. Run seed-subscription-plans.js to populate database
 * 
 * Usage: node scripts/create_razorpay_plans.js
 */

require('dotenv').config();
const razorpayService = require('../src/services/razorpayService');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Pro Plan - Billing Cycle Options with Promotional Pricing
 * All are variants of the Pro tier with different billing frequencies
 * 
 * Promotional Discounts:
 * - Monthly: 30% OFF (₹349 vs ₹499)
 * - Quarterly: 33% OFF (₹799 vs ₹1,199)
 * - Half-Yearly: 50% OFF (₹1,299 vs ₹2,599)
 * 
 * Note: originalAmount and discount are for our database only, not sent to Razorpay
 */
const PLANS_TO_CREATE = [
    {
        // Razorpay API fields
        period: 'monthly',
        interval: 1,
        item: {
            name: 'CA Flow - Pro Monthly',
            amount: 34900, // ₹349.00 in paise
            currency: 'INR',
            description: 'Ideal for growing CA firms'
        },
        // Custom fields for our reference (not sent to Razorpay)
        envVar: 'RAZORPAY_PLAN_MONTHLY_ID',
        originalAmount: 49900,
        discount: 30
    },
    {
        // Razorpay API fields
        period: 'monthly',
        interval: 3, // 3 months = quarterly
        item: {
            name: 'CA Flow - Pro Quarterly',
            amount: 79900, // ₹799.00 in paise
            currency: 'INR',
            description: 'Save more with quarterly billing'
        },
        // Custom fields for our reference (not sent to Razorpay)
        envVar: 'RAZORPAY_PLAN_QUARTERLY_ID',
        originalAmount: 119900,
        discount: 33
    },
    {
        // Razorpay API fields
        period: 'monthly',
        interval: 6, // 6 months = half-yearly
        item: {
            name: 'CA Flow - Pro Half-Yearly',
            amount: 129900, // ₹1,299.00 in paise
            currency: 'INR',
            description: 'Best value with half-yearly billing'
        },
        // Custom fields for our reference (not sent to Razorpay)
        envVar: 'RAZORPAY_PLAN_HALFYEARLY_ID',
        originalAmount: 259900,
        discount: 50
    }
];

/**
 * Update .env file with new plan IDs
 */
const updateEnvFile = (planIds) => {
    const envPath = path.join(__dirname, '..', '.env');
    
    try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Get current date for the header comment
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Prepare the new section with header and inline comments
        const newSection = `# Razorpay Subscription Plan IDs
# Generated on ${currentDate} by server/scripts/create_razorpay_plans.js
RAZORPAY_PLAN_MONTHLY_ID=${planIds.monthly}     # CA Flow - Pro Monthly - ₹349
RAZORPAY_PLAN_QUARTERLY_ID=${planIds.quarterly}   # CA Flow - Pro Quarterly - ₹799
RAZORPAY_PLAN_HALFYEARLY_ID=${planIds.halfYearly}  # CA Flow - Pro Half-Yearly - ₹1,299`;
        
        // Replace the entire Razorpay Subscription Plan IDs section (header + 3 plan lines)
        const sectionRegex = /# Razorpay Subscription Plan IDs\n# Generated on .*\nRAZORPAY_PLAN_MONTHLY_ID=.*\nRAZORPAY_PLAN_QUARTERLY_ID=.*\nRAZORPAY_PLAN_HALFYEARLY_ID=.*/;
        
        if (sectionRegex.test(envContent)) {
            // Replace existing section in place
            envContent = envContent.replace(sectionRegex, newSection);
        } else {
            // Fallback: Try to find and replace individual lines
            const monthlyRegex = /RAZORPAY_PLAN_MONTHLY_ID=.*/;
            const quarterlyRegex = /RAZORPAY_PLAN_QUARTERLY_ID=.*/;
            const halfYearlyRegex = /RAZORPAY_PLAN_HALFYEARLY_ID=.*/;
            
            if (monthlyRegex.test(envContent)) {
                // Replace individual lines and add header if missing
                envContent = envContent.replace(monthlyRegex, `RAZORPAY_PLAN_MONTHLY_ID=${planIds.monthly}     # CA Flow - Pro Monthly - ₹349`);
                envContent = envContent.replace(quarterlyRegex, `RAZORPAY_PLAN_QUARTERLY_ID=${planIds.quarterly}   # CA Flow - Pro Quarterly - ₹799`);
                envContent = envContent.replace(halfYearlyRegex, `RAZORPAY_PLAN_HALFYEARLY_ID=${planIds.halfYearly}  # CA Flow - Pro Half-Yearly - ₹1,299`);
                
                // Add header comment if not present
                if (!envContent.includes('# Razorpay Subscription Plan IDs')) {
                    const headerComment = `# Razorpay Subscription Plan IDs\n# Generated on ${currentDate} by server/scripts/create_razorpay_plans.js\n`;
                    envContent = envContent.replace(/RAZORPAY_PLAN_MONTHLY_ID=/, headerComment + 'RAZORPAY_PLAN_MONTHLY_ID=');
                }
            } else {
                // No existing lines found, append at the end
                envContent = envContent.trimEnd() + '\n\n' + newSection + '\n';
            }
        }
        
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('\n✅ .env file updated successfully!');
        return true;
    } catch (error) {
        console.error('\n❌ Failed to update .env file:', error.message);
        return false;
    }
};

/**
 * Prompt user for confirmation
 */
const promptConfirmation = (question) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === '' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
};

const createPlans = async () => {
    try {
        console.log('🚀 Creating Pro Plan billing options on Razorpay...\n');
        console.log('📋 2-Tier Model with Promotional Pricing:');
        console.log('   Starter: ₹0 (No Razorpay plan needed)');
        console.log('   Monthly: ₹349 (Original ₹499 - 30% OFF)');
        console.log('   Quarterly: ₹799 (Original ₹1,199 - 33% OFF) [Actual Savings vs Monthly: ₹248]');
        console.log('   Half-Yearly: ₹1,299 (Original ₹2,599 - 50% OFF) [Actual Savings vs Monthly: ₹795]\n');

        // Check if Razorpay keys are present
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not found in .env file');
        }

        console.log('📝 Creating plans on Razorpay...\n');

        const createdPlans = {};
        let allSuccess = true;

        for (const plan of PLANS_TO_CREATE) {
            try {
                console.log(`📦 Creating: ${plan.item.name}...`);
                
                // Extract only Razorpay API fields (exclude our custom fields)
                const razorpayPlanData = {
                    period: plan.period,
                    interval: plan.interval,
                    item: {
                        name: plan.item.name,
                        amount: plan.item.amount,
                        currency: plan.item.currency,
                        description: plan.item.description
                    }
                };
                
                const result = await razorpayService.createPlan(razorpayPlanData);
                
                console.log(`✅ Success!`);
                console.log(`   Plan ID: ${result.id}`);
                console.log(`   Amount: ₹${result.item.amount / 100}`);
                console.log(`   Period: ${result.period} (interval: ${result.interval})\n`);
                
                // Store the plan ID
                if (plan.envVar === 'RAZORPAY_PLAN_MONTHLY_ID') {
                    createdPlans.monthly = result.id;
                } else if (plan.envVar === 'RAZORPAY_PLAN_QUARTERLY_ID') {
                    createdPlans.quarterly = result.id;
                } else if (plan.envVar === 'RAZORPAY_PLAN_HALFYEARLY_ID') {
                    createdPlans.halfYearly = result.id;
                }
                
            } catch (planError) {
                allSuccess = false;
                console.error(`❌ Failed to create ${plan.item.name}`);
                console.error(`   Error: ${planError.message}`);
                if (planError.error) {
                    console.error(`   Code: ${planError.error.code}`);
                    console.error(`   Description: ${planError.error.description}`);
                }
                console.log('');
            }
        }

        if (allSuccess && Object.keys(createdPlans).length === 3) {
            console.log('═'.repeat(60));
            console.log('✅ All plans created successfully!\n');
            console.log('📋 Plan IDs to be added to .env:');
            console.log(`   RAZORPAY_PLAN_MONTHLY_ID=${createdPlans.monthly}`);
            console.log(`   RAZORPAY_PLAN_QUARTERLY_ID=${createdPlans.quarterly}`);
            console.log(`   RAZORPAY_PLAN_HALFYEARLY_ID=${createdPlans.halfYearly}`);
            console.log('═'.repeat(60));
            
            // Ask for confirmation
            const confirmed = await promptConfirmation('\n❓ Update .env file with these Plan IDs? (Press Enter or Y/n): ');
            
            if (confirmed) {
                const updated = updateEnvFile(createdPlans);
                
                if (updated) {
                    console.log('\n🎉 Setup complete!');
                    console.log('\nNext steps:');
                    console.log('1. Run: node scripts/seed-subscription-plans.js');
                    console.log('2. Build frontend: cd ../client && npm run build');
                    console.log('3. Test subscription flow on your app');
                } else {
                    console.log('\n⚠️  Please manually update your .env file with the Plan IDs above.');
                }
            } else {
                console.log('\n⏭️  Skipped .env update.');
                console.log('   Copy the Plan IDs above to your .env file manually.');
            }
        } else {
            console.log('⚠️  Some plans failed to create. Please check the errors above.');
            console.log('   You may need to manually create plans via Razorpay Dashboard.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('not found')) {
            console.log('\n⚠️  Make sure your .env file contains:');
            console.log('RAZORPAY_KEY_ID=your_key_id');
            console.log('RAZORPAY_KEY_SECRET=your_key_secret');
        }
    } finally {
        process.exit();
    }
};

createPlans();
