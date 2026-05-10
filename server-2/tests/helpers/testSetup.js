/**
 * Test Setup Helpers
 * Provides reusable setup functions for integration tests
 */

const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Firm = require('../../src/models/Firm');
const Document = require('../../src/models/Document');
const Folder = require('../../src/models/Folder');
const Payment = require('../../src/models/Payment');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
const Subscription = require('../../src/models/Subscription');
const { generateAccessToken } = require('../../src/utils/jwt');
const mongoose = require('mongoose');

let uniqueCounter = 0;

/**
 * Create a test CA Admin user with firm
 */
async function createTestCAAdmin(overrides = {}) {
  uniqueCounter += 1;
  const unique = Date.now() + uniqueCounter;

  const caAdminUser = await User.create({
    email: overrides.email || `admin-${unique}@test.com`,
    password: 'password123',
    name: 'CA Admin',
    role: 'CA-Admin',
    isActive: true,
    isEmailVerified: true,
    ...overrides
  });

  const firm = await Firm.create({
    firmName: 'Test CA Firm',
    registrationNumber: `REG-${unique}`,
    pan: `ABCDE${String(unique % 10000).padStart(4, '0')}F`,
    officialEmail: `firm-${unique}@test.com`,
    contactNumber: '+91-9876543210',
    bankDetails: {
      bankName: 'Test Bank',
      accountHolderName: 'Test CA Firm',
      accountNumber: String(100000000 + (unique % 900000000)),
      ifscCode: `ABCD0${String(unique % 1000000).padStart(6, '0')}`,
      accountType: 'Current'
    },
    adminId: caAdminUser._id
  });

  caAdminUser.firmId = firm._id;
  await caAdminUser.save();

  const token = generateAccessToken(caAdminUser._id, caAdminUser.role);

  return { caAdminUser, firm, caAdminToken: token };
}

/**
 * Create a test client user
 */
async function createTestClient(firmId, overrides = {}) {
  const timestamp = Date.now();
  const firm = await Firm.findById(firmId);
  const createdBy = overrides.createdBy || firm?.adminId || new mongoose.Types.ObjectId();

  const client = await Client.create({
    companyName: overrides.companyName || 'Test Client',
    email: overrides.email || `client-${timestamp}@test.com`,
    phoneNumber: '+91-9876543210',
    companyType: 'Pvt. Ltd.',
    userId: `CA-CLT-${timestamp}`,
    generatedPassword: 'password123',
    firmId,
    createdBy,
    ...overrides
  });

  const clientUser = await User.create({
    email: client.email,
    password: 'password123',
    name: client.companyName,
    role: 'Client',
    isActive: true,
    firmId
  });

  client.userAccountId = clientUser._id;
  client.accountCreated = true;
  await client.save();

  const token = generateAccessToken(clientUser._id, clientUser.role);

  return { client, clientUser, clientToken: token };
}

/**
 * Create a test document
 */
async function createTestDocument(clientId, firmId, uploadedBy, overrides = {}) {
  const timestamp = Date.now();
  const { folderId: overrideFolderId, ...documentOverrides } = overrides;

  let folderId = overrideFolderId;
  if (!folderId) {
    const folder = await Folder.create({
      name: `Test Folder ${timestamp}`,
      category: null,
      description: null,
      color: '#3B82F6',
      clientId,
      firmId,
      createdBy: uploadedBy
    });
    folderId = folder._id;
  }

  return await Document.create({
    fileName: documentOverrides.fileName || 'test.pdf',
    originalName: documentOverrides.originalName || 'test.pdf',
    cloudinaryUrl: documentOverrides.cloudinaryUrl || 'https://cloudinary.com/test.pdf',
    cloudinaryPublicId: documentOverrides.cloudinaryPublicId || `test-${timestamp}`,
    cloudinaryFolder: documentOverrides.cloudinaryFolder || 'CA-Flow/documents/test',
    category: documentOverrides.category || 'GST_Filings',
    fileSize: documentOverrides.fileSize || 1024,
    mimeType: documentOverrides.mimeType || 'application/pdf',
    fileExtension: documentOverrides.fileExtension || '.pdf',
    clientId,
    firmId,
    uploadedBy,
    ...documentOverrides,
    folderId
  });
}

/**
 * Create a test thread
 */
async function createTestThread(clientId, firmId, createdBy, overrides = {}) {
  const timestamp = Date.now();
  return await Thread.create({
    threadNumber: overrides.threadNumber || `THR-2026-${String(timestamp % 100000).padStart(5, '0')}`,
    subject: overrides.subject || 'Test Thread',
    serviceType: overrides.serviceType || 'General',
    clientId,
    firmId,
    initiatedBy: overrides.initiatedBy || 'CA-Admin',
    initiatedByUser: createdBy,
    status: overrides.status || 'open',
    priority: overrides.priority || 'normal',
    ...overrides
  });
}

/**
 * Create a test message with optional document attachments
 */
async function createTestMessage(threadId, senderId, senderRole, overrides = {}) {
  return await Message.create({
    threadId,
    sender: senderId,
    senderRole,
    content: overrides.content || 'Test message content',
    messageType: overrides.messageType || 'text',
    attachments: overrides.attachments || [],
    paymentRequired: overrides.paymentRequired || false,
    paymentAmount: overrides.paymentAmount || 0,
    paymentDescription: overrides.paymentDescription || '',
    paymentStatus: overrides.paymentStatus || 'not-required',
    ...overrides
  });
}

/**
 * Create a test subscription plan
 */
async function createTestSubscription(overrides = {}) {
  const timestamp = Date.now();
  return await Subscription.create({
    planName: overrides.planName || 'Test Plan',
    planDescription: overrides.planDescription || 'Test plan description',
    razorpayPlanId: overrides.razorpayPlanId || `plan_test_${timestamp}`,
    amount: overrides.amount || 34900,
    billingPeriod: overrides.billingPeriod || 'monthly',
    features: overrides.features || ['Feature 1', 'Feature 2'],
    maxClients: overrides.maxClients || -1,
    maxStorage: overrides.maxStorage || 10,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  });
}

/**
 * Create a test payment
 */
async function createTestPayment(clientId, firmId, overrides = {}) {
  return await Payment.create({
    paymentType: overrides.paymentType || 'invoice',
    clientId,
    firmId,
    amount: overrides.amount || 10000,
    description: overrides.description || 'Test payment',
    status: overrides.status || 'created',
    ...overrides
  });
}

/**
 * Clean up all test data
 */
async function cleanupTestData() {
  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    Firm.deleteMany({}),
    Document.deleteMany({}),
    Folder.deleteMany({}),
    Payment.deleteMany({}),
    Thread.deleteMany({}),
    Message.deleteMany({}),
    Subscription.deleteMany({})
  ]);
}

module.exports = {
  createTestCAAdmin,
  createTestClient,
  createTestDocument,
  createTestThread,
  createTestMessage,
  createTestSubscription,
  createTestPayment,
  cleanupTestData
};
