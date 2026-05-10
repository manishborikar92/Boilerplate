/**
 * Script to send a single email template
 * Run: node scripts/sendSingleTemplate.js <templateKey>
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const {
  TemplateRegistry,
  SampleContentGenerator
} = require('../src/templates/email/templateCollection');

// Configuration
const RECIPIENT_EMAIL = 'theodinproject0622@gmail.com';

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send a single template email
 */
async function sendTemplate(templateKey, templateNumber, templateName) {
  try {
    console.log(`\n🚀 Sending Template ${templateNumber}: ${templateName}`);
    console.log('='.repeat(50));
    
    // Get template from registry
    const template = TemplateRegistry.getTemplate(templateKey);
    
    if (!template) {
      throw new Error(`Template "${templateKey}" not found in registry`);
    }
    
    console.log('✓ Template loaded successfully');
    
    // Generate HTML using the template
    const html = template.render({
      title: 'Sample Email Template for Review',
      content: SampleContentGenerator.createSampleContent('Manish'),
      actionUrl: 'https://ca-flow.com/app/dashboard',
      actionLabel: 'View Dashboard'
    });

    console.log('✓ HTML generated successfully');
    console.log(`✓ HTML length: ${html.length} characters`);

    // Send email
    const info = await transporter.sendMail({
      from: `"CA-Flow Templates" <${process.env.EMAIL_USER}>`,
      to: RECIPIENT_EMAIL,
      subject: `Template ${templateNumber}: ${templateName} - CA-Flow Email Sample`,
      html: html,
      text: `Template ${templateNumber}: ${templateName}\n\nThis is a fully responsive email template for CA-Flow. Please review on both desktop and mobile devices.`
    });

    console.log('✓ Email sent successfully!');
    console.log(`✓ Message ID: ${info.messageId}`);
    console.log(`✓ Response: ${info.response}`);
    console.log(`\n📧 Check your inbox: ${RECIPIENT_EMAIL}\n`);
    
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to send template:`, error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Get template key from command line argument
const templateKey = process.argv[2] || 'modernGradient';

const templates = {
  classicProfessional: { number: 1, name: 'Classic Professional' },
  modernGradient: { number: 2, name: 'Modern Gradient' },
  minimalClean: { number: 3, name: 'Minimal Clean' },
  borderedCard: { number: 4, name: 'Bordered Card' },
  sideAccent: { number: 5, name: 'Side Accent' },
  darkHeader: { number: 6, name: 'Dark Header' },
  softRounded: { number: 7, name: 'Soft Rounded' },
  twoTone: { number: 8, name: 'Two-Tone' },
  elegantSerif: { number: 9, name: 'Elegant Serif' },
  techModern: { number: 10, name: 'Tech Modern' }
};

const templateInfo = templates[templateKey];

if (!templateInfo) {
  console.error(`❌ Unknown template: ${templateKey}`);
  console.log('\nAvailable templates:');
  Object.keys(templates).forEach(key => {
    console.log(`  - ${key}`);
  });
  process.exit(1);
}

sendTemplate(templateKey, templateInfo.number, templateInfo.name)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
