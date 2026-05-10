const loadModule = () => {
  let initializeRazorpay;
  let logger;
  let Razorpay;

  jest.isolateModules(() => {
    ({ initializeRazorpay } = require('../../src/config/razorpay'));
    ({ logger } = require('../../src/middleware/logger'));
    Razorpay = require('razorpay');
  });

  return { initializeRazorpay, logger, Razorpay };
};

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('razorpay', () => jest.fn());

describe('razorpay config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('returns null when credentials missing', () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const { initializeRazorpay, logger } = loadModule();
    const instance = initializeRazorpay();

    expect(instance).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('initializes razorpay with credentials', () => {
    process.env.RAZORPAY_KEY_ID = 'key';
    process.env.RAZORPAY_KEY_SECRET = 'secret';

    const { initializeRazorpay, Razorpay, logger } = loadModule();
    const instance = initializeRazorpay();

    expect(Razorpay).toHaveBeenCalledWith({
      key_id: 'key',
      key_secret: 'secret'
    });
    expect(instance).toBeDefined();
    expect(logger.info).toHaveBeenCalled();
  });

  it('throws when razorpay initialization fails', () => {
    process.env.RAZORPAY_KEY_ID = 'key';
    process.env.RAZORPAY_KEY_SECRET = 'secret';

    const { initializeRazorpay, Razorpay, logger } = loadModule();
    Razorpay.mockImplementation(() => {
      throw new Error('fail');
    });

    expect(() => initializeRazorpay()).toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });
});
