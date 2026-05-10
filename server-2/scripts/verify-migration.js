#!/usr/bin/env node

/**
 * Verify Migration
 * Compares document counts between old and new databases
 * 
 * Usage: node verify-migration.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const OLD_DB_URI = process.env.MONGODB_URI;
const NEW_DB_URI = process.env.NEW_MONGODB_URI;

const COLLECTIONS = [
  'counters',
  'users',
  'firms',
  'clients',
  'folders',
  'documents',
  'threads',
  'messages',
  'notifications',
  'payments',
  'subscriptions',
  'sessions',
];

async function verifyMigration() {
  console.log('🔍 Verifying Migration\n');
  console.log('═══════════════════════════════════════════════════\n');
  
  if (!OLD_DB_URI || !NEW_DB_URI) {
    console.error('❌ Error: Database URIs not found in .env file');
    process.exit(1);
  }
  
  try {
    // Connect to both databases
    console.log('🔌 Connecting to databases...');
    const oldConnection = await mongoose.createConnection(OLD_DB_URI);
    const newConnection = await mongoose.createConnection(NEW_DB_URI);
    
    // Wait for connections to be ready
    await oldConnection.asPromise();
    await newConnection.asPromise();
    
    console.log('✅ Connected to both databases\n');
    
    const oldDb = oldConnection.db;
    const newDb = newConnection.db;
    
    console.log('📊 Document Counts Comparison:\n');
    console.log('Collection'.padEnd(20) + 'Old DB'.padEnd(15) + 'New DB'.padEnd(15) + 'Status');
    console.log('─'.repeat(65));
    
    let allMatch = true;
    const results = [];
    
    for (const collectionName of COLLECTIONS) {
      try {
        const oldCount = await oldDb.collection(collectionName).countDocuments();
        const newCount = await newDb.collection(collectionName).countDocuments();
        
        const status = oldCount === newCount ? '✅ Match' : '❌ Mismatch';
        const match = oldCount === newCount;
        
        if (!match) allMatch = false;
        
        console.log(
          collectionName.padEnd(20) + 
          oldCount.toString().padEnd(15) + 
          newCount.toString().padEnd(15) + 
          status
        );
        
        results.push({ collection: collectionName, oldCount, newCount, match });
      } catch (error) {
        console.log(
          collectionName.padEnd(20) + 
          'Error'.padEnd(15) + 
          'Error'.padEnd(15) + 
          `❌ ${error.message}`
        );
        allMatch = false;
        results.push({ collection: collectionName, oldCount: 0, newCount: 0, match: false });
      }
    }
    
    console.log('─'.repeat(65));
    
    const totalOld = results.reduce((sum, r) => sum + r.oldCount, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newCount, 0);
    
    console.log(
      'TOTAL'.padEnd(20) + 
      totalOld.toString().padEnd(15) + 
      totalNew.toString().padEnd(15) + 
      (totalOld === totalNew ? '✅ Match' : '❌ Mismatch')
    );
    
    console.log('\n');
    
    if (allMatch && totalOld > 0) {
      console.log('🎉 Migration verified successfully!');
      console.log('   All collections match between old and new databases.');
    } else if (totalNew === 0) {
      console.log('⚠️  New database is empty!');
      console.log('   Migration may have failed or not been run yet.');
      console.log('\n📝 Run migration with: node scripts/migrate-database.js');
    } else {
      console.log('⚠️  Migration incomplete or has mismatches!');
      console.log('   Some collections have different counts.');
      console.log('\n📝 You may need to re-run migration: node scripts/migrate-database.js');
    }
    
    await oldConnection.close();
    await newConnection.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
