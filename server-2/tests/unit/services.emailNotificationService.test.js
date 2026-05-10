jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn()
}));
jest.mock('../../src/models/User', () => ({
  findById: jest.fn()
}));
jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));
jest.mock('../../src/templates/email/notificationEmail', () => ({
  paymentNotificationTemplate: jest.fn(() => '<html>payment</html>'),
  threadNotificationTemplate: jest.fn(() => '<html>thread</html>'),
  documentNotificationTemplate: jest.fn(() => '<html>document</html>'),
  subscriptionNotificationTemplate: jest.fn(() => '<html>subscription</html>'),
  loginNotificationTemplate: jest.fn(() => '<html>login</html>')
}));

const emailService = require('../../src/services/emailService');
const User = require('../../src/models/User');
const emailNotificationService = require('../../src/services/emailNotificationService');

describe('emailNotificationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('skips low priority notifications', async () => {
    const notification = {
      _id: 'n1',
      priority: 'low',
      recipientId: 'u1',
      type: 'payment'
    };
    await emailNotificationService.sendNotificationEmail(notification);
    expect(User.findById).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('handles missing user info', async () => {
    User.findById.mockResolvedValue(null);
    const notification = {
      _id: 'n1',
      priority: 'high',
      recipientId: 'u1',
      type: 'payment'
    };
    await emailNotificationService.sendNotificationEmail(notification);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('sends payment, thread, document, subscription, and login emails', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ email: 'a@test.com', name: 'A' }) });

    const base = {
      _id: 'n1',
      recipientId: 'u1',
      priority: 'high',
      actionUrl: '/x',
      title: 'Title',
      message: 'Message',
      metadata: { amountInRupees: '100.00', clientName: 'Client', subject: 'Sub', messagePreview: 'Hi', documentCount: 2, uploadedBy: 'User', planName: 'Plan', billingPeriod: 'monthly', nextBillingDate: new Date().toISOString(), loginTime: new Date().toISOString() }
    };

    await emailNotificationService.sendNotificationEmail({ ...base, type: 'payment', subtype: 'payment_received' });
    await emailNotificationService.sendNotificationEmail({ ...base, type: 'thread', subtype: 'thread_created' });
    await emailNotificationService.sendNotificationEmail({ ...base, type: 'document' });
    await emailNotificationService.sendNotificationEmail({ ...base, type: 'subscription', subtype: 'subscription_cancelled' });
    await emailNotificationService.sendNotificationEmail({ ...base, type: 'login', subtype: 'client_first_login' });

    expect(emailService.sendEmail).toHaveBeenCalled();
  });

  it('handles unknown notification type', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ email: 'a@test.com', name: 'A' }) });
    await emailNotificationService.sendNotificationEmail({
      _id: 'n1',
      recipientId: 'u1',
      priority: 'high',
      type: 'unknown',
      title: 'Title',
      message: 'Message',
      metadata: {},
      actionUrl: '/x'
    });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('sends batch notification emails', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ email: 'a@test.com', name: 'A' }) });
    await emailNotificationService.sendBatchNotificationEmails([
      { _id: 'n1', recipientId: 'u1', priority: 'high', type: 'payment', title: 'T', message: 'M', metadata: { amountInRupees: '10.00' }, actionUrl: '/x', subtype: 'payment_received' },
      { _id: 'n2', recipientId: 'u1', priority: 'high', type: 'thread', title: 'T', message: 'M', metadata: { subject: 'S' }, actionUrl: '/x', subtype: 'thread_created' }
    ]);
    expect(emailService.sendEmail).toHaveBeenCalled();
  });
});
