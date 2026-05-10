/**
 * Test Resend Email Service (resendService.js)
 * 
 * Sends every email template to verify Resend is working.
 * 
 * Prerequisites:
 *   npm install resend
 *   Set RESEND_API_KEY and RESEND_FROM in .env
 * 
 * Usage:
 *   node scripts/test-resend.js
 *   node scripts/test-resend.js custom@email.com
 */

require('dotenv').config();
const resendService = require('../src/services/resendService');

const TEST_EMAIL = process.argv[2] || 'theodinproject0622@gmail.com';
const TEST_NAME = 'CA-Flow Test User';

async function testResend() {
    console.log('='.repeat(60));
    console.log('📧 Resend Email Service Test');
    console.log(`📬 Sending all templates to: ${TEST_EMAIL}`);
    console.log('='.repeat(60));
    console.log('');

    // Check configuration
    const resendConfig = require('../src/config/resend');
    if (!resendConfig.isConfigured()) {
        console.log('⚠️  Resend is NOT configured.');
        console.log('   Set these in your .env file:');
        console.log('     RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx');
        console.log('     RESEND_FROM=CA-Flow <no-reply@your-domain.com>');
        console.log('');
        console.log('   Then run: npm install resend');
        process.exit(1);
    }

    const results = [];

    // 1. Verification Email
    console.log('1️⃣  Verification Email...');
    try {
        const res = await resendService.sendVerificationEmail(TEST_EMAIL, TEST_NAME, 'test-verify-token-abc123');
        results.push({ template: 'Verification', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Verification', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 2. Password Reset Email
    console.log('2️⃣  Password Reset Email...');
    try {
        const res = await resendService.sendPasswordResetEmail(TEST_EMAIL, TEST_NAME, 'test-reset-token-xyz789');
        results.push({ template: 'Password Reset', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Password Reset', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 3. Welcome Email (CA-Admin)
    console.log('3️⃣  Welcome Email (CA-Admin)...');
    try {
        const res = await resendService.sendWelcomeEmail(TEST_EMAIL, TEST_NAME, 'CA-Admin');
        results.push({ template: 'Welcome (CA-Admin)', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Welcome (CA-Admin)', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 4. Welcome Email (Client)
    console.log('4️⃣  Welcome Email (Client)...');
    try {
        const res = await resendService.sendWelcomeEmail(TEST_EMAIL, TEST_NAME, 'Client');
        results.push({ template: 'Welcome (Client)', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Welcome (Client)', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 5. Task Notification Email
    console.log('5️⃣  Task Notification Email...');
    try {
        const res = await resendService.sendTaskNotificationEmail(
            TEST_EMAIL,
            TEST_NAME,
            'Q4 Tax Filing - FY 2025-26',
            'In Progress',
            'Your documents have been received. Our team is currently processing your tax filing and will update you once completed.'
        );
        results.push({ template: 'Task Notification', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Task Notification', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 6. Document Request Email
    console.log('6️⃣  Document Request Email...');
    try {
        const res = await resendService.sendDocumentRequestEmail(
            TEST_EMAIL,
            TEST_NAME,
            'Annual GST Return - FY 2025-26',
            ['Bank Statements (Apr-Mar)', 'Sales Invoice Records', 'Purchase Bills', 'Expense Receipts', 'TDS Certificates']
        );
        results.push({ template: 'Document Request', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Document Request', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 7. Client Welcome Email (with credentials)
    console.log('7️⃣  Client Welcome Email (with credentials)...');
    try {
        const res = await resendService.sendClientWelcomeEmail({
            email: TEST_EMAIL,
            companyName: 'Acme Solutions Pvt. Ltd.',
            userId: 'acme-solutions',
            password: 'TempPass@2026',
            firmName: 'Sharma & Associates, Chartered Accountants'
        });
        results.push({ template: 'Client Welcome', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Client Welcome', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 8. Raw HTML Email
    console.log('8️⃣  Raw HTML Email (sendEmail)...');
    try {
        const res = await resendService.sendEmail(
            TEST_EMAIL,
            'Resend Test - Raw HTML Email',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">📧 Resend Raw Email Test</h2>
        <p>Hello ${TEST_NAME},</p>
        <p>This is a <strong>raw HTML email</strong> sent directly via <code>sendEmail()</code> on the Resend service.</p>
        <p style="background: #f0f4f8; padding: 12px; border-radius: 6px;">
          Provider: <strong>Resend</strong><br>
          Timestamp: <strong>${new Date().toISOString()}</strong>
        </p>
        <p>If you see this, the Resend service is working correctly! ✅</p>
      </div>`
        );
        results.push({ template: 'Raw HTML', status: res.success ? '✅ SENT' : `❌ ${res.error}` });
        console.log(`   ${res.success ? '✅ Sent' : '❌ Failed: ' + res.error}`);
    } catch (error) {
        results.push({ template: 'Raw HTML', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 RESEND TEST RESULTS');
    console.log('='.repeat(60));
    results.forEach(r => console.log(`  ${r.status}  ${r.template}`));
    const passed = results.filter(r => r.status.includes('✅')).length;
    console.log('');
    console.log(`  ${passed}/${results.length} templates sent successfully`);
    console.log('='.repeat(60));
}

testResend().then(() => process.exit(0)).catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
});
