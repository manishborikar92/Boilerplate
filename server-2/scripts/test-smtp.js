/**
 * Test SMTP Email Service (emailService.js)
 * 
 * Sends every email template to verify SMTP is working.
 * 
 * Usage:
 *   node scripts/test-smtp.js
 *   node scripts/test-smtp.js custom@email.com
 */

require('dotenv').config();
const emailService = require('../src/services/emailService');

const TEST_EMAIL = process.argv[2] || 'theodinproject0622@gmail.com';
const TEST_NAME = 'CA-Flow Test User';

async function testSMTP() {
    console.log('='.repeat(60));
    console.log('📧 SMTP Email Service Test (Nodemailer)');
    console.log(`📬 Sending all templates to: ${TEST_EMAIL}`);
    console.log('='.repeat(60));
    console.log('');

    const results = [];

    // 1. Verification Email
    console.log('1️⃣  Verification Email...');
    try {
        await emailService.sendVerificationEmail(TEST_EMAIL, TEST_NAME, 'test-verify-token-abc123');
        results.push({ template: 'Verification', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Verification', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 2. Password Reset Email
    console.log('2️⃣  Password Reset Email...');
    try {
        await emailService.sendPasswordResetEmail(TEST_EMAIL, TEST_NAME, 'test-reset-token-xyz789');
        results.push({ template: 'Password Reset', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Password Reset', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 3. Welcome Email (CA-Admin)
    console.log('3️⃣  Welcome Email (CA-Admin)...');
    try {
        await emailService.sendWelcomeEmail(TEST_EMAIL, TEST_NAME, 'CA-Admin');
        results.push({ template: 'Welcome (CA-Admin)', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Welcome (CA-Admin)', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 4. Welcome Email (Client)
    console.log('4️⃣  Welcome Email (Client)...');
    try {
        await emailService.sendWelcomeEmail(TEST_EMAIL, TEST_NAME, 'Client');
        results.push({ template: 'Welcome (Client)', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Welcome (Client)', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 5. Task Notification Email
    console.log('5️⃣  Task Notification Email...');
    try {
        await emailService.sendTaskNotificationEmail(
            TEST_EMAIL,
            TEST_NAME,
            'Q4 Tax Filing - FY 2025-26',
            'In Progress',
            'Your documents have been received. Our team is currently processing your tax filing and will update you once completed.'
        );
        results.push({ template: 'Task Notification', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Task Notification', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 6. Document Request Email
    console.log('6️⃣  Document Request Email...');
    try {
        await emailService.sendDocumentRequestEmail(
            TEST_EMAIL,
            TEST_NAME,
            'Annual GST Return - FY 2025-26',
            ['Bank Statements (Apr-Mar)', 'Sales Invoice Records', 'Purchase Bills', 'Expense Receipts', 'TDS Certificates']
        );
        results.push({ template: 'Document Request', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Document Request', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 7. Client Welcome Email (with credentials)
    console.log('7️⃣  Client Welcome Email (with credentials)...');
    try {
        await emailService.sendClientWelcomeEmail({
            email: TEST_EMAIL,
            companyName: 'Acme Solutions Pvt. Ltd.',
            userId: 'acme-solutions',
            password: 'TempPass@2026',
            firmName: 'Sharma & Associates, Chartered Accountants'
        });
        results.push({ template: 'Client Welcome', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Client Welcome', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // 8. Raw HTML Email
    console.log('8️⃣  Raw HTML Email (sendEmail)...');
    try {
        await emailService.sendEmail(
            TEST_EMAIL,
            'SMTP Test - Raw HTML Email',
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e3a5f;">📧 SMTP Raw Email Test</h2>
        <p>Hello ${TEST_NAME},</p>
        <p>This is a <strong>raw HTML email</strong> sent directly via <code>sendEmail()</code> on the SMTP service.</p>
        <p style="background: #f0f4f8; padding: 12px; border-radius: 6px;">
          Provider: <strong>SMTP (Nodemailer)</strong><br>
          Timestamp: <strong>${new Date().toISOString()}</strong>
        </p>
        <p>If you see this, the SMTP service is working correctly! ✅</p>
      </div>`
        );
        results.push({ template: 'Raw HTML', status: '✅ SENT' });
        console.log('   ✅ Sent');
    } catch (error) {
        results.push({ template: 'Raw HTML', status: `❌ ${error.message}` });
        console.log(`   ❌ Failed: ${error.message}`);
    }

    // Summary
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 SMTP TEST RESULTS');
    console.log('='.repeat(60));
    results.forEach(r => console.log(`  ${r.status}  ${r.template}`));
    const passed = results.filter(r => r.status.includes('✅')).length;
    console.log('');
    console.log(`  ${passed}/${results.length} templates sent successfully`);
    console.log('='.repeat(60));
}

testSMTP().then(() => process.exit(0)).catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
});
