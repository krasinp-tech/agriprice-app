const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in public schema:');
    console.log(res.rows.map(r => r.table_name));

    // Also check if products or buy_offers have rows
    for (const tableName of ['buy_offers', 'offer_slots', 'offer_impressions']) {
      try {
        const countRes = await pool.query("SELECT COUNT(*) FROM " + tableName);
        console.log("Table " + tableName + " exists and has " + countRes.rows[0].count + " rows");
      } catch (e) {
        console.log("Table " + tableName + " error: " + e.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
