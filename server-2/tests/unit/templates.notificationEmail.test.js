const {
  baseTemplate,
  paymentNotificationTemplate,
  threadNotificationTemplate,
  documentNotificationTemplate,
  subscriptionNotificationTemplate,
  loginNotificationTemplate
} = require('../../src/templates/email/notificationEmail');

describe('notificationEmail templates', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds base template with action and priority', () => {
    process.env.FRONTEND_URL = 'http://example.com';
    const html = baseTemplate({
      title: 'Title',
      content: '<p>Content</p>',
      actionUrl: 'http://action',
      actionLabel: 'Act',
      priority: 'urgent'
    });
    expect(html).toContain('🚨 Urgent');
    expect(html).toContain('http://action');
    expect(html).toContain('http://example.com');
  });

  it('builds base template without action', () => {
    const html = baseTemplate({
      title: 'Title',
      content: '<p>Content</p>',
      priority: 'low'
    });
    expect(html).toContain('Title');
    expect(html).not.toContain('View Payment Details');
  });

  it('builds base template with default priority', () => {
    const html = baseTemplate({
      title: 'Title',
      content: '<p>Content</p>',
      priority: 'unknown'
    });
    expect(html).toContain('Title');
  });

  it('uses default frontend url when not configured', () => {
    delete process.env.FRONTEND_URL;
    const html = baseTemplate({
      title: 'Title',
      content: '<p>Content</p>',
      priority: 'normal'
    });
    expect(html).toContain('http://localhost:3000');
  });

  it('builds payment notification template', () => {
    const success = paymentNotificationTemplate({
      recipientName: 'A',
      amount: 500,
      clientName: 'Client',
      status: 'received',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    const failed = paymentNotificationTemplate({
      recipientName: 'A',
      amount: 500,
      clientName: 'Client',
      status: 'failed',
      actionUrl: 'http://action',
      priority: 'high'
    });
    expect(success).toContain('Payment Received');
    expect(failed).toContain('Payment Failed');
  });

  it('builds thread notification template', () => {
    const created = threadNotificationTemplate({
      recipientName: 'A',
      subject: 'Sub',
      message: 'msg',
      senderName: 'Sender',
      senderRole: 'CA-Admin',
      actionUrl: 'http://action',
      priority: 'normal',
      notificationType: 'created'
    });
    const resolved = threadNotificationTemplate({
      recipientName: 'A',
      subject: 'Sub',
      message: 'msg',
      senderName: 'Sender',
      senderRole: 'Client',
      actionUrl: 'http://action',
      priority: 'normal',
      notificationType: 'resolved'
    });
    const other = threadNotificationTemplate({
      recipientName: 'A',
      subject: 'Sub',
      message: 'msg',
      senderName: 'Sender',
      senderRole: 'Client',
      actionUrl: 'http://action',
      priority: 'normal',
      notificationType: 'message'
    });
    const unknown = threadNotificationTemplate({
      recipientName: 'A',
      subject: 'Sub',
      message: 'msg',
      senderName: 'Sender',
      senderRole: 'Client',
      actionUrl: 'http://action',
      priority: 'normal',
      notificationType: 'other'
    });
    expect(created).toContain('New Conversation');
    expect(resolved).toContain('Conversation Resolved');
    expect(other).toContain('New Message');
    expect(unknown).toContain('New Message');
  });

  it('builds document notification template', () => {
    const single = documentNotificationTemplate({
      recipientName: 'A',
      documentName: 'Doc',
      documentCount: 1,
      uploaderName: 'U',
      uploaderRole: 'CA-Admin',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    const multiple = documentNotificationTemplate({
      recipientName: 'A',
      documentName: 'Doc',
      documentCount: 3,
      uploaderName: 'U',
      uploaderRole: 'Client',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    expect(single).toContain('Document Uploaded');
    expect(multiple).toContain('3 Documents');
  });

  it('builds subscription notification template', () => {
    const activated = subscriptionNotificationTemplate({
      recipientName: 'A',
      planName: 'Pro',
      status: 'activated',
      amount: 200,
      nextBillingDate: '2024-01-01',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    const failed = subscriptionNotificationTemplate({
      recipientName: 'A',
      planName: 'Pro',
      status: 'failed',
      amount: 0,
      nextBillingDate: '',
      actionUrl: 'http://action',
      priority: 'high'
    });
    const cancelled = subscriptionNotificationTemplate({
      recipientName: 'A',
      planName: 'Pro',
      status: 'cancelled',
      amount: 0,
      nextBillingDate: '',
      actionUrl: 'http://action',
      priority: 'low'
    });
    const other = subscriptionNotificationTemplate({
      recipientName: 'A',
      planName: 'Pro',
      status: 'other',
      amount: 0,
      nextBillingDate: '',
      actionUrl: 'http://action',
      priority: 'low'
    });
    expect(activated).toContain('Subscription Activated');
    expect(failed).toContain('Payment Failed');
    expect(cancelled).toContain('Subscription Cancelled');
    expect(other).toContain('Subscription Activated');
  });

  it('builds login notification template', () => {
    const first = loginNotificationTemplate({
      recipientName: 'A',
      clientName: 'Client',
      isFirstLogin: true,
      loginTime: 'now',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    const again = loginNotificationTemplate({
      recipientName: 'A',
      clientName: 'Client',
      isFirstLogin: false,
      loginTime: 'now',
      actionUrl: 'http://action',
      priority: 'normal'
    });
    expect(first).toContain('Client First Login');
    expect(again).toContain('Client Login');
  });
});
