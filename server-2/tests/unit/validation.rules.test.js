const { validationResult } = require('express-validator');

const runValidations = async (validations, req) => {
  for (const validation of validations) {
    await validation.run(req);
  }
  return validationResult(req);
};

const loadValidationModule = (isValidFormatValue) => {
  jest.resetModules();
  jest.doMock('../../src/utils/phoneNumber', () => ({
    isValidFormat: jest.fn(() => isValidFormatValue)
  }));
  return require('../../src/middleware/validation');
};

describe('validation rules', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('enforces CA-Admin role during registration', async () => {
    const { registerValidation } = loadValidationModule(true);
    const req = { body: { email: 'a@test.com', password: 'Password1!', name: 'Test', role: 'Client' } };
    const result = await runValidations(registerValidation, req);
    expect(result.isEmpty()).toBe(false);
  });

  it('allows CA-Admin role during registration', async () => {
    const { registerValidation } = loadValidationModule(true);
    const req = { body: { email: 'a@test.com', password: 'Password1!', name: 'Test', role: 'CA-Admin' } };
    const result = await runValidations(registerValidation, req);
    expect(result.isEmpty()).toBe(true);
  });

  it('requires email or userId during login', async () => {
    const { loginValidation } = loadValidationModule(true);
    const req = { body: { password: 'Password1!' } };
    const result = await runValidations(loginValidation, req);
    expect(result.isEmpty()).toBe(false);
  });

  it('accepts login when email provided', async () => {
    const { loginValidation } = loadValidationModule(true);
    const req = { body: { email: 'a@test.com', password: 'Password1!' } };
    const result = await runValidations(loginValidation, req);
    expect(result.isEmpty()).toBe(true);
  });

  it('validates phone formats in firm profile and client flows', async () => {
    const invalidModule = loadValidationModule(false);
    const invalidReq = {
      body: {
        contactNumber: 'bad',
        alternateContactNumber: 'bad',
        phoneNumber: 'bad'
      }
    };

    let result = await runValidations(invalidModule.completeProfileValidation, invalidReq);
    expect(result.isEmpty()).toBe(false);

    result = await runValidations(invalidModule.updateFirmValidation, invalidReq);
    expect(result.isEmpty()).toBe(false);

    result = await runValidations(invalidModule.updateAdminProfileValidation, invalidReq);
    expect(result.isEmpty()).toBe(false);

    result = await runValidations(invalidModule.addClientValidation, {
      body: { companyName: 'Test Co', email: 'a@test.com', phoneNumber: 'bad', companyType: 'Pvt. Ltd.' }
    });
    expect(result.isEmpty()).toBe(false);

    result = await runValidations(invalidModule.updateClientValidation, { body: { phoneNumber: 'bad' } });
    expect(result.isEmpty()).toBe(false);

    const validModule = loadValidationModule(true);
    const validReq = {
      body: {
        firmName: 'Test Firm',
        registrationNumber: 'REG123',
        officialEmail: 'firm@test.com',
        contactNumber: '+91 9822685547',
        pan: 'ABCDE1234F',
        bankDetails: {
          bankName: 'Bank',
          accountHolderName: 'Holder',
          accountNumber: '1234567890',
          ifscCode: 'ABCD0123456'
        }
      }
    };
    result = await runValidations(validModule.completeProfileValidation, validReq);
    expect(result.isEmpty()).toBe(true);
  });
});
