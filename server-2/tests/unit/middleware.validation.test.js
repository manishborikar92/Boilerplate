jest.mock('express-validator', () => {
  const actual = jest.requireActual('express-validator');
  return {
    ...actual,
    validationResult: jest.fn()
  };
});

const { validationResult } = require('express-validator');
const { validate, parseFormDataJSON } = require('../../src/middleware/validation');

describe('validation middleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns errors when validation fails', () => {
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ msg: 'error' }]
    });

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when no validation errors', () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });

    validate(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('parses json fields and builds bankDetails from legacy fields', () => {
    const middleware = parseFormDataJSON(['meta']);
    const req = {
      body: {
        meta: JSON.stringify({ a: 1 }),
        bankName: 'Bank',
        accountHolderName: 'Holder',
        accountNumber: '123',
        ifscCode: 'IFSC',
        accountType: 'saving',
        branchName: 'Main'
      }
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.body.meta).toEqual({ a: 1 });
    expect(req.body.bankDetails).toEqual({
      bankName: 'Bank',
      accountHolderName: 'Holder',
      accountNumber: '123',
      ifscCode: 'IFSC',
      accountType: 'saving',
      branchName: 'Main'
    });
    expect(next).toHaveBeenCalled();
  });

  it('leaves invalid json fields untouched', () => {
    const middleware = parseFormDataJSON(['meta']);
    const req = { body: { meta: '{bad json' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(req.body.meta).toBe('{bad json');
    expect(next).toHaveBeenCalled();
  });
});
