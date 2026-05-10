const loadService = ({ client = null, smsNumber = null, messagingServiceSid = null, whatsappNumber = null, normalize = null } = {}) => {
  jest.resetModules();
  jest.doMock('../../src/config/twilio', () => ({
    getClient: jest.fn(() => client),
    getSmsNumber: jest.fn(() => smsNumber),
    getMessagingServiceSid: jest.fn(() => messagingServiceSid),
    getWhatsAppNumber: jest.fn(() => whatsappNumber)
  }));
  jest.doMock('../../src/utils/phoneNumber', () => ({
    normalizePhoneNumber: jest.fn((value) => (normalize ? normalize(value) : value))
  }));
  jest.doMock('../../src/middleware/logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  }));
  let service;
  jest.isolateModules(() => {
    service = require('../../src/services/twilioService');
  });
  return service;
};

describe('twilioService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('returns errors when twilio not configured', async () => {
    const service = loadService();
    const sms = await service.sendSMS('123', 'msg');
    const wa = await service.sendWhatsApp('123', 'msg');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });

  it('uses frontend url from environment', async () => {
    process.env.FRONTEND_URL = 'http://example.com';
    const service = loadService();
    expect(service.config.clientUrl).toBe('http://example.com');
  });

  it('returns errors when numbers not configured', async () => {
    const client = { messages: { create: jest.fn() } };
    const service = loadService({ client, smsNumber: null, whatsappNumber: null });
    const sms = await service.sendSMS('123', 'msg');
    const wa = await service.sendWhatsApp('123', 'msg');
    expect(sms.error).toBe('SMS number not configured');
    expect(wa.error).toBe('WhatsApp number not configured');
  });

  it('handles invalid phone numbers', async () => {
    const client = { messages: { create: jest.fn() } };
    const service = loadService({
      client,
      smsNumber: '+10000000000',
      whatsappNumber: '+10000000000',
      normalize: () => null
    });
    const sms = await service.sendSMS('bad', 'msg');
    const wa = await service.sendWhatsApp('bad', 'msg');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });

  it('sends sms and whatsapp successfully', async () => {
    const client = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'sid', status: 'sent' })
      }
    };
    const service = loadService({
      client,
      smsNumber: '+10000000000',
      whatsappNumber: '+10000000000',
      normalize: (value) => `+${value}`
    });
    const sms = await service.sendSMS('123', 'msg');
    const wa = await service.sendWhatsApp('123', 'msg');
    expect(sms.success).toBe(true);
    expect(wa.success).toBe(true);
  });

  it('sends whatsapp template successfully', async () => {
    const client = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'sid', status: 'sent' })
      }
    };
    const service = loadService({
      client,
      whatsappNumber: '+10000000000',
      normalize: (value) => `+${value}`
    });

    const wa = await service.sendWhatsAppTemplate('123', 'HXtemplate', { 1: 'Line1\nLine2' });
    expect(wa.success).toBe(true);

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'whatsapp:+10000000000',
        to: 'whatsapp:+123',
        contentSid: 'HXtemplate',
        contentVariables: JSON.stringify({ '1': 'Line1 Line2' })
      })
    );
  });

  it('returns error when whatsapp template sid missing', async () => {
    const client = { messages: { create: jest.fn() } };
    const service = loadService({
      client,
      whatsappNumber: '+10000000000',
      normalize: (value) => `+${value}`
    });
    const wa = await service.sendWhatsAppTemplate('123', null, { 1: 'x' });
    expect(wa.success).toBe(false);
    expect(wa.error).toBe('WhatsApp template not configured');
  });

  it('handles send errors', async () => {
    const client = {
      messages: {
        create: jest.fn().mockRejectedValue(Object.assign(new Error('fail'), { code: '500' }))
      }
    };
    const service = loadService({
      client,
      smsNumber: '+10000000000',
      whatsappNumber: '+10000000000',
      normalize: (value) => `+${value}`
    });
    const sms = await service.sendSMS('123', 'msg');
    const wa = await service.sendWhatsApp('123', 'msg');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });

  it('tests sms and whatsapp configuration', async () => {
    const client = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'sid', status: 'sent' })
      }
    };
    const service = loadService({
      client,
      smsNumber: '+10000000000',
      whatsappNumber: '+10000000000',
      normalize: (value) => `+${value}`
    });
    const sms = await service.testSMS('123');
    const wa = await service.testWhatsApp('123');
    expect(sms.success).toBe(true);
    expect(wa.success).toBe(true);
  });

  it('handles test failures', async () => {
    const client = {
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'sid', status: 'sent' })
      }
    };
    const service = loadService({
      client,
      smsNumber: '+10000000000',
      whatsappNumber: '+10000000000',
      normalize: () => null
    });
    const sms = await service.testSMS('bad');
    const wa = await service.testWhatsApp('bad');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });

  it('handles test errors', async () => {
    const service = loadService();
    const sms = await service.testSMS('123');
    const wa = await service.testWhatsApp('123');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });

  it('handles exceptions in test methods', async () => {
    const service = loadService();
    jest.spyOn(service, 'sendSMS').mockRejectedValue(new Error('fail'));
    jest.spyOn(service, 'sendWhatsApp').mockRejectedValue(new Error('fail'));
    const sms = await service.testSMS('123');
    const wa = await service.testWhatsApp('123');
    expect(sms.success).toBe(false);
    expect(wa.success).toBe(false);
  });
});
