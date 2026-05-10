const mongoose = require('mongoose');
const Thread = require('../../src/models/Thread');
const Counter = require('../../src/models/Counter');

describe('Thread model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  afterEach(async () => {
    await Thread.deleteMany({});
    await Counter.deleteMany({});
  });

  it('generates unique thread numbers', async () => {
    const number = await Thread.generateThreadNumber(firmId);
    expect(number).toMatch(/^THR-\d{4}-\d{5}$/);
  });

  it('filters threads by firm and client', async () => {
    await Thread.create({
      threadNumber: 'THR-2026-00001',
      subject: 'Alpha',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId,
      status: 'open',
      priority: 'high'
    });

    const byFirm = await Thread.findByFirm(firmId, { status: 'open' });
    expect(byFirm.length).toBe(1);

    const byClient = await Thread.findByClient(clientId, { serviceType: 'Consultation' });
    expect(byClient.length).toBe(1);
  });

  it('computes virtuals for overdue and days', async () => {
    const pastDeadline = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const thread = await Thread.create({
      threadNumber: 'THR-2026-00002',
      subject: 'Beta',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId,
      deadline: pastDeadline
    });

    expect(thread.isOverdue).toBe(true);
    expect(thread.daysUntilDeadline).toBeLessThanOrEqual(0);
    expect(thread.daysSinceCreation).toBeGreaterThanOrEqual(0);
  });

  it('updates last message and unread counts', async () => {
    const thread = await Thread.create({
      threadNumber: 'THR-2026-00003',
      subject: 'Gamma',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId
    });

    await thread.updateLastMessage({
      content: 'A'.repeat(220),
      senderRole: 'Client',
      attachments: [],
      inlineFiles: []
    });

    const updated = await Thread.findById(thread._id);
    expect(updated.lastMessage.content.length).toBe(200);
    expect(updated.unreadCountCA).toBe(1);
  });

  it('marks as read for roles', async () => {
    const thread = await Thread.create({
      threadNumber: 'THR-2026-00004',
      subject: 'Delta',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId,
      unreadCountCA: 2,
      unreadCountClient: 3
    });

    await thread.markAsRead('CA-Admin');
    let updated = await Thread.findById(thread._id);
    expect(updated.unreadCountCA).toBe(0);

    await updated.markAsRead('Client');
    updated = await Thread.findById(thread._id);
    expect(updated.unreadCountClient).toBe(0);
  });

  it('updates status and lifecycle flags', async () => {
    const thread = await Thread.create({
      threadNumber: 'THR-2026-00005',
      subject: 'Epsilon',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId
    });

    await thread.updateStatusAfterMessage('Client');
    let updated = await Thread.findById(thread._id);
    expect(updated.status).toBe('pending-ca');

    await updated.resolve(userId, 'Done');
    updated = await Thread.findById(thread._id);
    expect(updated.status).toBe('resolved');

    await updated.close();
    updated = await Thread.findById(thread._id);
    expect(updated.status).toBe('closed');

    await updated.softDelete(userId);
    updated = await Thread.findById(thread._id);
    expect(updated.isDeleted).toBe(true);
  });
});
