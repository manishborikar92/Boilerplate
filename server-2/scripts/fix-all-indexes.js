/**
 * Fix All Index Issues
 * 
 * Problem: Old single-field unique indexes on sequential number fields cause conflicts
 * Solution: Drop old indexes and ensure compound indexes exist
 * 
 * Affected collections:
 * - notifications: notificationNumber should be unique per firm
 * - threads: threadNumber should be unique per firm
 * 
 * Usage: node scripts/fix-all-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTIONS_TO_FIX = [
  {
    name: 'notifications',
    oldIndexName: 'notificationNumber_1',
    compoundIndex: { firmId: 1, notificationNumber: 1 },
    compoundIndexName: 'firmId_1_notificationNumber_1'
  },
  {
    name: 'threads',
    oldIndexName: 'threadNumber_1',
    compoundIndex: { firmId: 1, threadNumber: 1 },
    compoundIndexName: 'firmId_1_threadNumber_1'
  }
];

async function fixCollectionIndexes(db, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Collection: ${config.name}`);
  console.log('='.repeat(60));

  const collection = db.collection(config.name);

  // Check if collection exists
  const collections = await db.listCollections({ name: config.name }).toArray();
  if (collections.length === 0) {
    console.log(`⚠️  Collection '${config.name}' does not exist yet - skipping`);
    return;
  }

  console.log('\n📋 Current indexes:');
  const indexes = await collection.indexes();
  indexes.forEach(index => {
    const unique = index.unique ? ' [UNIQUE]' : '';
    console.log(`  - ${index.name}:`, JSON.stringify(index.key), unique);
  });

  // Check if old single-field index exists
  const oldIndex = indexes.find(idx => idx.name === config.oldIndexName);

  if (oldIndex && Object.keys(oldIndex.key).length === 1) {
    console.log(`\n⚠️  Found problematic single-field index: ${config.oldIndexName}`);
    console.log('🗑️  Dropping old index...');
    try {
      await collection.dropIndex(config.oldIndexName);
      console.log('✅ Old index dropped');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('ℹ️  Index already dropped or does not exist');
      } else {
        throw error;
      }
    }
  } else {
    console.log(`\n✅ No problematic single-field index found`);
  }

  // Ensure compound index exists
  const compoundIndex = indexes.find(idx => {
    const keys = Object.keys(config.compoundIndex);
    return keys.every(key => idx.key[key] === config.compoundIndex[key]);
  });

  if (!compoundIndex) {
    console.log(`\n📝 Creating compound index...`);
    console.log(`   Keys: ${JSON.stringify(config.compoundIndex)}`);
    try {
      await collection.createIndex(
        config.compoundIndex,
        { unique: true, name: config.compoundIndexName }
      );
      console.log('✅ Compound index created');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('ℹ️  Index already exists with different options');
      } else {
        throw error;
      }
    }
  } else {
    console.log(`\n✅ Compound index already exists`);
  }

  console.log('\n📋 Final indexes:');
  const finalIndexes = await collection.indexes();
  finalIndexes.forEach(index => {
    const unique = index.unique ? ' [UNIQUE]' : '';
    console.log(`  - ${index.name}:`, JSON.stringify(index.key), unique);
  });
}

async function fixAllIndexes() {
  try {
    console.log('🔧 Starting index fix process...\n');
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Fix each collection
    for (const config of COLLECTIONS_TO_FIX) {
      await fixCollectionIndexes(db, config);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All index fixes completed successfully!');
    console.log('='.repeat(60));
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error fixing indexes:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

fixAllIndexes();
