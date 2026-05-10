jest.mock('../../src/services/twilioService', () => ({
  sendSMS: jest.fn(),
  sendWhatsApp: jest.fn(),
  sendWhatsAppTemplate: jest.fn()
}));

jest.mock('../../src/services/subscriptionService', () => ({
  isNotificationChannelAllowed: jest.fn()
}));

jest.mock('../../src/models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../../src/models/Firm', () => ({
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

const twilioService = require('../../src/services/twilioService');
const subscriptionService = require('../../src/services/subscriptionService');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const smsService = require('../../src/services/smsNotificationService');
const whatsappService = require('../../src/services/whatsappNotificationService');

describe('notification channel services', () => {
  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.TWILIO_WHATSAPP_TEMPLATE_NOTIFICATION_SID;
  });

  it('evaluates SMS send eligibility', async () => {
    expect(smsService.shouldSendSMS('urgent')).toBe(true);
    expect(smsService.shouldSendSMS('low')).toBe(false);

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const missingFirm = await smsService.canSendSMS('firm1');
    expect(missingFirm).toBe(false);

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ smsNotification: false }) });
    const disabled = await smsService.canSendSMS('firm1');
    expect(disabled).toBe(false);

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ smsNotification: true }) });
    subscriptionService.isNotificationChannelAllowed.mockResolvedValue(false);
    const notAllowed = await smsService.canSendSMS('firm1');
    expect(notAllowed).toBe(false);

    subscriptionService.isNotificationChannelAllowed.mockResolvedValue(true);
    const allowed = await smsService.canSendSMS('firm1');
    expect(allowed).toBe(true);
  });

  it('loads user phone info for SMS', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const missing = await smsService.getUserPhoneInfo('user1');
    expect(missing).toBeNull();

    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ phoneNumber: '123', name: 'Test' }) });
    const info = await smsService.getUserPhoneInfo('user1');
    expect(info).toEqual({ phoneNumber: '123', name: 'Test' });
  });

  it('formats and sends SMS notifications', async () => {
    const message = smsService.formatSMSMessage({
      priority: 'high',
      title: 'Alert',
      message: 'Check this',
      actionUrl: '/x'
    });
    expect(message).toContain('Alert');
    expect(message).toContain('View');

    twilioService.sendSMS.mockResolvedValue({ success: true, messageId: 'm1' });
    await smsService.sendSMSAsync('123', 'hello');
    expect(twilioService.sendSMS).toHaveBeenCalled();

    twilioService.sendSMS.mockResolvedValue({ success: false, error: 'bad' });
    await smsService.sendSMSAsync('123', 'hello');
    expect(twilioService.sendSMS).toHaveBeenCalled();
  });

  it('runs SMS notification flow with gating', async () => {
    const notification = {
      _id: 'n1',
      priority: 'normal',
      firmId: 'f1',
      recipientId: 'u1',
      title: 'Hello',
      message: 'World'
    };

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ smsNotification: true }) });
    subscriptionService.isNotificationChannelAllowed.mockResolvedValue(true);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ phoneNumber: '123', name: 'A' }) });
    twilioService.sendSMS.mockResolvedValue({ success: true, messageId: 'm1' });

    await smsService.sendNotificationSMS(notification);
    expect(twilioService.sendSMS).toHaveBeenCalled();
  });

  it('sends batch SMS notifications', async () => {
    const spy = jest.spyOn(smsService, 'sendNotificationSMS').mockResolvedValue();
    await smsService.sendBatchNotificationSMS([{ priority: 'normal' }, { priority: 'high' }]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('evaluates WhatsApp eligibility and formats messages', async () => {
    expect(whatsappService.shouldSendWhatsApp('urgent')).toBe(true);
    expect(whatsappService.shouldSendWhatsApp('low')).toBe(false);

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ whatsappNotification: true }) });
    subscriptionService.isNotificationChannelAllowed.mockResolvedValue(true);
    const allowed = await whatsappService.canSendWhatsApp('firm1');
    expect(allowed).toBe(true);

    const formatted = whatsappService.formatWhatsAppMessage({
      priority: 'normal',
      title: 'Payment',
      message: 'Paid',
      metadata: { amountInRupees: '10.00', clientName: 'Client', subject: 'Subject' },
      actionUrl: '/x',
      actionLabel: 'Open',
      createdAt: new Date('2026-01-01T00:00:00.000Z')
    }, 'User');
    expect(formatted).toContain('Payment');
  });

  it('sends WhatsApp using template or fallback', async () => {
    const notification = {
      _id: 'n1',
      priority: 'normal',
      firmId: 'f1',
      recipientId: 'u1',
      title: 'Hello',
      message: 'World',
      actionUrl: '/x',
      actionLabel: 'Open',
      createdAt: new Date()
    };

    Firm.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ whatsappNotification: true }) });
    subscriptionService.isNotificationChannelAllowed.mockResolvedValue(true);
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ phoneNumber: '123', name: 'A' }) });

    process.env.TWILIO_WHATSAPP_TEMPLATE_NOTIFICATION_SID = 'tmpl';
    twilioService.sendWhatsAppTemplate.mockResolvedValue({ success: true, messageId: 'w1' });
    await whatsappService.sendNotificationWhatsApp(notification);
    expect(twilioService.sendWhatsAppTemplate).toHaveBeenCalled();

    delete process.env.TWILIO_WHATSAPP_TEMPLATE_NOTIFICATION_SID;
    twilioService.sendWhatsApp.mockResolvedValue({ success: true, messageId: 'w2' });
    await whatsappService.sendNotificationWhatsApp(notification);
    expect(twilioService.sendWhatsApp).toHaveBeenCalled();
  });

  it('handles WhatsApp send errors without throwing', async () => {
    twilioService.sendWhatsApp.mockResolvedValue({ success: false, error: 'bad' });
    await whatsappService.sendWhatsAppAsync('123', 'hello');
    expect(twilioService.sendWhatsApp).toHaveBeenCalled();

    twilioService.sendWhatsAppTemplate.mockResolvedValue({ success: false, error: 'bad' });
    await whatsappService.sendWhatsAppTemplateAsync('123', 'sid', { 1: 'a' });
    expect(twilioService.sendWhatsAppTemplate).toHaveBeenCalled();
  });
});
