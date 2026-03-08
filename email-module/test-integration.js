/**
 * Email Module — Integration Test Script
 *
 * Tests the default SMTP provider with all high-level email methods.
 *
 * Usage:
 *   node email-module/test-integration.js [recipient-email]
 *
 * Requires a .env file in the project root (or set env vars manually).
 */

require('dotenv').config();

const { createEmailService } = require('./index');

async function runTests() {
    const provider = process.argv[3] || 'smtp';
    const emailService = createEmailService(provider);

    const testEmail = process.argv[2] || 'test@example.com';
    const testName = 'Test User';

    console.log(`\n🧪 Email Module Integration Test (${provider.toUpperCase()})`);
    console.log(`📬 Recipient: ${testEmail}\n`);

    const tests = [
        {
            name: 'Test Configuration',
            fn: () => emailService.testConfiguration(testEmail),
        },
        {
            name: 'Verification Email',
            fn: () => emailService.sendVerificationEmail(testEmail, testName, 'test-token-123'),
        },
        {
            name: 'Password Reset Email',
            fn: () => emailService.sendPasswordResetEmail(testEmail, testName, 'reset-token-456'),
        },
        {
            name: 'Welcome Email',
            fn: () => emailService.sendWelcomeEmail(testEmail, testName, 'Admin'),
        },
        {
            name: 'Task Notification Email',
            fn: () =>
                emailService.sendTaskNotificationEmail(
                    testEmail,
                    testName,
                    'Q4 Tax Filing',
                    'in-progress',
                    'Your documents are being processed.',
                ),
        },
        {
            name: 'Document Request Email',
            fn: () =>
                emailService.sendDocumentRequestEmail(testEmail, testName, 'Annual GST Return', [
                    'Bank Statements',
                    'Invoice Records',
                    'Purchase Bills',
                ]),
        },
        {
            name: 'Credentials Email',
            fn: () =>
                emailService.sendCredentialsEmail({
                    email: testEmail,
                    companyName: 'Acme Corp',
                    userId: 'USR-001',
                    password: 'Temp@1234',
                    firmName: 'Smith & Associates',
                }),
        },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            console.log(`  ▶ ${test.name}...`);
            await test.fn();
            console.log(`  ✅ ${test.name}: PASSED`);
            passed++;
        } catch (error) {
            console.log(`  ❌ ${test.name}: FAILED — ${error.message}`);
            failed++;
        }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (process.env.NODE_ENV !== 'production') {
        console.log('💡 In development mode, check console for Ethereal preview URLs.');
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((error) => {
    console.error('💥 Integration test failed:', error);
    process.exit(1);
});
