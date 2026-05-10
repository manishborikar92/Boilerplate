const loadModule = () => {
  let twilioConfig;
  let twilio;

  jest.isolateModules(() => {
    twilioConfig = require('../../src/config/twilio');
    twilio = require('twilio');
  });

  return { twilioConfig, twilio };
};

jest.mock('twilio', () => jest.fn(() => ({ client: 'twilio' })));

describe('twilio config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns null client when not configured', () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;

    const { twilioConfig } = loadModule();
    const client = twilioConfig.getClient();

    expect(client).toBeNull();
    expect(twilioConfig.isConfigured()).toBe(false);
  });

  it('initializes twilio client when configured', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+10000000000';
    process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+10000000000';

    const { twilioConfig, twilio } = loadModule();
    const client = twilioConfig.getClient();

    expect(client).toEqual({ client: 'twilio' });
    expect(twilio).toHaveBeenCalledWith('sid', 'token');
    expect(twilioConfig.isConfigured()).toBe(true);
    expect(twilioConfig.isWhatsAppConfigured()).toBe(true);
    expect(twilioConfig.getSmsNumber()).toBe('+10000000000');
    expect(twilioConfig.getWhatsAppNumber()).toBe('whatsapp:+10000000000');
  });

  it('returns null when twilio throws', () => {
    process.env.TWILIO_ACCOUNT_SID = 'sid';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_PHONE_NUMBER = '+10000000000';
    jest.resetModules();
    jest.doMock('twilio', () => {
      return jest.fn(() => {
        throw new Error('fail');
      });
    });

    const { twilioConfig } = loadModule();
    const client = twilioConfig.getClient();
    expect(client).toBeNull();
  });
});
