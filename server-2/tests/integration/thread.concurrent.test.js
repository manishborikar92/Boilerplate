const request = require('supertest');
const app = require('../../src/app');
const Thread = require('../../src/models/Thread');
const { createTestCAAdmin, createTestClient, cleanupTestData } = require('../helpers/testSetup');

describe('Thread Concurrent Creation Tests', () => {
  let caAdminToken, firmId, clientId;

  beforeEach(async () => {
    await cleanupTestData();
    await Thread.deleteMany({});

    // Create CA-Admin user and firm
    const { firm, caAdminToken: token } = await createTestCAAdmin();
    caAdminToken = token;
    firmId = firm._id;

    // Create client
    const { client } = await createTestClient(firmId);
    clientId = client._id;
  });

  it('should handle concurrent thread creation without duplicate threadNumber errors', async () => {
    // Create multiple threads concurrently
    const threadPromises = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .post('/api/threads')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          subject: `Test Thread ${i + 1}`,
          serviceType: 'General',
          clientId: clientId.toString(),
          message: `Initial message for thread ${i + 1}`
        })
    );

    // Wait for all requests to complete
    const responses = await Promise.all(threadPromises);

    // All should succeed
    responses.forEach((response, i) => {
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.thread).toBeDefined();
      expect(response.body.data.thread.threadNumber).toMatch(/^THR-\d{4}-\d{5}$/);
    });

    // All thread numbers should be unique
    const threadNumbers = responses.map(r => r.body.data.thread.threadNumber);
    const uniqueThreadNumbers = new Set(threadNumbers);
    expect(uniqueThreadNumbers.size).toBe(threadNumbers.length);
  });

  it('should generate sequential thread numbers', async () => {
    const threads = [];

    // Create threads sequentially
    for (let i = 0; i < 3; i++) {
      const response = await request(app)
        .post('/api/threads')
        .set('Authorization', `Bearer ${caAdminToken}`)
        .send({
          subject: `Sequential Thread ${i + 1}`,
          serviceType: 'General',
          clientId: clientId.toString(),
          message: `Message ${i + 1}`
        });

      expect(response.status).toBe(201);
      threads.push(response.body.data.thread);
    }

    // Extract numbers from thread numbers
    const numbers = threads.map(t => {
      const match = t.threadNumber.match(/THR-\d{4}-(\d{5})/);
      return parseInt(match[1], 10);
    });

    // Should be sequential
    expect(numbers[1]).toBe(numbers[0] + 1);
    expect(numbers[2]).toBe(numbers[1] + 1);
  });
});
