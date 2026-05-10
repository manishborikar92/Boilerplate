#!/usr/bin/env node

/**
 * Database Migration Script
 * Migrates all data from old MongoDB instance to new MongoDB instance
 * 
 * Usage: node migrate-database.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models
const User = require('../src/models/User');
const Firm = require('../src/models/Firm');
const Client = require('../src/models/Client');
const Document = require('../src/models/Document');
const Folder = require('../src/models/Folder');
const Thread = require('../src/models/Thread');
const Message = require('../src/models/Message');
const Notification = require('../src/models/Notification');
const Payment = require('../src/models/Payment');
const Subscription = require('../src/models/Subscription');
const Session = require('../src/models/Session');
const Counter = require('../src/models/Counter');

// Database connection strings
const OLD_DB_URI = process.env.MONGODB_URI; // Current database
const NEW_DB_URI = process.env.NEW_MONGODB_URI; // New database

// Models to migrate (in order to respect dependencies)
const MODELS = [
  { name: 'Counter', model: Counter },
  { name: 'User', model: User },
  { name: 'Firm', model: Firm },
  { name: 'Client', model: Client },
  { name: 'Folder', model: Folder },
  { name: 'Document', model: Document },
  { name: 'Thread', model: Thread },
  { name: 'Message', model: Message },
  { name: 'Notification', model: Notification },
  { name: 'Payment', model: Payment },
  { name: 'Subscription', model: Subscription },
  { name: 'Session', model: Session },
];

/**
 * Create separate connections for source and target databases
 */
async function createConnections() {
  console.log('🔌 Creating database connections...\n');
  
  const oldConnection = await mongoose.createConnection(OLD_DB_URI);
  console.log('✅ Connected to OLD database');
  
  const newConnection = await mongoose.createConnection(NEW_DB_URI);
  console.log('✅ Connected to NEW database\n');
  
  return { oldConnection, newConnection };
}

/**
 * Migrate a single collection
 */
async function migrateCollection(name, oldModel, newModel) {
  console.log(`📦 Migrating ${name}...`);
  
  try {
    // Get all documents from old database
    const documents = await oldModel.find({}).lean();
    console.log(`   Found ${documents.length} documents`);
    
    if (documents.length === 0) {
      console.log(`   ⏭️  Skipping (no data)\n`);
      return { success: true, count: 0 };
    }
    
    // Insert into new database
    if (documents.length > 0) {
      await newModel.insertMany(documents, { ordered: false });
      console.log(`   ✅ Migrated ${documents.length} documents\n`);
    }
    
    return { success: true, count: documents.length };
  } catch (error) {
    console.error(`   ❌ Error migrating ${name}:`, error.message);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting Database Migration\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  // Validate environment variables
  if (!OLD_DB_URI) {
    console.error('❌ Error: MONGODB_URI not found in .env file');
    process.exit(1);
  }
  
  if (!NEW_DB_URI) {
    console.error('❌ Error: NEW_MONGODB_URI not found in .env file');
    console.error('   Please add NEW_MONGODB_URI to your .env file');
    process.exit(1);
  }
  
  console.log('📍 Source Database:', OLD_DB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
  console.log('📍 Target Database:', NEW_DB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
  console.log('');
  
  let oldConnection, newConnection;
  const results = [];
  
  try {
    // Create connections
    ({ oldConnection, newConnection } = await createConnections());
    
    // Migrate each collection
    for (const { name, model } of MODELS) {
      const oldModel = oldConnection.model(name, model.schema);
      const newModel = newConnection.model(name, model.schema);
      
      const result = await migrateCollection(name, oldModel, newModel);
      results.push({ name, ...result });
    }
    
    // Print summary
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 Migration Summary\n');
    
    let totalMigrated = 0;
    let totalFailed = 0;
    
    results.forEach(({ name, success, count, error }) => {
      if (success) {
        console.log(`✅ ${name}: ${count} documents`);
        totalMigrated += count;
      } else {
        console.log(`❌ ${name}: FAILED - ${error}`);
        totalFailed++;
      }
    });
    
    console.log('');
    console.log(`📈 Total Migrated: ${totalMigrated} documents`);
    console.log(`❌ Failed Collections: ${totalFailed}`);
    console.log('');
    
    if (totalFailed === 0) {
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('⚠️  IMPORTANT NEXT STEPS:');
      console.log('   1. Verify data in new database');
      console.log('   2. Update MONGODB_URI in .env to point to new database');
      console.log('   3. Test application thoroughly');
      console.log('   4. Keep old database as backup for a few days');
    } else {
      console.log('⚠️  Migration completed with errors. Please review failed collections.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    // Close connections
    if (oldConnection) await oldConnection.close();
    if (newConnection) await newConnection.close();
    console.log('\n🔌 Database connections closed');
  }
}

// Run migration
migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
