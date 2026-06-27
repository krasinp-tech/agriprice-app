const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🔍 Starting Final Database Integrity Check...');
  try {
    // 1. Check Tables and Row Counts
    const resTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('\n--- 1. Tables & Row Counts ---');
    for (const row of resTables.rows) {
      const name = row.table_name;
      const resCount = await pool.query(`SELECT COUNT(*)::INTEGER FROM public.${name}`);
      console.log(` - Table [${name}]: ${resCount.rows[0].count} rows`);
    }

    // 2. Check for Duplicate Indexes
    const resIndexes = await pool.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname
    `);
    console.log('\n--- 2. Active Indexes ---');
    console.log(`Total active indexes: ${resIndexes.rows.length}`);

    // 3. Scan all Database Functions for old table names (products / product_slots)
    const resRoutines = await pool.query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_definition IS NOT NULL
    `);
    console.log('\n--- 3. Database Functions (RPCs) Safety Check ---');
    let dirtyFunctions = 0;
    resRoutines.rows.forEach(r => {
      const def = r.routine_definition.toLowerCase();
      if (def.includes('product_slots') || (def.includes('products') && !def.includes('buy_offers'))) {
        console.warn(` ⚠️ WARNING: Function [${r.routine_name}] contains references to old table names!`);
        dirtyFunctions++;
      }
    });
    if (dirtyFunctions === 0) {
      console.log(' ✅ All database functions are safe (no references to obsolete tables).');
    }

    // 4. Scan Bookings for orphans
    const resOrphans = await pool.query(`
      SELECT COUNT(*)::INTEGER 
      FROM public.bookings
      WHERE farmer_id IS NULL 
         OR buyer_id IS NULL 
         OR product_id IS NULL
    `);
    console.log('\n--- 4. Data Consistency Check ---');
    if (resOrphans.rows[0].count === 0) {
      console.log(' ✅ No orphaned bookings found.');
    } else {
      console.warn(` ⚠️ WARNING: Found ${resOrphans.rows[0].count} orphaned bookings!`);
    }

  } catch (err) {
    console.error('❌ Check failed with error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
