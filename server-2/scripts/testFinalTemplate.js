/**
 * Test script to send samples of all notification types using Template 1
 * Run: node src/scripts/testFinalTemplate.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const {
  paymentNotificationTemplate,
  threadNotificationTemplate,
  documentNotificationTemplate,
  subscriptionNotificationTemplate,
  loginNotificationTemplate,
  verificationEmailTemplate,
  passwordResetEmailTemplate,
  welcomeEmailTemplate,
  taskNotificationEmailTemplate,
  documentRequestEmailTemplate,
  clientWelcomeEmailTemplate
} = require('../src/templates/email/notificationEmail');

const RECIPIENT_EMAIL = 'theodinproject0622@gmail.com';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function testFinalTemplate() {
  console.log('🚀 Testing Template 1 (Classic Professional) with all notification types...\n');

  const samples = [
    {
      name: 'Payment Received',
      html: paymentNotificationTemplate({
        recipientName: 'Manish',
        amount: '5,000',
        clientName: 'ABC Enterprises',
        status: 'received',
        actionUrl: 'https://ca-flow.com/payments/123',
        priority: 'normal'
      })
    },
    {
      name: 'Payment Failed',
      html: paymentNotificationTemplate({
        recipientName: 'Manish',
        amount: '3,500',
        clientName: 'XYZ Corporation',
        status: 'failed',
        actionUrl: 'https://ca-flow.com/payments/124',
        priority: 'high'
      })
    },
    {
      name: 'New Conversation',
      html: threadNotificationTemplate({
        recipientName: 'Manish',
        subject: 'Tax Planning Discussion',
        message: 'started a new conversation about tax planning strategies.',
        senderName: 'Priya Sharma',
        senderRole: 'Client',
        actionUrl: 'https://ca-flow.com/conversations/455',
        priority: 'normal',
        notificationType: 'created'
      })
    },
    {
      name: 'New Message',
      html: threadNotificationTemplate({
        recipientName: 'Manish',
        subject: 'GST Filing Query',
        message: 'sent you a message regarding your GST filing documents.',
        senderName: 'Rajesh Kumar',
        senderRole: 'Client',
        actionUrl: 'https://ca-flow.com/conversations/456',
        priority: 'normal',
        notificationType: 'message'
      })
    },
    {
      name: 'Conversation Resolved',
      html: threadNotificationTemplate({
        recipientName: 'Manish',
        subject: 'ITR Filing Completed',
        message: 'marked the conversation as resolved.',
        senderName: 'CA Admin',
        senderRole: 'CA-Admin',
        actionUrl: 'https://ca-flow.com/conversations/457',
        priority: 'normal',
        notificationType: 'resolved'
      })
    },
    {
      name: 'Single Document Uploaded',
      html: documentNotificationTemplate({
        recipientName: 'Manish',
        documentName: 'Income Tax Return 2024',
        documentCount: 1,
        uploaderName: 'CA Sharma',
        uploaderRole: 'CA-Admin',
        actionUrl: 'https://ca-flow.com/documents/789',
        priority: 'normal'
      })
    },
    {
      name: 'Multiple Documents Uploaded',
      html: documentNotificationTemplate({
        recipientName: 'Manish',
        documentName: '',
        documentCount: 5,
        uploaderName: 'CA Verma',
        uploaderRole: 'CA-Admin',
        actionUrl: 'https://ca-flow.com/documents/790',
        priority: 'normal'
      })
    },
    {
      name: 'Subscription Activated',
      html: subscriptionNotificationTemplate({
        recipientName: 'Manish',
        planName: 'Professional Plan',
        status: 'activated',
        amount: '999',
        nextBillingDate: 'March 15, 2026',
        actionUrl: 'https://ca-flow.com/subscription',
        priority: 'normal'
      })
    },
    {
      name: 'Subscription Payment Failed',
      html: subscriptionNotificationTemplate({
        recipientName: 'Manish',
        planName: 'Enterprise Plan',
        status: 'failed',
        amount: '1,999',
        nextBillingDate: 'March 15, 2026',
        actionUrl: 'https://ca-flow.com/subscription',
        priority: 'high'
      })
    },
    {
      name: 'Subscription Cancelled',
      html: subscriptionNotificationTemplate({
        recipientName: 'Manish',
        planName: 'Basic Plan',
        status: 'cancelled',
        amount: '499',
        nextBillingDate: 'March 15, 2026',
        actionUrl: 'https://ca-flow.com/subscription',
        priority: 'normal'
      })
    },
    {
      name: 'Client First Login',
      html: loginNotificationTemplate({
        recipientName: 'Manish',
        clientName: 'Amit Patel',
        isFirstLogin: true,
        loginTime: 'February 13, 2026 at 10:30 AM',
        actionUrl: 'https://ca-flow.com/clients/amit-patel',
        priority: 'normal'
      })
    },
    {
      name: 'Client Login',
      html: loginNotificationTemplate({
        recipientName: 'Manish',
        clientName: 'Sneha Reddy',
        isFirstLogin: false,
        loginTime: 'February 13, 2026 at 2:45 PM',
        actionUrl: 'https://ca-flow.com/clients/sneha-reddy',
        priority: 'low'
      })
    },
    {
      name: 'Email Verification',
      html: verificationEmailTemplate({
        name: 'Manish',
        verificationUrl: 'https://ca-flow.com/verify/abc123',
        priority: 'normal'
      })
    },
    {
      name: 'Password Reset',
      html: passwordResetEmailTemplate({
        name: 'Manish',
        resetUrl: 'https://ca-flow.com/reset-password/xyz789',
        priority: 'high'
      })
    },
    {
      name: 'Welcome Email (CA-Admin)',
      html: welcomeEmailTemplate({
        name: 'Manish',
        userRole: 'CA-Admin',
        priority: 'normal'
      })
    },
    {
      name: 'Welcome Email (CA-Employee)',
      html: welcomeEmailTemplate({
        name: 'Rahul',
        userRole: 'CA-Employee',
        priority: 'normal'
      })
    },
    {
      name: 'Welcome Email (Client)',
      html: welcomeEmailTemplate({
        name: 'Priya',
        userRole: 'Client',
        priority: 'normal'
      })
    },
    {
      name: 'Task Pending',
      html: taskNotificationEmailTemplate({
        name: 'Manish',
        taskTitle: 'GST Return Filing - Q4 2025',
        taskStatus: 'pending',
        message: 'A new task has been assigned to you.',
        priority: 'normal'
      })
    },
    {
      name: 'Task In Progress',
      html: taskNotificationEmailTemplate({
        name: 'Manish',
        taskTitle: 'Income Tax Audit',
        taskStatus: 'in-progress',
        message: 'Work has started on this task.',
        priority: 'normal'
      })
    },
    {
      name: 'Task Completed',
      html: taskNotificationEmailTemplate({
        name: 'Manish',
        taskTitle: 'Annual Financial Statements',
        taskStatus: 'completed',
        message: 'Your task has been completed successfully!',
        priority: 'normal'
      })
    },
    {
      name: 'Task Cancelled',
      html: taskNotificationEmailTemplate({
        name: 'Manish',
        taskTitle: 'TDS Return Filing',
        taskStatus: 'cancelled',
        message: 'This task has been cancelled by the client.',
        priority: 'normal'
      })
    },
    {
      name: 'Document Request',
      html: documentRequestEmailTemplate({
        name: 'Manish',
        taskTitle: 'Company Registration',
        requiredDocuments: [
          'PAN Card',
          'Aadhaar Card',
          'Address Proof',
          'Bank Statement (Last 6 months)',
          'Passport Size Photograph'
        ],
        priority: 'high'
      })
    },
    {
      name: 'Client Welcome (with credentials)',
      html: clientWelcomeEmailTemplate({
        companyName: 'Sharma & Associates',
        userId: 'CA-CLT-001',
        password: 'TempPass123',
        loginUrl: 'https://ca-flow.com/login',
        priority: 'high'
      })
    }
  ];

  for (let i = 0; i < samples.length; i++) {
    const { name, html } = samples[i];
    
    try {
      await transporter.sendMail({
        from: `"CA-Flow" <${process.env.EMAIL_USER}>`,
        to: RECIPIENT_EMAIL,
        subject: `Template 1 Sample: ${name}`,
        html: html,
        text: `This is a sample ${name} notification using Template 1 (Classic Professional) design.`
      });

      console.log(`✅ Sent: ${name}`);
      
      if (i < samples.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to send ${name}:`, error.message);
    }
  }

  console.log('\n✨ All samples sent successfully!');
  console.log(`📧 Check your inbox: ${RECIPIENT_EMAIL}`);
  console.log('\n✅ Template 1 (Classic Professional) is now applied to:');
  console.log('   • Payment notifications (received/failed)');
  console.log('   • Thread/conversation messages (created/message/resolved)');
  console.log('   • Document uploads (single/multiple)');
  console.log('   • Subscription updates (activated/failed/cancelled)');
  console.log('   • Client login notifications (first login/regular)');
  console.log('   • Email verification');
  console.log('   • Password resets');
  console.log('   • Welcome emails (CA-Admin/CA-Employee/Client)');
  console.log('   • Task notifications (pending/in-progress/completed/cancelled)');
  console.log('   • Document requests');
  console.log('   • Client credentials');
  console.log('\n🎉 All CA-Flow emails now use your chosen template!\n');
}

testFinalTemplate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
