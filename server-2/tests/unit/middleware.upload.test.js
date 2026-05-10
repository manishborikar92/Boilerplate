jest.mock('multer', () => {
  class MulterError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }
  const multer = jest.fn((options) => ({
    options,
    storage: options.storage,
    limits: options.limits,
    fileFilter: options.fileFilter
  }));
  multer.memoryStorage = jest.fn(() => 'memory');
  multer.MulterError = MulterError;
  return multer;
});

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const { ValidationError } = require('../../src/utils/errorHandler');
const {
  createUploadMiddleware,
  handleUploadError,
  uploadAvatar,
  uploadMultipleFiles
} = require('../../src/middleware/upload');

describe('upload middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates upload middleware with provided limits', () => {
    const upload = createUploadMiddleware({
      allowedTypes: ['image/png'],
      maxSize: 123,
      maxFiles: 2
    });

    expect(upload.limits.fileSize).toBe(123);
    expect(upload.limits.files).toBe(2);
  });

  it('accepts allowed file types and rejects others', () => {
    const upload = createUploadMiddleware({
      allowedTypes: ['image/png'],
      maxSize: 100,
      maxFiles: 1
    });

    const cbAllowed = jest.fn();
    upload.fileFilter({}, { originalname: 'a.png', mimetype: 'image/png' }, cbAllowed);
    expect(cbAllowed).toHaveBeenCalledWith(null, true);

    const cbRejected = jest.fn();
    upload.fileFilter({}, { originalname: 'a.txt', mimetype: 'text/plain' }, cbRejected);
    expect(cbRejected.mock.calls[0][0]).toBeInstanceOf(ValidationError);
    expect(cbRejected).toHaveBeenCalledWith(expect.any(ValidationError), false);
  });

  it('handles multer errors by code', () => {
    const { MulterError } = require('multer');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    handleUploadError(new MulterError('LIMIT_FILE_SIZE'), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);

    handleUploadError(new MulterError('LIMIT_FILE_COUNT'), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);

    handleUploadError(new MulterError('LIMIT_UNEXPECTED_FILE'), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);

    handleUploadError(new MulterError('UNKNOWN'), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('handles validation errors', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    handleUploadError(new ValidationError('bad'), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad' });
  });

  it('passes non-multer errors to next', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    const err = new Error('boom');
    handleUploadError(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('builds predefined upload middleware presets', () => {
    expect(uploadAvatar.limits.files).toBe(1);
    expect(uploadMultipleFiles.limits.files).toBe(20);
  });
});
