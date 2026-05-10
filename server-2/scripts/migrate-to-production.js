/**
 * Database Migration: Test to Production
 * Transfers all collections from the default 'test' database to the new 'caflow_db'
 * * As per MongoDB Configuration:
 * - Source Database: test (Default)
 * - Target Database: caflow_db (Production/Clean)
 * * Method:
 * - Uses MongoDB Aggregation Pipeline with $out stage.
 * - This performs the transfer server-side within the cluster for maximum speed.
 * - Dynamically fetches all collections to ensure no data is left behind.
 * * Usage: node scripts/migrate-to-production.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// --- CONFIGURATION ---
// We use the URI from .env, but ensure we connect to the root to access multiple DBs
const uri = process.env.MONGODB_URI || "mongodb+srv://caflow2026_db_user:GLyb1LwhH1pS5JUI@cluster0.o9rxlsn.mongodb.net/?appName=Cluster0";
const sourceDbName = "test";
const targetDbName = "caflow_db";

/**
 * Migration Logic
 * Iterates through 'test' and clones every collection into 'targetDbName'
 */
async function migrateData() {
    const client = new MongoClient(uri);

    try {
        console.log('🌱 Starting Database Migration...\n');
        await client.connect();
        console.log("✅ Connected to MongoDB Cluster");

        const sourceDb = client.db(sourceDbName);
        
        // 1. Fetch all collections in the 'test' database
        const collections = await sourceDb.listCollections().toArray();
        
        if (collections.length === 0) {
            console.warn(`⚠️  No collections found in '${sourceDbName}' database.`);
            return;
        }

        console.log(`📋 Found ${collections.length} collections to move.\n`);

        // 2. Process each collection
        for (let collInfo of collections) {
            const collectionName = collInfo.name;
            console.log(`📦 Moving: [${sourceDbName}.${collectionName}] -> [${targetDbName}.${collectionName}]`);

            /**
             * The $out operator writes the results of the aggregation pipeline 
             * to a specified collection in a specified database.
             */
            await sourceDb.collection(collectionName).aggregate([
                { 
                    $out: { 
                        db: targetDbName, 
                        coll: collectionName 
                    } 
                }
            ]).toArray();

            console.log(`   ✅ Success: ${collectionName} transferred.`);
        }

        console.log(`\n✨ Migration complete!`);
        console.log(`ℹ️  Verification: Open MongoDB Compass and check the '${targetDbName}' database.`);
        console.log(`⚠️  Note: Indexes are not copied by $out. Please ensure your application re-indexes the new DB.\n`);

    } catch (err) {
        console.error("❌ Migration failed critical error:", err.message);
    } finally {
        // 3. Close connection
        await client.close();
        console.log("🔌 Database connection closed");
    }
}

// Execute Migration
migrateData();