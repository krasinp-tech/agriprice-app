const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/pirap/Downloads/New folder/server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const tables = ['bookings', 'buy_offers', 'offer_slots', 'profiles', 'chat_rooms', 'chat_messages', 'notifications', 'follows'];
    for (const t of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [t]);
      console.log(`\nTable [${t}] columns:`);
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
