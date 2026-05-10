const mongoose = require('mongoose');
const Client = require('../../src/models/Client');
const User = require('../../src/models/User');

describe('Client model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Client.deleteMany({});
    await User.deleteMany({});
  });

  it('handles virtuals and toJSON behavior', async () => {
    const client = await Client.create({
      companyName: 'Test Co',
      email: 'client@test.com',
      phoneNumber: '+91 9822685547',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-TEST01',
      firmId,
      createdBy: adminId,
      address: {
        street: 'Street',
        city: 'City',
        state: 'State',
        pinCode: '411001',
        country: 'India'
      },
      totalPayments: 2,
      totalAmountPaid: 4000
    });

    expect(client.fullAddress).toContain('Street');
    expect(client.accountStatus).toBe('pending');
    expect(client.averagePaymentAmount).toBe('2000.00');
    expect(client.daysSinceCreation).toBeGreaterThanOrEqual(0);

    client.isDeleted = true;
    const json = client.toJSON();
    expect(json).toBeNull();
  });

  it('updates activity and counters', async () => {
    const client = await Client.create({
      companyName: 'Test Co',
      email: 'client2@test.com',
      phoneNumber: '+91 9822685548',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-TEST02',
      firmId,
      createdBy: adminId
    });

    await client.updateActivity();
    await client.incrementDocumentCount();
    await client.addOutstanding(1000);
    await client.addPayment(500);
    await client.addPayment(1000);

    const updated = await Client.findById(client._id);
    expect(updated.totalDocuments).toBe(1);
    expect(updated.totalPayments).toBe(2);
    expect(updated.outstandingAmount).toBe(0);
  });

  it('activates account and records invitations', async () => {
    const user = await User.create({
      email: 'client-user@test.com',
      password: 'Password1!',
      name: 'Client User',
      role: 'Client',
      isActive: true
    });

    const client = await Client.create({
      companyName: 'Test Co',
      email: 'client3@test.com',
      phoneNumber: '+91 9822685549',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-TEST03',
      firmId,
      createdBy: adminId
    });

    await client.activateAccount(user._id);
    await client.recordInvitation();
    await client.recordFirstLogin();
    await client.recordFirstLogin();

    const updated = await Client.findById(client._id);
    expect(updated.accountCreated).toBe(true);
    expect(updated.invitationSent).toBe(true);
    expect(updated.invitationCount).toBe(1);
    expect(updated.firstLoginAt).toBeDefined();
    expect(updated.accountStatus).toBe('active');
  });

  it('tracks days since last activity and active account status', async () => {
    const client = await Client.create({
      companyName: 'Test Co',
      email: 'client5@test.com',
      phoneNumber: '+91 9822685551',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-TEST05',
      firmId,
      createdBy: adminId,
      accountCreated: true
    });

    client.lastActivityAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await client.save();
    const updated = await Client.findById(client._id);
    expect(updated.daysSinceLastActivity).toBeGreaterThanOrEqual(1);
    expect(updated.accountStatus).toBe('invited');

    updated.firstLoginAt = new Date();
    await updated.save();
    const active = await Client.findById(client._id);
    expect(active.accountStatus).toBe('active');
  });

  it('generates passwords with mixed characters', () => {
    const password = Client.generatePassword();
    expect(password.length).toBe(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[@#$%&*!]/);
  });

  it('generates unique userId with retries', async () => {
    jest.useFakeTimers();
    const existsSpy = jest.spyOn(Client, 'exists');
    existsSpy.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const promise = Client.generateUserId(firmId);
    jest.runAllTimers();
    const userId = await promise;
    expect(userId).toMatch(/^CA-CLT-[A-Z0-9]{6}$/);
    existsSpy.mockRestore();
    jest.useRealTimers();
  });

  it('finds active clients and soft deletes', async () => {
    const client = await Client.create({
      companyName: 'Test Co',
      email: 'client4@test.com',
      phoneNumber: '+91 9822685550',
      companyType: 'Pvt. Ltd.',
      userId: 'CA-CLT-TEST04',
      firmId,
      createdBy: adminId
    });

    const active = await Client.findActive({ firmId });
    expect(active.length).toBe(1);

    await client.softDelete(adminId);
    const byFirm = await Client.findByFirm(firmId);
    expect(byFirm.length).toBe(0);
  });
});
