const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    for (const tableName of ['buy_offers', 'offer_slots', 'bookings', 'profiles', 'device_sessions', 'notification_settings']) {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.log(`\nColumns for table: ${tableName}`);
      res.rows.forEach(r => {
        console.log(` - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
