const loadModule = () => {
  let initializeCloudinary;
  let logger;
  let cloudinary;

  jest.isolateModules(() => {
    ({ initializeCloudinary } = require('../../src/config/cloudinary'));
    ({ logger } = require('../../src/middleware/logger'));
    ({ v2: cloudinary } = require('cloudinary'));
  });

  return { initializeCloudinary, logger, cloudinary };
};

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn()
  }
}));

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('cloudinary config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('returns false when credentials missing', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const { initializeCloudinary, logger } = loadModule();
    const result = initializeCloudinary();

    expect(result).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('configures cloudinary when credentials present', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';

    const { initializeCloudinary, logger, cloudinary } = loadModule();
    const result = initializeCloudinary();

    expect(result).toBe(true);
    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'cloud',
      api_key: 'key',
      api_secret: 'secret',
      secure: true
    });
    expect(logger.info).toHaveBeenCalled();
  });

  it('throws when cloudinary config fails', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
    process.env.CLOUDINARY_API_KEY = 'key';
    process.env.CLOUDINARY_API_SECRET = 'secret';

    const { initializeCloudinary, logger, cloudinary } = loadModule();
    cloudinary.config.mockImplementation(() => {
      throw new Error('boom');
    });

    expect(() => initializeCloudinary()).toThrow('boom');
    expect(logger.error).toHaveBeenCalled();
  });
});
