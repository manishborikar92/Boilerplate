jest.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendTaskNotificationEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendDocumentRequestEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendEmailWithAttachment: jest.fn().mockResolvedValue({ ok: true }),
  testConfiguration: jest.fn().mockResolvedValue({ ok: true })
}));

const emailService = require('../../src/services/emailService');
const emailUtil = require('../../src/utils/email');

describe('email util', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends verification email with token', async () => {
    await emailUtil.sendVerificationEmail('a@test.com', 'A', 'http://x/verify/token123');
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('a@test.com', 'A', 'token123');
  });

  it('sends password reset email with token', async () => {
    await emailUtil.sendPasswordResetEmail('a@test.com', 'A', 'http://x/reset/token456');
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('a@test.com', 'A', 'token456');
  });

  it('sends welcome email', async () => {
    await emailUtil.sendWelcomeEmail('a@test.com', 'A', 'Client');
    expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith('a@test.com', 'A', 'Client');
  });

  it('sends task notification email', async () => {
    await emailUtil.sendTaskNotificationEmail('a@test.com', 'A', 'Task', 'Open', 'msg');
    expect(emailService.sendTaskNotificationEmail).toHaveBeenCalledWith('a@test.com', 'A', 'Task', 'Open', 'msg');
  });

  it('sends document request email', async () => {
    await emailUtil.sendDocumentRequestEmail('a@test.com', 'A', 'Task', ['Doc']);
    expect(emailService.sendDocumentRequestEmail).toHaveBeenCalledWith('a@test.com', 'A', 'Task', ['Doc']);
  });

  it('sends email with attachment', async () => {
    await emailUtil.sendEmailWithAttachment('a@test.com', 'A', 'Sub', 'Msg', '/tmp/a', 'a.pdf');
    expect(emailService.sendEmailWithAttachment).toHaveBeenCalledWith('a@test.com', 'A', 'Sub', 'Msg', '/tmp/a', 'a.pdf');
  });

  it('tests email configuration', async () => {
    await emailUtil.testEmailConfiguration('a@test.com');
    expect(emailService.testConfiguration).toHaveBeenCalledWith('a@test.com');
  });

  it('throws when service errors', async () => {
    emailService.sendWelcomeEmail.mockRejectedValueOnce(new Error('fail'));
    await expect(emailUtil.sendWelcomeEmail('a@test.com', 'A')).rejects.toThrow('Failed to send welcome email');
  });

  it('throws when verification email fails', async () => {
    emailService.sendVerificationEmail.mockRejectedValueOnce(new Error('fail'));
    await expect(
      emailUtil.sendVerificationEmail('a@test.com', 'A', 'http://x/verify/token123')
    ).rejects.toThrow('Failed to send verification email');
  });

  it('throws when password reset email fails', async () => {
    emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error('fail'));
    await expect(
      emailUtil.sendPasswordResetEmail('a@test.com', 'A', 'http://x/reset/token456')
    ).rejects.toThrow('Failed to send password reset email');
  });
});
