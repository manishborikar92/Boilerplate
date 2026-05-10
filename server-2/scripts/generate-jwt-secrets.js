/**
 * Script to generate secure JWT secrets and update the .env file
 * Usage: node src/scripts/generate-jwt-secrets.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
const prompt = (question) => new Promise((resolve) => {
  rl.question(question, (answer) => resolve(answer));
});

// Function to generate a secure random string
const generateSecureSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

async function generateJwtSecrets() {
  try {
    console.log('Generating secure JWT secrets...');
    
    // Path to .env file
    const envPath = path.resolve(process.cwd(), '.env');
    
    // Check if .env file exists
    if (!fs.existsSync(envPath)) {
      console.error('.env file not found. Creating a new one.');
      fs.writeFileSync(envPath, '');
    }
    
    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Generate new secrets
    const jwtSecret = generateSecureSecret();
    const jwtRefreshSecret = generateSecureSecret();
    
    // Ask for confirmation
    console.log('\nNew JWT secrets generated:');
    console.log(`JWT_SECRET=${jwtSecret.substring(0, 10)}...`);
    console.log(`JWT_REFRESH_SECRET=${jwtRefreshSecret.substring(0, 10)}...`);
    
    const confirm = await prompt('\nDo you want to update your .env file with these secrets? (y/n): ');
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('Operation cancelled. No changes were made.');
      rl.close();
      return;
    }
    
    // Update JWT_SECRET
    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(
        /JWT_SECRET=.*/,
        `JWT_SECRET=${jwtSecret}`
      );
    } else {
      envContent += `\nJWT_SECRET=${jwtSecret}`;
    }
    
    // Update JWT_REFRESH_SECRET
    if (envContent.includes('JWT_REFRESH_SECRET=')) {
      envContent = envContent.replace(
        /JWT_REFRESH_SECRET=.*/,
        `JWT_REFRESH_SECRET=${jwtRefreshSecret}`
      );
    } else {
      envContent += `\nJWT_REFRESH_SECRET=${jwtRefreshSecret}`;
    }
    
    // Write updated content back to .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\nJWT secrets updated successfully in .env file!');
    console.log('Your application is now more secure.');
    
    rl.close();
  } catch (error) {
    console.error('Error generating JWT secrets:', error);
    rl.close();
    process.exit(1);
  }
}

generateJwtSecrets();