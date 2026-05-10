const request = require('supertest');
const app = require('../../src/app');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
const { createTestCAAdmin, createTestClient, createTestDocument, cleanupTestData } = require('../helpers/testSetup');

describe('Thread Status Integration Tests', () => {
  beforeEach(async () => {
    await Promise.all([cleanupTestData(), Thread.deleteMany({}), Message.deleteMany({})]);
  });

  it('supports open, pending-*, resolved, and closed status flows', async () => {
    const { firm, caAdminToken } = await createTestCAAdmin();
    const { client, clientToken } = await createTestClient(firm._id);

    const createRes = await request(app)
      .post('/api/threads')
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({
        subject: 'Tax Filing Request',
        serviceType: 'Tax Filing',
        clientId: client._id.toString(),
        message: 'Please share the documents.'
      })
      .expect(201);

    const threadId = createRes.body?.data?.thread?._id;
    expect(threadId).toBeDefined();

    const threadAfterCreate = await Thread.findById(threadId);
    expect(threadAfterCreate.status).toBe('pending-client');

    await request(app)
      .post(`/api/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ content: 'Sure, uploading shortly.' })
      .expect(201);

    const threadAfterClientReply = await Thread.findById(threadId);
    expect(threadAfterClientReply.status).toBe('pending-ca');

    await request(app)
      .put(`/api/threads/${threadId}/resolve`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({ resolutionNotes: 'Completed.' })
      .expect(200);

    const threadAfterResolve = await Thread.findById(threadId);
    expect(threadAfterResolve.status).toBe('resolved');

    await request(app)
      .put(`/api/threads/${threadId}/close`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .expect(200);

    const threadAfterClose = await Thread.findById(threadId);
    expect(threadAfterClose.status).toBe('closed');

    await request(app)
      .post(`/api/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ content: 'Can you reopen this?' })
      .expect(400);

    await request(app)
      .put(`/api/threads/${threadId}/reopen`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .expect(200);

    const threadAfterReopen = await Thread.findById(threadId);
    expect(threadAfterReopen.status).toBe('open');
  });

  it('rejects removed statuses and does not create system messages', async () => {
    const { firm, caAdminToken } = await createTestCAAdmin();
    const { client } = await createTestClient(firm._id);

    const createRes = await request(app)
      .post('/api/threads')
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({
        subject: 'GST Return',
        serviceType: 'GST Return',
        clientId: client._id.toString(),
        message: 'Starting review.'
      })
      .expect(201);

    const threadId = createRes.body?.data?.thread?._id;
    const threadBefore = await Thread.findById(threadId);
    const messagesBefore = await Message.countDocuments({ threadId });

    await request(app)
      .put(`/api/threads/${threadId}`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({ status: 'invalid-status' })
      .expect(400);

    const threadAfter = await Thread.findById(threadId);
    expect(threadAfter.status).toBe(threadBefore.status);

    const messagesAfter = await Message.countDocuments({ threadId });
    expect(messagesAfter).toBe(messagesBefore);
  });

  it('requires attachments for chat payment requests and locks for client only', async () => {
    const { firm, caAdminUser, caAdminToken } = await createTestCAAdmin();
    const { client, clientToken } = await createTestClient(firm._id);

    const threadCreate = await request(app)
      .post('/api/threads')
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({
        subject: 'Deliverables',
        serviceType: 'Consultation',
        clientId: client._id.toString(),
        message: 'Sharing deliverables with payment request.'
      })
      .expect(201);

    const threadId = threadCreate.body?.data?.thread?._id;
    expect(threadId).toBeDefined();

    await request(app)
      .post(`/api/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({
        content: 'Please pay to access.',
        paymentRequired: true,
        paymentAmount: 5000
      })
      .expect(400);

    const document = await createTestDocument(client._id, firm._id, caAdminUser._id, {
      fileName: 'deliverable.pdf',
      originalName: 'deliverable.pdf',
      mimeType: 'application/pdf'
    });

    const messageCreate = await request(app)
      .post(`/api/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .send({
        content: 'Deliverable attached. Please pay.',
        attachments: [document._id.toString()],
        paymentRequired: true,
        paymentAmount: 5000
      })
      .expect(201);

    const messageId = messageCreate.body?.data?.message?._id;
    expect(messageId).toBeDefined();

    const clientAccessBlocked = await request(app)
      .get(`/api/documents/${document._id.toString()}/access`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(clientAccessBlocked.body?.data?.hasAccess).toBe(false);

    const caAccessAllowed = await request(app)
      .get(`/api/documents/${document._id.toString()}/access`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .expect(200);

    expect(caAccessAllowed.body?.data?.hasAccess).toBe(true);

    await request(app)
      .put(`/api/threads/${threadId}/messages/${messageId}/waive-payment`)
      .set('Authorization', `Bearer ${caAdminToken}`)
      .expect(200);

    const clientAccessAllowed = await request(app)
      .get(`/api/documents/${document._id.toString()}/access`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(clientAccessAllowed.body?.data?.hasAccess).toBe(true);
  });
});
