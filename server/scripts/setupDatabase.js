/**
 * Database Setup Script
 * Run this to create all tables in your Render PostgreSQL database
 * 
 * Usage:
 *   DATABASE_URL="your-connection-string" node scripts/setupDatabase.js
 * 
 * Or set DATABASE_URL in your .env file
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function setupDatabase() {
  try {
    console.log('📦 Reading schema file...');
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected to database');

    console.log('🚀 Running schema...');
    await client.query(schema);
    console.log('✅ Schema executed successfully!');

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });

    client.release();
    await pool.end();
    console.log('\n🎉 Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    if (error.code === '42P07') {
      console.log('⚠️  Some tables already exist. This is okay if you\'re re-running the script.');
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

setupDatabase();

