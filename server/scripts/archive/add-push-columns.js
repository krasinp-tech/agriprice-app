const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('Starting migration to add FCM columns to device_sessions...');

    // 1. Add push_token column
    await pool.query(`
      ALTER TABLE public.device_sessions 
      ADD COLUMN IF NOT EXISTS push_token TEXT
    `);
    console.log('✅ Added column push_token');

    // 2. Add platform column
    await pool.query(`
      ALTER TABLE public.device_sessions 
      ADD COLUMN IF NOT EXISTS platform TEXT
    `);
    console.log('✅ Added column platform');

    // 3. Add last_seen column
    await pool.query(`
      ALTER TABLE public.device_sessions 
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ
    `);
    console.log('✅ Added column last_seen');

    // 4. Add unique constraint on (user_id, push_token)
    // First, check if constraint already exists
    const constraintCheck = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'device_sessions' AND constraint_name = 'unique_user_push_token'
    `);
    
    if (constraintCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE public.device_sessions 
        ADD CONSTRAINT unique_user_push_token UNIQUE (user_id, push_token)
      `);
      console.log('✅ Added UNIQUE constraint unique_user_push_token');
    } else {
      console.log('ℹ️ UNIQUE constraint unique_user_push_token already exists.');
    }

    console.log('FCM Columns migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
