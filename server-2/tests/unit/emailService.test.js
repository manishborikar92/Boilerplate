const loadService = (nodemailerMock) => {
  jest.resetModules();
  jest.doMock('nodemailer', () => nodemailerMock);
  let service;
  jest.isolateModules(() => {
    service = require('../../src/services/emailService');
  });
  return service;
};

describe('emailService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('reuses transporter when already created', async () => {
    process.env.NODE_ENV = 'test';
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);

    const first = await service.createTransporter();
    const second = await service.createTransporter();

    expect(first).toBe(second);
    expect(nodemailerMock.createTransport).toHaveBeenCalledTimes(1);
  });

  it('creates json transport in test env', async () => {
    process.env.NODE_ENV = 'test';
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    await service.createTransporter();
    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({ jsonTransport: true });
  });

  it('creates ethereal transport in development without creds', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn().mockResolvedValue({ user: 'u', pass: 'p' }),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    await service.createTransporter();
    expect(nodemailerMock.createTestAccount).toHaveBeenCalled();
    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: 'u', pass: 'p' }
    });
  });

  it('falls back to console transport on test account failure', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    const nodemailerMock = {
      createTransport: jest.fn(),
      createTestAccount: jest.fn().mockRejectedValue(new Error('fail')),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const transporter = await service.createTransporter();
    const info = await transporter.sendMail({ to: 'a', subject: 'b' });
    expect(info.messageId).toBe('test-message-id');
  });

  it('creates smtp transport in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_USER = 'user';
    process.env.EMAIL_PASS = 'pass';
    process.env.EMAIL_HOST = 'smtp.test';
    process.env.EMAIL_PORT = '465';

    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn(() => 'url')
    };
    const service = loadService(nodemailerMock);
    await service.createTransporter();
    expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 465,
      secure: true,
      auth: { user: 'user', pass: 'pass' },
      tls: { rejectUnauthorized: false }
    });
  });

  it('sends email with attachments', async () => {
    process.env.NODE_ENV = 'test';
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn(() => 'url')
    };
    const service = loadService(nodemailerMock);
    await service.sendEmail('a@test.com', 'Sub', '<p>x</p>', [{ filename: 'a', path: '/a' }]);
    const options = sendMail.mock.calls[0][0];
    expect(options.attachments).toHaveLength(1);
  });

  it('sends verification email', async () => {
    process.env.NODE_ENV = 'test';
    const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendVerificationEmail('a@test.com', 'A', 'token');
    expect(sendEmailSpy).toHaveBeenCalled();
  });

  it('sends password reset email', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendPasswordResetEmail('a@test.com', 'A', 'token');
    expect(sendEmailSpy).toHaveBeenCalled();
  });

  it('sends task notification email with message and without', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendTaskNotificationEmail('a@test.com', 'A', 'Task', 'Open', 'Msg');
    await service.sendTaskNotificationEmail('a@test.com', 'A', 'Task', 'Open', '');
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
  });

  it('handles errors in task notification email', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(
      service.sendTaskNotificationEmail('a@test.com', 'A', 'Task', 'Open', 'Msg')
    ).rejects.toThrow('Failed to send task notification email');
  });

  it('handles errors in document request email', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(
      service.sendDocumentRequestEmail('a@test.com', 'A', 'Task', ['Doc'])
    ).rejects.toThrow('Failed to send document request email');
  });

  it('covers welcome email role branches', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendWelcomeEmail('a@test.com', 'A', 'CA-Admin');
    await service.sendWelcomeEmail('a@test.com', 'A', 'CA-Employee');
    await service.sendWelcomeEmail('a@test.com', 'A', 'Client');
    await service.sendWelcomeEmail('a@test.com', 'A', 'Other');
    expect(sendEmailSpy).toHaveBeenCalledTimes(4);
  });

  it('handles sendEmail errors in verification flow', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(service.sendVerificationEmail('a@test.com', 'A', 'token')).rejects.toThrow('Failed to send verification email');
  });

  it('handles sendEmail errors in password reset flow', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(service.sendPasswordResetEmail('a@test.com', 'A', 'token')).rejects.toThrow('Failed to send password reset email');
  });

  it('handles sendEmail errors in welcome flow', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(service.sendWelcomeEmail('a@test.com', 'A', 'Client')).rejects.toThrow('Failed to send welcome email');
  });

  it('sends document request email with empty list', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendDocumentRequestEmail('a@test.com', 'A', 'Task', []);
    expect(sendEmailSpy).toHaveBeenCalled();
  });

  it('tests configuration success and failure', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendVerificationEmail').mockResolvedValue({ ok: true });
    const ok = await service.testConfiguration('a@test.com');
    expect(ok.success).toBe(true);

    service.sendVerificationEmail.mockRejectedValueOnce(new Error('fail'));
    const fail = await service.testConfiguration('a@test.com');
    expect(fail.success).toBe(false);
  });

  it('sends client welcome email and attachment email', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    const sendEmailSpy = jest.spyOn(service, 'sendEmail').mockResolvedValue({ ok: true });
    await service.sendClientWelcomeEmail({
      email: 'a@test.com',
      companyName: 'Co',
      userId: 'U1',
      password: 'P1',
      firmName: 'Firm'
    });
    await service.sendEmailWithAttachment('a@test.com', 'A', 'Sub', 'Msg', '/tmp/a', 'a.pdf');
    expect(sendEmailSpy).toHaveBeenCalled();
  });

  it('handles errors in client welcome email', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(
      service.sendClientWelcomeEmail({
        email: 'a@test.com',
        companyName: 'Co',
        userId: 'U1',
        password: 'P1',
        firmName: 'Firm'
      })
    ).rejects.toThrow('Failed to send client welcome email');
  });

  it('handles errors in email with attachment', async () => {
    process.env.NODE_ENV = 'test';
    const nodemailerMock = {
      createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: '1' }) })),
      createTestAccount: jest.fn(),
      getTestMessageUrl: jest.fn()
    };
    const service = loadService(nodemailerMock);
    jest.spyOn(service, 'sendEmail').mockRejectedValue(new Error('fail'));
    await expect(
      service.sendEmailWithAttachment('a@test.com', 'A', 'Sub', 'Msg', '/tmp/a', 'a.pdf')
    ).rejects.toThrow('Failed to send email with attachment');
  });
});
