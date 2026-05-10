/**
 * Script to send 10 responsive email template samples
 * Run: node src/scripts/sendAllTemplates.js
 * 
 * @version 2.0.0 - Modernized to work with new template system
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const {
  TemplateRegistry,
  SampleContentGenerator
} = require('../src/templates/email/templateCollection');

// Configuration
const RECIPIENT_EMAIL = 'theodinproject0622@gmail.com';
const DELAY_BETWEEN_EMAILS = 2000; // 2 seconds

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
 * Template metadata for sending
 */
const templateMetadata = [
  {
    key: 'classicProfessional',
    number: 1,
    name: 'Classic Professional',
    description: 'Traditional corporate design with navy blue accents - perfect for established CA firms',
    category: 'Professional corporate'
  },
  {
    key: 'modernGradient',
    number: 2,
    name: 'Modern Gradient',
    description: 'Contemporary design with blue gradient header - modern and professional',
    category: 'Professional corporate'
  },
  {
    key: 'minimalClean',
    number: 3,
    name: 'Minimal Clean',
    description: 'Ultra-clean design with maximum white space - Apple-inspired minimalism',
    category: 'Modern minimal'
  },
  {
    key: 'borderedCard',
    number: 4,
    name: 'Bordered Card',
    description: 'Card-style design with subtle borders and icon - friendly and approachable',
    category: 'Modern minimal'
  },
  {
    key: 'sideAccent',
    number: 5,
    name: 'Side Accent',
    description: 'Design with colorful left border accent - distinctive and modern',
    category: 'Modern minimal'
  },
  {
    key: 'darkHeader',
    number: 6,
    name: 'Dark Header',
    description: 'Bold design with dark header section - strong visual impact',
    category: 'Bold & distinctive'
  },
  {
    key: 'softRounded',
    number: 7,
    name: 'Soft Rounded',
    description: 'Friendly design with rounded corners - warm and welcoming',
    category: 'Bold & distinctive'
  },
  {
    key: 'twoTone',
    number: 8,
    name: 'Two-Tone',
    description: 'Split design with contrasting sections - clear visual hierarchy',
    category: 'Bold & distinctive'
  },
  {
    key: 'elegantSerif',
    number: 9,
    name: 'Elegant Serif',
    description: 'Sophisticated design with serif typography - classic and trustworthy',
    category: 'Elegant & sophisticated'
  },
  {
    key: 'techModern',
    number: 10,
    name: 'Tech Modern',
    description: 'Contemporary tech-inspired dark theme - cutting-edge and innovative',
    category: 'Elegant & sophisticated'
  }
];

/**
 * Verify email configuration
 * @returns {boolean} True if config is valid
 */
function verifyEmailConfig() {
  const required = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\n💡 Create a .env file with these variables');
    return false;
  }
  
  return true;
}

/**
 * Send a single template email
 * @param {Object} metadata - Template metadata
 * @returns {Promise<boolean>} Success status
 */
async function sendTemplateEmail(metadata) {
  const { key, number, name, description } = metadata;
  
  try {
    // Get template from registry
    const template = TemplateRegistry.getTemplate(key);
    
    if (!template) {
      throw new Error(`Template "${key}" not found in registry`);
    }
    
    // Generate HTML using the template
    const html = template.render({
      title: 'Sample Email Template for Review',
      content: SampleContentGenerator.createSampleContent('Manish'),
      actionUrl: 'https://ca-flow.com/app/dashboard',
      actionLabel: 'View Dashboard'
    });

    // Send email
    await transporter.sendMail({
      from: `"CA-Flow Templates" <${process.env.EMAIL_USER}>`,
      to: RECIPIENT_EMAIL,
      subject: `Template ${number}: ${name} - CA-Flow Email Sample`,
      html: html,
      text: `Template ${number}: ${name}\n\n${description}\n\nThis is a fully responsive email template for CA-Flow. Please review on both desktop and mobile devices.`
    });

    console.log(`✅ Template ${number}: ${name}`);
    console.log(`   ${description}\n`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to send Template ${number}:`, error.message);
    return false;
  }
}

/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function to send all template emails
 */
async function sendAllTemplates() {
  console.log('🚀 CA-Flow Email Template Sender v2.0');
  console.log('=====================================\n');
  
  // Verify configuration
  if (!verifyEmailConfig()) {
    process.exit(1);
  }
  
  console.log('📧 Recipient:', RECIPIENT_EMAIL);
  console.log('📤 Sending 10 responsive email templates...\n');

  let successCount = 0;
  let failCount = 0;

  // Send each template
  for (let i = 0; i < templateMetadata.length; i++) {
    const metadata = templateMetadata[i];
    const success = await sendTemplateEmail(metadata);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Wait between emails (except after the last one)
    if (i < templateMetadata.length - 1) {
      await delay(DELAY_BETWEEN_EMAILS);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Sent successfully: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
  }
  console.log(`📧 Check your inbox: ${RECIPIENT_EMAIL}`);
  
  // Instructions
  console.log('\n📱 IMPORTANT: Test on multiple devices!');
  console.log('   • Desktop email client (Outlook, Apple Mail)');
  console.log('   • Mobile phone (iOS Mail, Gmail app)');
  console.log('   • Webmail (Gmail.com, Outlook.com)');
  
  console.log('\n🎨 Template Categories:');
  console.log('   Templates 1-2: Professional corporate');
  console.log('   Templates 3-5: Modern minimal');
  console.log('   Templates 6-8: Bold & distinctive');
  console.log('   Templates 9-10: Elegant & sophisticated');
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Review all 10 templates on different devices');
  console.log('   2. Pick your favorite (just tell me the number 1-10)');
  console.log('   3. We\'ll apply it to all CA-Flow emails');
  
  console.log('\n✨ Done!\n');
}

/**
 * Send a test email to verify configuration
 */
async function sendTestEmail() {
  console.log('🧪 Sending test email...\n');
  
  if (!verifyEmailConfig()) {
    process.exit(1);
  }
  
  const testMetadata = templateMetadata[0]; // Use Classic Professional for test
  const success = await sendTemplateEmail(testMetadata);
  
  if (success) {
    console.log('\n✅ Test email sent successfully!');
    console.log(`📧 Check: ${RECIPIENT_EMAIL}\n`);
  } else {
    console.log('\n❌ Test email failed. Please check your configuration.\n');
    process.exit(1);
  }
}

/**
 * List all available templates
 */
function listTemplates() {
  console.log('📋 Available Templates');
  console.log('='.repeat(50) + '\n');
  
  templateMetadata.forEach(({ number, name, description, category }) => {
    console.log(`Template ${number}: ${name}`);
    console.log(`  Category: ${category}`);
    console.log(`  ${description}\n`);
  });
}

// CLI Interface
const command = process.argv[2];

switch (command) {
  case 'test':
    sendTestEmail()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
    break;
  
  case 'list':
    listTemplates();
    process.exit(0);
    break;
  
  case 'help':
    console.log('CA-Flow Email Template Sender');
    console.log('==============================\n');
    console.log('Usage:');
    console.log('  node sendAllTemplates.js           # Send all 10 templates');
    console.log('  node sendAllTemplates.js test      # Send test email');
    console.log('  node sendAllTemplates.js list      # List all templates');
    console.log('  node sendAllTemplates.js help      # Show this help\n');
    console.log('Environment Variables (.env file):');
    console.log('  EMAIL_HOST          # SMTP host (e.g., smtp.gmail.com)');
    console.log('  EMAIL_PORT          # SMTP port (default: 587)');
    console.log('  EMAIL_SECURE        # Use SSL (true/false)');
    console.log('  EMAIL_USER          # Email username');
    console.log('  EMAIL_PASS          # Email password');
    console.log('  RECIPIENT_EMAIL     # Recipient email (optional)\n');
    process.exit(0);
    break;
  
  default:
    // Send all templates by default
    sendAllTemplates()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
}