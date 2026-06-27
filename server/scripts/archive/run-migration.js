const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('Starting migration to add missing indexes...');

    // 1. Index on bookings(product_id)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_product_id 
      ON public.bookings(product_id)
    `);
    console.log('✅ Created index idx_bookings_product_id');

    // 2. Index on profiles(email)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_profiles_email 
      ON public.profiles(email)
    `);
    console.log('✅ Created index idx_profiles_email');

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
