/**
 * Chat Message Payment Service Unit Tests
 */

const mongoose = require('mongoose');
const chatMessagePaymentService = require('../../src/services/chatMessagePaymentService');
const razorpayService = require('../../src/services/razorpayService');
const Payment = require('../../src/models/Payment');
const Client = require('../../src/models/Client');
const Thread = require('../../src/models/Thread');
const Message = require('../../src/models/Message');
const User = require('../../src/models/User');
const Firm = require('../../src/models/Firm');
const { ValidationError, NotFoundError, AuthorizationError } = require('../../src/utils/errorHandler');

// Mock Razorpay Service
jest.mock('../../src/services/razorpayService');

// Mock Plans
jest.mock('../../src/constants/plans', () => ({
    PLAN_CONFIG: {
        'plan_ca_flow_free': { monthlyRecords: 2, maxClients: 5, notifications: ['email'] },
        'plan_ca_flow_pro': { monthlyRecords: 10, maxClients: 100, notifications: ['email', 'whatsapp'] }
    }
}));

describe('Chat Message Payment Service', () => {
    let clientUser, adminUser, firm, client, thread, message, payment;

    beforeEach(async () => {
        // Clear collections
        await User.deleteMany({});
        await Firm.deleteMany({});
        await Client.deleteMany({});
        await Thread.deleteMany({});
        await Message.deleteMany({});
        await Payment.deleteMany({});

        // Create Admin User
        adminUser = await User.create({
            email: 'admin@firm.com',
            password: 'password123',
            name: 'Firm Admin',
            role: 'CA-Admin',
            isActive: true,
            isEmailVerified: true
        });

        // Create Firm
        firm = await Firm.create({
            firmName: 'Test Firm',
            registrationNumber: 'REG123',
            pan: 'ABCDE1234F',
            officialEmail: 'firm@test.com',
            contactNumber: '9876543210',
            bankDetails: {
                bankName: 'Test Bank',
                accountHolderName: 'Test Firm',
                accountNumber: '1234567890',
                ifscCode: 'HDFC0001234',
                accountType: 'Current'
            },
            adminId: adminUser._id
        });
        adminUser.firmId = firm._id;
        await adminUser.save();

        // Create Client User and Client Profile with circular reference
        clientUser = new User({
            _id: new mongoose.Types.ObjectId(),
            email: 'client@test.com',
            password: 'password123',
            name: 'Test Client',
            role: 'Client',
            isActive: true,
            isEmailVerified: true
        });

        client = new Client({
            _id: new mongoose.Types.ObjectId(),
            userId: 'CL-001',
            companyName: 'Client Co',
            email: 'client@test.com',
            phoneNumber: '1234567890',
            companyType: 'Proprietorship',
            firmId: firm._id,
            userAccountId: clientUser._id,
            createdBy: adminUser._id
        });

        clientUser.clientProfileId = client._id;
        clientUser.firmId = firm._id;

        await clientUser.save();
        await client.save();

        // Create Thread
        thread = await Thread.create({
            threadNumber: 'THR-2024-00001',
            subject: 'Test Subject',
            serviceType: 'General',
            clientId: client._id,
            firmId: firm._id,
            initiatedBy: 'Client',
            initiatedByUser: clientUser._id,
            status: 'open'
        });

        // Create Payment
        payment = await Payment.create({
            amount: 1000,
            currency: 'INR',
            status: 'created',
            paymentType: 'chat-message',
            description: 'Test Payment',
            clientId: client._id,
            firmId: firm._id,
            createdBy: adminUser._id
        });

        // Create Message
        message = await Message.create({
            threadId: thread._id,
            content: 'Please pay',
            sender: adminUser._id,
            senderRole: 'CA-Admin',
            paymentRequired: true,
            paymentAmount: 1000,
            paymentId: payment._id,
            inlineFiles: [{
                fileName: 'invoice.pdf',
                cloudinaryUrl: 'http://url',
                cloudinaryPublicId: 'id',
                originalName: 'invoice.pdf'
            }]
        });

        // Link message to payment
        payment.messageId = message._id;
        await payment.save();

        // Mock Razorpay Response
        razorpayService.createOrder.mockResolvedValue({
            id: 'order_123456',
            amount: 100000, // in paise
            currency: 'INR'
        });

        process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createChatMessagePaymentRequirement', () => {
        it('should create payment requirement successfully', async () => {
            const result = await chatMessagePaymentService.createChatMessagePaymentRequirement({
                firmId: firm._id,
                clientId: client._id,
                threadId: thread._id,
                amount: 5000,
                description: 'Test Service',
                createdBy: adminUser._id,
                documentIds: []
            });

            expect(result).toBeDefined();
            expect(result.amount).toBe(5000);
            expect(result.status).toBe('created');
            expect(result.firmId.toString()).toBe(firm._id.toString());
            expect(result.clientId.toString()).toBe(client._id.toString());
        });

        it('should enforce subscription limits', async () => {
            // Mock limits to be low in the jest.mock above (2 records)
            // Create 2 existing payments
            await Payment.create([
                {
                    amount: 100,
                    currency: 'INR',
                    status: 'paid',
                    paymentType: 'chat-message',
                    description: 'Test payment 1',
                    clientId: client._id,
                    firmId: firm._id,
                    createdBy: adminUser._id
                },
                {
                    amount: 200,
                    currency: 'INR',
                    status: 'paid',
                    paymentType: 'invoice',
                    description: 'Test payment 2',
                    clientId: client._id,
                    firmId: firm._id,
                    createdBy: adminUser._id
                }
            ]);

            // Try to create 3rd payment -> should fail
            await expect(chatMessagePaymentService.createChatMessagePaymentRequirement({
                firmId: firm._id,
                clientId: client._id,
                threadId: thread._id,
                amount: 5000,
                description: 'Test Service',
                createdBy: adminUser._id
            })).rejects.toThrow(AuthorizationError);
        });

        it('should throw ValidationError if missing required fields', async () => {
            await expect(chatMessagePaymentService.createChatMessagePaymentRequirement({
                firmId: null,
                clientId: client._id,
                threadId: thread._id,
                amount: 5000,
                createdBy: adminUser._id
            })).rejects.toThrow(ValidationError);
        });
    });

    describe('initiatePaymentOrder', () => {
        it('should create a new razorpay order for valid request', async () => {
            const result = await chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            });

            expect(result.payment._id.toString()).toBe(payment._id.toString());
            expect(result.razorpayOrder.id).toBe('order_123456');
            expect(razorpayService.createOrder).toHaveBeenCalledTimes(1);

            // Check if payment record updated
            const updatedPayment = await Payment.findById(payment._id);
            expect(updatedPayment.razorpayOrderId).toBe('order_123456');
            expect(updatedPayment.status).toBe('pending');
        });

        it('should return existing razorpay order if already created and pending', async () => {
            // Setup existing order
            payment.razorpayOrderId = 'order_existing_789';
            payment.status = 'pending';
            await payment.save();

            const result = await chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            });

            expect(result.razorpayOrder.id).toBe('order_existing_789');
            expect(razorpayService.createOrder).not.toHaveBeenCalled();
        });

        it('should throw ValidationError if threadId or messageId missing', async () => {
            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: null,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw AuthorizationError if user is not Client', async () => {
            const nonClientUser = { ...clientUser.toObject(), role: 'CA-Admin' };
            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: nonClientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(AuthorizationError);
        });

        it('should throw NotFoundError if thread not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: fakeId,
                messageId: message._id
            })).rejects.toThrow(NotFoundError);
        });

        it('should throw AuthorizationError if client does not have access to thread', async () => {
            // Create another client
            const otherClientUser = new User({
                _id: new mongoose.Types.ObjectId(),
                email: 'other@test.com',
                password: 'password',
                role: 'Client',
                name: 'Other',
                isActive: true
            });

            const otherClient = new Client({
                _id: new mongoose.Types.ObjectId(),
                userId: 'CL-002',
                companyName: 'Other Co',
                email: 'other@test.com',
                phoneNumber: '9876543211',
                companyType: 'Proprietorship',
                firmId: firm._id,
                userAccountId: otherClientUser._id,
                createdBy: adminUser._id
            });

            otherClientUser.clientProfileId = otherClient._id;
            otherClientUser.firmId = firm._id; // Important if validated

            await otherClientUser.save();
            await otherClient.save();

            // Update thread to belong to other client
            thread.clientId = otherClient._id;
            await thread.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(AuthorizationError);
        });

        it('should throw NotFoundError if message not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: fakeId
            })).rejects.toThrow(NotFoundError);
        });

        it('should throw ValidationError if message not sent by CA-Admin', async () => {
            message.senderRole = 'Client';
            await message.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if message not payment required', async () => {
            message.paymentRequired = false;
            await message.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if no attachments', async () => {
            message.attachments = [];
            message.inlineFiles = [];
            await message.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if Invalid Payment Amount', async () => {
            message.paymentAmount = 0;
            await message.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if Payment record not found', async () => {
            message.paymentId = null; // Unlink payment ID
            await message.save();
            await Payment.deleteMany({}); // Ensure no fallback lookup works

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should throw ValidationError if Payment is already completed', async () => {
            payment.status = 'paid'; // 'paid' is invalid according to service? Service checks !['created', 'pending']
            // Wait, service says: if (!['created', 'pending'].includes(payment.status))
            // So 'paid' should throw.
            await payment.save();

            await expect(chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            })).rejects.toThrow(ValidationError);
        });

        it('should support legacy fallback lookup by messageId if paymentId missing on message', async () => {
            message.paymentId = null;
            await message.save(); // Unlink

            // Payment still has referencing messageId

            const result = await chatMessagePaymentService.initiatePaymentOrder({
                user: clientUser,
                threadId: thread._id,
                messageId: message._id
            });

            expect(result.payment._id.toString()).toBe(payment._id.toString());
        });
    });

    describe('markChatMessagePaymentPaid', () => {
        it('should mark message as payment completed', async () => {
            await chatMessagePaymentService.markChatMessagePaymentPaid(payment);

            const updatedMessage = await Message.findById(message._id);
            expect(updatedMessage.paymentStatus).toBe('paid');
            expect(updatedMessage.paidAt).toBeDefined();
            expect(updatedMessage.paymentId.toString()).toBe(payment._id.toString());
        });

        it('should do nothing if payment has no messageId', async () => {
            const p = { ...payment.toObject(), messageId: null };
            await chatMessagePaymentService.markChatMessagePaymentPaid(p);

            const msg = await Message.findById(message._id);
            expect(msg.paymentStatus).not.toBe('paid');
        });

        it('should do nothing if message not found', async () => {
            const p = { ...payment.toObject(), messageId: new mongoose.Types.ObjectId() };
            await chatMessagePaymentService.markChatMessagePaymentPaid(p);
            // Should not throw
        });
    });
});
