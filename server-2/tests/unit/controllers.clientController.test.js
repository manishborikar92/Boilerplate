const buildController = (overrides = {}) => {
  jest.resetModules();
  const clientModel = {
    findByEmail: jest.fn(),
    generateUserId: jest.fn(),
    generatePassword: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn()
  };
  const userModel = {
    findById: jest.fn(),
    create: jest.fn()
  };
  const firmModel = {
    findByAdmin: jest.fn()
  };
  const documentModel = {
    aggregate: jest.fn()
  };
  const emailService = {
    sendClientWelcomeEmail: jest.fn()
  };

  Object.assign(clientModel, overrides.Client || {});
  Object.assign(userModel, overrides.User || {});
  Object.assign(firmModel, overrides.Firm || {});
  Object.assign(documentModel, overrides.Document || {});
  Object.assign(emailService, overrides.emailService || {});

  jest.doMock('../../src/models/Client', () => clientModel);
  jest.doMock('../../src/models/User', () => userModel);
  jest.doMock('../../src/models/Firm', () => firmModel);
  jest.doMock('../../src/models/Document', () => documentModel);
  jest.doMock('../../src/services/emailService', () => emailService);

  const controller = require('../../src/controllers/clientController');
  return { controller, mocks: { Client: clientModel, User: userModel, Firm: firmModel, Document: documentModel, emailService } };
};

const run = async (handler, req) => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
  const next = jest.fn();
  await handler(req, res, next);
  await new Promise(setImmediate);
  return { res, next };
};

describe('clientController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin or missing firm on add', async () => {
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ role: 'Client' });
    const { next } = await run(controller.addClient, { user: { _id: 'u1' }, body: {} });
    expect(next.mock.calls[0][0].message).toContain('Only CA Admins');

    mocks.User.findById.mockResolvedValue({ role: 'CA-Admin', firmId: null });
    const { next: nextFirm } = await run(controller.addClient, { user: { _id: 'u1' }, body: {} });
    expect(nextFirm.mock.calls[0][0].message).toContain('complete your firm profile');
  });

  it('rejects duplicate client email', async () => {
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ role: 'CA-Admin', firmId: 'f1' });
    mocks.Client.findByEmail.mockResolvedValue({ _id: 'c1' });
    const { next } = await run(controller.addClient, { user: { _id: 'u1' }, body: { email: 'a@test.com' } });
    expect(next.mock.calls[0][0].message).toContain('already exists');
  });

  it('creates client and continues when email fails', async () => {
    const client = {
      _id: 'c1',
      email: 'a@test.com',
      companyName: 'ACME',
      firmId: 'f1',
      save: jest.fn(),
      toObject: jest.fn().mockReturnValue({ _id: 'c1' }),
      recordInvitation: jest.fn()
    };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ _id: 'u1', role: 'CA-Admin', firmId: 'f1', name: 'Admin' });
    mocks.Client.findByEmail.mockResolvedValue(null);
    mocks.Client.generateUserId.mockResolvedValue('CA-CLT-001');
    mocks.Client.generatePassword.mockReturnValue('Pass123!');
    mocks.Client.create.mockResolvedValue(client);
    mocks.User.create.mockResolvedValue({ _id: 'u2' });
    mocks.Firm.findByAdmin.mockResolvedValue({ firmName: 'Firm' });
    mocks.emailService.sendClientWelcomeEmail.mockRejectedValue(new Error('fail'));

    const { res, next } = await run(controller.addClient, {
      user: { _id: 'u1' },
      body: { companyName: 'ACME', email: 'a@test.com', phoneNumber: '1', companyType: 'LLP' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(client.save).toHaveBeenCalled();
  });

  it('returns clients with document counts', async () => {
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ firmId: 'f1' });
    mocks.Client.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: 'c1' }])
    });
    mocks.Document.aggregate.mockResolvedValue([{ _id: 'c1', count: 2 }]);
    mocks.Client.countDocuments.mockResolvedValue(1);

    const { res } = await run(controller.getClients, { user: { _id: 'u1' }, query: { search: 'ACME' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pagination: expect.objectContaining({ total: 1 }) })
    }));
  });

  it('gets client and enforces firm access', async () => {
    const client = { _id: 'c1', firmId: { _id: 'f2' } };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ firmId: 'f1' });
    mocks.Client.findOne.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(client)
    });
    const { next } = await run(controller.getClient, { params: { id: 'c1' }, user: { _id: 'u1' } });
    expect(next.mock.calls[0][0].message).toContain('Not authorized');
  });

  it('updates client and blocks email conflict', async () => {
    const client = { _id: 'c1', firmId: 'f1', email: 'a@test.com', save: jest.fn() };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ _id: 'u1', role: 'CA-Admin', firmId: 'f1' });
    mocks.Client.findOne.mockResolvedValueOnce(client).mockResolvedValueOnce({ _id: 'c2' });
    const { next } = await run(controller.updateClient, {
      params: { id: 'c1' },
      user: { _id: 'u1' },
      body: { email: 'b@test.com' }
    });
    expect(next.mock.calls[0][0].message).toContain('already exists');
  });

  it('returns client and updates fields successfully', async () => {
    const clientForGet = {
      _id: 'c1',
      firmId: { _id: 'f1' },
      companyName: 'Old',
      email: 'a@test.com',
      address: {},
      contactPerson: {},
      save: jest.fn()
    };
    const clientForUpdate = {
      _id: 'c1',
      firmId: 'f1',
      companyName: 'Old',
      email: 'a@test.com',
      address: {},
      contactPerson: {},
      save: jest.fn()
    };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ _id: 'u1', role: 'CA-Admin', firmId: 'f1' });
    mocks.Client.findOne.mockReturnValueOnce({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(clientForGet)
    }).mockResolvedValueOnce(clientForUpdate);

    const { res } = await run(controller.getClient, { params: { id: 'c1' }, user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);

    const { res: updateRes } = await run(controller.updateClient, {
      params: { id: 'c1' },
      user: { _id: 'u1' },
      body: { companyName: 'New', email: 'b@test.com' }
    });
    expect(updateRes.status).toHaveBeenCalledWith(200);
    expect(clientForUpdate.save).toHaveBeenCalled();
  });

  it('deletes client and resends credentials with error handling', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u2', userId: 'CA-CLT-001', companyName: 'ACME', email: 'a@test.com', softDelete: jest.fn(), recordInvitation: jest.fn() };
    const clientUser = { password: 'old', save: jest.fn() };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ _id: 'u1', role: 'CA-Admin', firmId: 'f1' });
    mocks.Client.findOne.mockResolvedValue(client);

    const { res } = await run(controller.deleteClient, { params: { id: 'c1' }, user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);

    mocks.User.findById.mockReturnValueOnce({ role: 'CA-Admin', _id: 'u1', firmId: 'f1' }).mockReturnValueOnce({ select: jest.fn().mockResolvedValue(clientUser) });
    mocks.Firm.findByAdmin.mockResolvedValue({ firmName: 'Firm' });
    mocks.emailService.sendClientWelcomeEmail.mockRejectedValue(new Error('fail'));
    const { next } = await run(controller.resendCredentials, { params: { id: 'c1' }, user: { _id: 'u1' } });
    expect(next.mock.calls[0][0].message).toContain('Failed to send email');
  });

  it('resends credentials successfully', async () => {
    const client = { _id: 'c1', firmId: 'f1', userAccountId: 'u2', userId: 'CA-CLT-001', companyName: 'ACME', email: 'a@test.com', recordInvitation: jest.fn() };
    const clientUser = { password: 'old', save: jest.fn() };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockReturnValueOnce({ role: 'CA-Admin', _id: 'u1', firmId: 'f1' }).mockReturnValueOnce({ select: jest.fn().mockResolvedValue(clientUser) });
    mocks.Client.findOne.mockResolvedValue(client);
    mocks.Firm.findByAdmin.mockResolvedValue({ firmName: 'Firm' });
    mocks.emailService.sendClientWelcomeEmail.mockResolvedValue();

    const { res } = await run(controller.resendCredentials, { params: { id: 'c1' }, user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(clientUser.save).toHaveBeenCalled();
    expect(client.recordInvitation).toHaveBeenCalled();
  });
});
