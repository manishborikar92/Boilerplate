const { requireEmailVerification } = require('../../src/middleware/emailVerification');
const { AuthorizationError } = require('../../src/utils/errorHandler');

describe('emailVerification middleware', () => {
  it('throws when no user on request', async () => {
    const req = {};
    const res = {};
    const next = jest.fn();
    await requireEmailVerification(req, res, next);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('throws when email not verified', async () => {
    const req = { user: { isEmailVerified: false } };
    const res = {};
    const next = jest.fn();
    await requireEmailVerification(req, res, next);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('passes when email verified', async () => {
    const req = { user: { isEmailVerified: true } };
    const res = {};
    const next = jest.fn();
    await requireEmailVerification(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
