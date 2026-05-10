const request = require('supertest');
const app = require('../../src/app');
const {
    createTestCAAdmin,
    createTestClient,
    createTestDocument,
    createTestThread,
    createTestMessage,
    cleanupTestData
} = require('../helpers/testSetup');

describe('Shared Conversation Documents Routes', () => {
    let caAdminUser, firm, caAdminToken;
    let client, clientUser, clientToken;

    beforeEach(async () => {
        await cleanupTestData();

        const adminSetup = await createTestCAAdmin();
        caAdminUser = adminSetup.caAdminUser;
        firm = adminSetup.firm;
        caAdminToken = adminSetup.caAdminToken;

        const clientSetup = await createTestClient(firm._id);
        client = clientSetup.client;
        clientUser = clientSetup.clientUser;
        clientToken = clientSetup.clientToken;
    });

    afterEach(async () => {
        await cleanupTestData();
    });

    describe('GET /api/documents/client/:clientId/shared', () => {
        it('should return empty array when no shared documents', async () => {
            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents).toEqual([]);
            expect(res.body.data.pagination.total).toBe(0);
        });

        it('should return shared documents with payment status', async () => {
            // Create a thread
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            // Create a document
            const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'shared-doc.pdf',
                cloudinaryPublicId: `shared-${Date.now()}`
            });

            // Create a message with the document attached (from CA-Admin)
            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                content: 'Here is your document',
                attachments: [doc._id],
                messageType: 'document-delivery'
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(1);
            expect(res.body.data.documents[0].fileName).toBe('shared-doc.pdf');
            expect(res.body.data.documents[0].messagePaymentStatus).toBe('not-required');
        });

        it('should return documents with pending payment status', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'paid-doc.pdf',
                cloudinaryPublicId: `paid-${Date.now()}`
            });

            // Create a message with payment required
            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                content: 'Payment required for this document',
                attachments: [doc._id],
                paymentRequired: true,
                paymentAmount: 25000,
                paymentDescription: 'Document access fee',
                paymentStatus: 'pending'
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(1);
            expect(res.body.data.documents[0].messagePaymentStatus).toBe('pending');
            expect(res.body.data.documents[0].messagePaymentRequired).toBe(true);
            expect(res.body.data.documents[0].messagePaymentAmount).toBe(25000);
        });

        it('should support pagination', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            // Create multiple documents and messages
            for (let i = 0; i < 5; i++) {
                const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                    fileName: `doc-${i}.pdf`,
                    cloudinaryPublicId: `doc-${Date.now()}-${i}`
                });

                await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                    content: `Document ${i}`,
                    attachments: [doc._id]
                });
            }

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared?page=1&limit=2`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(2);
            expect(res.body.data.pagination.total).toBe(5);
            expect(res.body.data.pagination.pages).toBe(3);
        });

        it('should support search functionality', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            const doc1 = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'tax-return-2024.pdf',
                cloudinaryPublicId: `tax-${Date.now()}`
            });

            const doc2 = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'invoice-001.pdf',
                cloudinaryPublicId: `invoice-${Date.now()}`
            });

            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                attachments: [doc1._id]
            });

            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                attachments: [doc2._id]
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared?search=tax`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(1);
            expect(res.body.data.documents[0].fileName).toBe('tax-return-2024.pdf');
        });

        it('should validate pagination parameters (negative values)', async () => {
            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared?page=-1&limit=-10`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            // Should normalize to valid values (page=1, limit=1 for negative values)
            expect(res.body.data.pagination.page).toBe(1);
            expect(res.body.data.pagination.limit).toBe(1);
        });

        it('should enforce maximum limit', async () => {
            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared?limit=1000`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            // Should cap at 100
            expect(res.body.data.pagination.limit).toBe(100);
        });

        it('should require authentication', async () => {
            await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .expect(401);
        });

        it('should not allow client to access other client documents', async () => {
            const { client: otherClient, clientToken: otherToken } = await createTestClient(firm._id, {
                email: `other-${Date.now()}@test.com`
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${otherToken}`)
                .expect(403);

            expect(res.body.success).toBe(false);
        });

        it('should allow CA-Admin to access client documents', async () => {
            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${caAdminToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
        });

        it('should not include documents from deleted messages', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'deleted-msg-doc.pdf',
                cloudinaryPublicId: `deleted-${Date.now()}`
            });

            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                attachments: [doc._id],
                isDeleted: true
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(0);
        });

        it('should not include documents from Client-sent messages', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'client-uploaded.pdf',
                cloudinaryPublicId: `client-${Date.now()}`
            });

            // Message from client (not CA-Admin)
            await createTestMessage(thread._id, clientUser._id, 'Client', {
                attachments: [doc._id]
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.documents.length).toBe(0);
        });

        it('should return 404 for non-existent client', async () => {
            const fakeId = '507f1f77bcf86cd799439011';

            const res = await request(app)
                .get(`/api/documents/client/${fakeId}/shared`)
                .set('Authorization', `Bearer ${caAdminToken}`)
                .expect(404);

            expect(res.body.success).toBe(false);
        });

        it('should return most recent shared date for duplicate documents', async () => {
            const thread = await createTestThread(client._id, firm._id, caAdminUser._id);

            const doc = await createTestDocument(client._id, firm._id, caAdminUser._id, {
                fileName: 'shared-multiple.pdf',
                cloudinaryPublicId: `multi-${Date.now()}`
            });

            // Share same document twice
            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                attachments: [doc._id],
                createdAt: new Date('2026-01-01')
            });

            await createTestMessage(thread._id, caAdminUser._id, 'CA-Admin', {
                attachments: [doc._id],
                createdAt: new Date('2026-01-15')
            });

            const res = await request(app)
                .get(`/api/documents/client/${client._id}/shared`)
                .set('Authorization', `Bearer ${clientToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            // Should only have one document (deduplicated)
            expect(res.body.data.documents.length).toBe(1);
            // Should have the most recent shared date
            expect(new Date(res.body.data.documents[0].sharedAt).getTime())
                .toBeGreaterThanOrEqual(new Date('2026-01-15').getTime());
        });
    });
});
