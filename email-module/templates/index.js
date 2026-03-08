/**
 * Templates Barrel Export
 *
 * Re-exports every template function for convenient access:
 *   const { templates } = require('./email-module');
 *   const html = templates.verificationEmail({ ... });
 *
 * @module templates/index
 */

const { baseTemplate, BRAND } = require('./baseTemplate');
const { verificationEmailTemplate } = require('./verificationEmail');
const { passwordResetEmailTemplate } = require('./passwordResetEmail');
const { welcomeEmailTemplate } = require('./welcomeEmail');
const { credentialsEmailTemplate } = require('./credentialsEmail');
const { taskNotificationEmailTemplate } = require('./taskNotificationEmail');
const { documentRequestEmailTemplate } = require('./documentRequestEmail');
const { paymentNotificationEmailTemplate } = require('./paymentNotificationEmail');
const { threadNotificationEmailTemplate } = require('./threadNotificationEmail');
const { documentNotificationEmailTemplate } = require('./documentNotificationEmail');
const { subscriptionNotificationEmailTemplate } = require('./subscriptionNotificationEmail');
const { loginNotificationEmailTemplate } = require('./loginNotificationEmail');

module.exports = {
    // Core layout
    baseTemplate,
    BRAND,

    // Auth / Onboarding
    verificationEmailTemplate,
    passwordResetEmailTemplate,
    welcomeEmailTemplate,
    credentialsEmailTemplate,

    // Operational
    taskNotificationEmailTemplate,
    documentRequestEmailTemplate,

    // Notifications
    paymentNotificationEmailTemplate,
    threadNotificationEmailTemplate,
    documentNotificationEmailTemplate,
    subscriptionNotificationEmailTemplate,
    loginNotificationEmailTemplate,
};
