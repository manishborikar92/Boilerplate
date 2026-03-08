/**
 * Notification Email Service
 *
 * Routes in-app notification objects to the correct email template
 * based on `notification.type`. This is a framework-agnostic dispatcher
 * that accepts any email provider instance (SmtpProvider, ResendProvider, etc.)
 * and a user-lookup function.
 *
 * @module NotificationEmailService
 */

const {
    paymentNotificationEmailTemplate,
    threadNotificationEmailTemplate,
    documentNotificationEmailTemplate,
    subscriptionNotificationEmailTemplate,
    loginNotificationEmailTemplate,
} = require('./templates');

class NotificationEmailService {
    /**
     * @param {Object} emailProvider - Any provider instance (SmtpProvider, etc.)
     * @param {Object} options
     * @param {Function} options.getUserInfo  - async (userId) => { email, name } | null
     * @param {string}  [options.frontendUrl] - Base URL for action links
     * @param {Object}  [options.logger]      - Logger with info/warn/error methods
     */
    constructor(emailProvider, options = {}) {
        this.emailProvider = emailProvider;
        this.getUserInfo = options.getUserInfo || (async () => null);
        this.frontendUrl = options.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
        this.logger = options.logger || console;
    }

    // ─── Priority Filter ────────────────────────────────────────────────────────

    /** Only send emails for urgent / high / normal priority. */
    shouldSendEmail(priority) {
        return ['urgent', 'high', 'normal'].includes(priority);
    }

    // ─── Non-Blocking Send ───────────────────────────────────────────────────────

    async _sendAsync(email, subject, html) {
        try {
            await this.emailProvider.sendEmail(email, subject, html);
            this.logger.info?.('Email notification sent', { email, subject });
        } catch (error) {
            this.logger.error?.('Failed to send email notification', { error: error.message, email, subject });
        }
    }

    // ─── Subject Helper ──────────────────────────────────────────────────────────

    _buildSubject(notification) {
        const prefix =
            notification.priority === 'urgent' ? '🚨 ' :
                notification.priority === 'high' ? '⚠️ ' : '';
        return `${prefix}${notification.title}`;
    }

    // ─── Notification Handlers ───────────────────────────────────────────────────

    async _handlePayment(notification, userInfo) {
        if (!this.shouldSendEmail(notification.priority)) return;

        const { amountInRupees, amount, clientName } = notification.metadata;
        const status = notification.subtype?.includes('received') ? 'received' : 'failed';
        const actionUrl = `${this.frontendUrl}${notification.actionUrl || ''}`;

        const html = paymentNotificationEmailTemplate({
            recipientName: userInfo.name,
            amount: amountInRupees || amount,
            clientName,
            status,
            actionUrl,
            priority: notification.priority,
        });

        await this._sendAsync(userInfo.email, this._buildSubject(notification), html);
    }

    async _handleThread(notification, userInfo) {
        if (!this.shouldSendEmail(notification.priority)) return;

        const { subject, clientName } = notification.metadata;
        let notificationType = 'message';
        if (notification.subtype === 'thread_created') notificationType = 'created';
        else if (notification.subtype === 'thread_resolved') notificationType = 'resolved';

        const actionUrl = `${this.frontendUrl}${notification.actionUrl || ''}`;

        const html = threadNotificationEmailTemplate({
            recipientName: userInfo.name,
            subject,
            message: notification.message,
            senderName: clientName || 'User',
            senderRole: '',
            actionUrl,
            priority: notification.priority,
            notificationType,
        });

        await this._sendAsync(userInfo.email, this._buildSubject(notification), html);
    }

    async _handleDocument(notification, userInfo) {
        if (!this.shouldSendEmail(notification.priority)) return;

        const { documentCount, clientName, uploadedBy } = notification.metadata;
        const actionUrl = `${this.frontendUrl}${notification.actionUrl || ''}`;

        const html = documentNotificationEmailTemplate({
            recipientName: userInfo.name,
            documentName: notification.message?.split(' uploaded ')[1]?.split(' in')[0] || 'document',
            documentCount: documentCount || 1,
            uploaderName: clientName || uploadedBy || 'User',
            uploaderRole: '',
            actionUrl,
            priority: notification.priority,
        });

        await this._sendAsync(userInfo.email, this._buildSubject(notification), html);
    }

    async _handleSubscription(notification, userInfo) {
        if (!this.shouldSendEmail(notification.priority)) return;

        const { planName, amount, nextBillingDate } = notification.metadata;

        let status = 'activated';
        if (notification.subtype === 'subscription_payment_failed') status = 'failed';
        else if (notification.subtype === 'subscription_cancelled') status = 'cancelled';

        const actionUrl = `${this.frontendUrl}${notification.actionUrl || ''}`;

        const html = subscriptionNotificationEmailTemplate({
            recipientName: userInfo.name,
            planName,
            status,
            amount: amount ? (amount / 100).toFixed(2) : null,
            nextBillingDate: nextBillingDate
                ? new Date(nextBillingDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                : null,
            actionUrl,
            priority: notification.priority,
        });

        await this._sendAsync(userInfo.email, this._buildSubject(notification), html);
    }

    async _handleLogin(notification, userInfo) {
        if (!this.shouldSendEmail(notification.priority)) return;

        const { clientName, loginTime } = notification.metadata;
        const isFirstLogin = notification.subtype === 'client_first_login';
        const actionUrl = `${this.frontendUrl}${notification.actionUrl || ''}`;

        const html = loginNotificationEmailTemplate({
            recipientName: userInfo.name,
            clientName,
            isFirstLogin,
            loginTime: new Date(loginTime).toLocaleString('en-IN', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            }),
            actionUrl,
            priority: notification.priority,
        });

        await this._sendAsync(userInfo.email, this._buildSubject(notification), html);
    }

    // ─── Public Dispatcher ──────────────────────────────────────────────────────

    /**
     * Route a notification to the appropriate handler.
     *
     * @param {Object} notification
     * @param {string} notification.type       - 'payment' | 'thread' | 'document' | 'subscription' | 'login'
     * @param {string} notification.subtype    - Provider-specific subtype
     * @param {string} notification.priority   - 'urgent' | 'high' | 'normal' | 'low'
     * @param {string} notification.recipientId - User ID to look up
     * @param {string} notification.title      - Human-readable title
     * @param {string} notification.message    - Notification body
     * @param {Object} notification.metadata   - Extra payload
     * @param {string} notification.actionUrl  - Relative URL path
     */
    async send(notification) {
        try {
            if (!this.shouldSendEmail(notification.priority)) return;

            const userInfo = await this.getUserInfo(notification.recipientId);
            if (!userInfo) {
                this.logger.warn?.('Cannot send email — user info not found', { recipientId: notification.recipientId });
                return;
            }

            const handlers = {
                payment: '_handlePayment',
                thread: '_handleThread',
                document: '_handleDocument',
                subscription: '_handleSubscription',
                login: '_handleLogin',
            };

            const handler = handlers[notification.type];
            if (handler) {
                await this[handler](notification, userInfo);
            } else {
                this.logger.warn?.('Unknown notification type for email', { type: notification.type });
            }
        } catch (error) {
            this.logger.error?.('Failed to send notification email', { error: error.message, type: notification.type });
        }
    }

    /**
     * Send a batch of notification emails (parallel, best-effort).
     * @param {Object[]} notifications
     */
    async sendBatch(notifications) {
        await Promise.allSettled(notifications.map(n => this.send(n)));
    }
}

module.exports = NotificationEmailService;
