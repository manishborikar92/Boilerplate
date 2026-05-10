/**
 * Script to reset a user's password in MongoDB
 * Usage: node scripts/reset-user-password.js <email> <newPassword>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function resetPassword(email, newPassword) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email, isDeleted: false }).select('+password');

    if (!user) {
      console.error('❌ User not found with email:', email);
      process.exit(1);
    }

    // Set new password (will be hashed automatically by pre-save middleware)
    user.password = newPassword;
    
    // Save without validation to avoid firmId validation issues
    await user.save({ validateBeforeSave: false });

    console.log('\n✅ Password reset successful!');
    console.log('\n📧 Login Credentials:');
    console.log('   Email:', user.email);
    console.log('   Password:', newPassword);
    console.log('   Name:', user.name);
    console.log('   Role:', user.role);
    console.log('\n⚠️  Please change this password after logging in.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting password:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-user-password.js <email> <newPassword>');
  console.error('Example: node scripts/reset-user-password.js camrpjd@gmail.com NewSecurePass123!');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ Password must be at least 6 characters long');
  process.exit(1);
}

resetPassword(email, newPassword);
