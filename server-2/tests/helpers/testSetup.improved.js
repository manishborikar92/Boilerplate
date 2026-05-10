/**
 * Improved Test Setup Helpers with Better Isolation
 * Provides reusable setup functions with unique data generation
 */

const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Firm = require('../../src/models/Firm');
const Document = require('../../src/models/Document');
const Payment = require('../../src/models/Payment');
const Subscription = require('../../src/models/Subscription');
const { generateAccessToken } = require('../../src/utils/jwt');

// Counter for unique test data
let testCounter = 0;

/**
 * Generate unique test identifier
 */
function getUniqueId() {
  return `${Date.now()}-${testCounter++}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a test CA Admin user with firm
 * Each call creates unique data to avoid conflicts
 */
async function createTestCAAdmin(overrides = {}) {
  const uniqueId = getUniqueId();
  
  const caAdminUser = await User.create({
    email: overrides.email || `admin-${uniqueId}@test.com`,
    password: overrides.password || 'password123',
    name: overrides.name || 'CA Admin',
    role: 'CA-Admin',
    isActive: true,
    isEmailVerified: true,
    ...overrides
  });

  const firm = await Firm.create({
    firmName: overrides.firmName || `Test CA Firm ${uniqueId}`,
    officialEmail: overrides.officialEmail || `firm-${uniqueId}@test.com`,
    contactNumber: overrides.contactNumber || `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    adminId: caAdminUser._id,
    address: overrides.address || {
      street: 'Test Street',
      city: 'Test City',
      state: 'Test State',
      pinCode: '123456'
    },
    gstin: overrides.gstin || `GSTIN${uniqueId.substring(0, 10)}`,
    pan: overrides.pan || `PAN${uniqueId.substring(0, 7)}`
  });

  caAdminUser.firmId = firm._id;
  await caAdminUser.save();

  const token = generateAccessToken(caAdminUser._id, caAdminUser.role);

  return { caAdminUser, firm, caAdminToken: token };
}

/**
 * Create a test client user with unique data
 */
async function createTestClient(firmId, overrides = {}) {
  const uniqueId = getUniqueId();
  
  // Generate unique userId and password
  const userId = overrides.userId || await Client.generateUserId(firmId);
  const generatedPassword = overrides.generatedPassword || Client.generatePassword();
  
  const client = await Client.create({
    companyName: overrides.companyName || `Test Client ${uniqueId}`,
    email: overrides.email || `client-${uniqueId}@test.com`,
    phoneNumber: overrides.phoneNumber || `+91-${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    companyType: overrides.companyType || 'Pvt. Ltd.',
    userId,
    generatedPassword,
    firmId,
    gstin: overrides.gstin || `GSTIN${uniqueId.substring(0, 10)}`,
    pan: overrides.pan || `PAN${uniqueId.substring(0, 7)}`,
    ...overrides
  });

  const clientUser = await User.create({
    email: client.email,
    password: generatedPassword,
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
 * Create a test document with unique data
 */
async function createTestDocument(clientId, firmId, uploadedBy, overrides = {}) {
  const uniqueId = getUniqueId();
  
  return await Document.create({
    fileName: overrides.fileName || `test-${uniqueId}.pdf`,
    originalName: overrides.originalName || `test-${uniqueId}.pdf`,
    cloudinaryUrl: overrides.cloudinaryUrl || `https://cloudinary.com/test-${uniqueId}.pdf`,
    cloudinaryPublicId: overrides.cloudinaryPublicId || `test-${uniqueId}`,
    cloudinaryFolder: overrides.cloudinaryFolder || `CA-Flow/documents/test-${uniqueId}`,
    category: overrides.category || 'GST_Filings',
    fileSize: overrides.fileSize || 1024,
    mimeType: overrides.mimeType || 'application/pdf',
    fileExtension: overrides.fileExtension || '.pdf',
    clientId,
    firmId,
    uploadedBy,
    ...overrides
  });
}

/**
 * Create a test subscription plan with unique data
 */
async function createTestSubscription(overrides = {}) {
  const uniqueId = getUniqueId();
  
  return await Subscription.create({
    planName: overrides.planName || `Test Plan ${uniqueId}`,
    planDescription: overrides.planDescription || `Test plan description ${uniqueId}`,
    razorpayPlanId: overrides.razorpayPlanId || `plan_test_${uniqueId}`,
    amount: overrides.amount || 34900,
    billingPeriod: overrides.billingPeriod || 'monthly',
    features: overrides.features || ['Feature 1', 'Feature 2'],
    maxClients: overrides.maxClients !== undefined ? overrides.maxClients : -1,
    maxStorage: overrides.maxStorage || 10,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    ...overrides
  });
}

/**
 * Create a test payment with unique data
 */
async function createTestPayment(clientId, firmId, overrides = {}) {
  const uniqueId = getUniqueId();
  
  return await Payment.create({
    paymentType: overrides.paymentType || 'invoice',
    clientId,
    firmId,
    amount: overrides.amount || 10000,
    description: overrides.description || `Test payment ${uniqueId}`,
    status: overrides.status || 'created',
    razorpayOrderId: overrides.razorpayOrderId || `order_${uniqueId}`,
    ...overrides
  });
}

/**
 * Clean up all test data
 * Use this in afterEach or afterAll hooks
 */
async function cleanupTestData() {
  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    Firm.deleteMany({}),
    Document.deleteMany({}),
    Payment.deleteMany({}),
    Subscription.deleteMany({})
  ]);
}

/**
 * Clean up specific collections
 */
async function cleanupCollections(...collections) {
  const modelMap = {
    'users': User,
    'clients': Client,
    'firms': Firm,
    'documents': Document,
    'payments': Payment,
    'subscriptions': Subscription
  };
  
  await Promise.all(
    collections.map(collection => {
      const model = modelMap[collection.toLowerCase()];
      return model ? model.deleteMany({}) : Promise.resolve();
    })
  );
}

module.exports = {
  createTestCAAdmin,
  createTestClient,
  createTestDocument,
  createTestSubscription,
  createTestPayment,
  cleanupTestData,
  cleanupCollections,
  getUniqueId
};
