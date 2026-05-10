const mongoose = require('mongoose');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
require('../../src/models/User');
require('../../src/models/Document');

describe('Message model', () => {
  const firmId = new mongoose.Types.ObjectId();
  const clientId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  let thread;

  beforeEach(async () => {
    thread = await Thread.create({
      threadNumber: 'THR-2026-00001',
      subject: 'Test Thread',
      serviceType: 'Consultation',
      clientId,
      firmId,
      initiatedBy: 'CA-Admin',
      initiatedByUser: userId
    });
  });

  afterEach(async () => {
    await Message.deleteMany({});
    await Thread.deleteMany({});
  });

  it('computes virtuals and payment status on create', async () => {
    const message = await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Hello',
      attachments: [new mongoose.Types.ObjectId()],
      inlineFiles: [{
        fileName: 'x.pdf',
        cloudinaryUrl: 'http://x',
        cloudinaryPublicId: 'p1'
      }],
      paymentRequired: true,
      paymentAmount: 12500
    });

    expect(message.attachmentCount).toBe(2);
    expect(message.hasAttachments).toBe(true);
    expect(message.paymentAmountFormatted).toBe('₹125.00');
    expect(message.isPaymentPending).toBe(true);
    expect(message.paymentStatus).toBe('pending');
  });

  it('updates thread last message and unread counts', async () => {
    await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'A'.repeat(220)
    });

    const updatedThread = await Thread.findById(thread._id);
    expect(updatedThread.messageCount).toBe(1);
    expect(updatedThread.lastMessage.content.length).toBe(200);
    expect(updatedThread.unreadCountClient).toBe(1);
    expect(updatedThread.status).toBe('pending-client');
  });

  it('handles pagination and sorting for thread messages', async () => {
    await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'First'
    });
    await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Second'
    });

    const { messages, pagination } = await Message.getThreadMessages(thread._id, { page: 1, limit: 1, sortOrder: 'desc' });
    expect(messages.length).toBe(1);
    expect(pagination.total).toBe(2);

    await expect(Message.getThreadMessages(thread._id, { page: 0, limit: 200 }))
      .rejects.toThrow('Invalid pagination parameters');
  });

  it('marks messages as read and counts unread', async () => {
    await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'Client',
      content: 'Client message'
    });

    const unread = await Message.getUnreadCount(thread._id, 'CA-Admin');
    expect(unread).toBe(1);

    const modified = await Message.markAsRead(thread._id, 'CA-Admin');
    expect(modified).toBe(1);
  });

  it('gets pending payment messages', async () => {
    await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Payment',
      paymentRequired: true,
      paymentAmount: 1000
    });

    const pending = await Message.getPendingPaymentMessages(thread._id);
    expect(pending.length).toBe(1);
  });

  it('creates system messages', async () => {
    const systemMessage = await Message.createSystemMessage(
      thread._id,
      'status-changed',
      { oldStatus: 'open', newStatus: 'closed' },
      userId
    );
    expect(systemMessage.messageType).toBe('system');
    expect(systemMessage.content).toContain('Status changed');
  });

  it('edits content and enforces read lock', async () => {
    const message = await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Original'
    });

    await message.editContent('Updated');
    const updated = await Message.findById(message._id);
    expect(updated.isEdited).toBe(true);
    expect(updated.originalContent).toBe('Original');

    updated.isRead = true;
    await updated.save();
    await expect(updated.editContent('Nope')).rejects.toThrow('Cannot edit message after it has been read');
  });

  it('marks payment complete, waives payment, and soft deletes', async () => {
    const message = await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Payment',
      paymentRequired: true,
      paymentAmount: 1000
    });

    await message.markPaymentComplete(new mongoose.Types.ObjectId());
    let updated = await Message.findById(message._id);
    expect(updated.paymentStatus).toBe('paid');

    await updated.waivePayment();
    updated = await Message.findById(message._id);
    expect(updated.paymentStatus).toBe('waived');

    await updated.softDelete(userId);
    updated = await Message.findById(message._id);
    expect(updated.isDeleted).toBe(true);
  });

  it('checks modification rules', async () => {
    const message = await Message.create({
      threadId: thread._id,
      sender: userId,
      senderRole: 'CA-Admin',
      content: 'Editable'
    });
    expect(message.canModify()).toBe(true);

    message.isRead = true;
    expect(message.canModify()).toBe(false);
  });
});
