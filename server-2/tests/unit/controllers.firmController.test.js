const buildController = (overrides = {}) => {
  jest.resetModules();
  const firmModel = {
    findByAdmin: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn()
  };
  const userModel = {
    findById: jest.fn()
  };
  const cloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    extractPublicId: jest.fn()
  };
  const paymentModel = {
    updateMany: jest.fn()
  };

  Object.assign(firmModel, overrides.Firm || {});
  Object.assign(userModel, overrides.User || {});
  Object.assign(cloudinaryService, overrides.CloudinaryService || {});
  Object.assign(paymentModel, overrides.Payment || {});

  jest.doMock('../../src/models/Firm', () => firmModel);
  jest.doMock('../../src/models/User', () => userModel);
  jest.doMock('../../src/models/Payment', () => paymentModel);
  jest.doMock('../../src/services/cloudinaryService', () => cloudinaryService);
  jest.doMock('../../src/config/fileUpload', () => ({
    FOLDER_STRUCTURE: { FIRMS: { LOGOS: 'firms/logos' }, USERS: { AVATARS: 'users/avatars' } }
  }));
  jest.doMock('../../src/middleware/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
  }));

  const controller = require('../../src/controllers/firmController');
  return { controller, mocks: { Firm: firmModel, User: userModel, CloudinaryService: cloudinaryService, Payment: paymentModel } };
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

describe('firmController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-admin and existing firm on complete profile', async () => {
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue({ role: 'Client' });
    const { next } = await run(controller.completeProfile, { user: { _id: 'u1' }, body: {} });
    expect(next.mock.calls[0][0].message).toContain('Only CA Admins');

    mocks.User.findById.mockResolvedValue({ role: 'CA-Admin', _id: 'u1' });
    mocks.Firm.findByAdmin.mockResolvedValue({ _id: 'f1' });
    const { next: nextFirm } = await run(controller.completeProfile, { user: { _id: 'u1' }, body: { firmName: 'Firm', officialEmail: 'a@test.com', contactNumber: '1' } });
    expect(nextFirm.mock.calls[0][0].message).toContain('already exists');
  });

  it('creates firm profile and handles subscription update error', async () => {
    const user = { _id: 'u1', role: 'CA-Admin', save: jest.fn() };
    const firm = { _id: 'f1' };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValue(user);
    mocks.Firm.findByAdmin.mockResolvedValue(null);
    mocks.Firm.create.mockResolvedValue(firm);
    mocks.Payment.updateMany.mockRejectedValue(new Error('fail'));

    const { res, next } = await run(controller.completeProfile, {
      user: { _id: 'u1' },
      body: { firmName: 'Firm', officialEmail: 'a@test.com', contactNumber: '1' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('updates firm and handles logo replacement', async () => {
    const firm = { _id: 'f1', adminId: 'u1', firmLogo: 'old', save: jest.fn(), address: {}, bankDetails: {} };
    const { controller, mocks } = buildController({
      Firm: { findOne: jest.fn().mockResolvedValue(firm) }
    });
    mocks.CloudinaryService.extractPublicId.mockReturnValue('old-id');
    mocks.CloudinaryService.deleteFile.mockRejectedValue(new Error('fail'));
    mocks.CloudinaryService.uploadFile.mockResolvedValue({ url: 'new' });

    const { res, next } = await run(controller.updateFirm, {
      params: { id: 'f1' },
      user: { _id: 'u1' },
      file: { buffer: Buffer.from('x') },
      body: { firmName: 'New' }
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('gets firm and checks authorization', async () => {
    const firm = { _id: 'f1', adminId: { _id: 'u2' } };
    const { controller, mocks } = buildController();
    mocks.Firm.findOne.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(firm)
    });
    const { next } = await run(controller.getFirm, { params: { id: 'f1' }, user: { _id: 'u1', role: 'CA-Admin' } });
    expect(next.mock.calls[0][0].message).toContain('Not authorized');
  });

  it('gets current firm and updates admin profile', async () => {
    const firm = { _id: 'f1' };
    const user = { _id: 'u1', role: 'CA-Admin', save: jest.fn() };
    const { controller, mocks } = buildController();
    mocks.User.findById.mockResolvedValueOnce({ _id: 'u1', firmId: 'f1' }).mockResolvedValueOnce(user);
    mocks.Firm.findOne.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: (resolve) => resolve(firm)
    });

    const { res } = await run(controller.getMyFirm, { user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);

    const { res: profileRes } = await run(controller.updateAdminProfile, { user: { _id: 'u1' }, body: { name: 'Admin' } });
    expect(profileRes.status).toHaveBeenCalledWith(200);
  });

  it('deletes firm with authorization checks', async () => {
    const firm = { _id: 'f1', adminId: 'u1', softDelete: jest.fn() };
    const { controller, mocks } = buildController({
      Firm: { findOne: jest.fn().mockResolvedValue(firm) }
    });
    const { res } = await run(controller.deleteFirm, { params: { id: 'f1' }, user: { _id: 'u1' } });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
