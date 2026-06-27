const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Orphan buy_offers (no profile)
    const res1 = await pool.query(`
      SELECT COUNT(*) FROM public.buy_offers 
      WHERE user_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log('Orphan buy_offers:', res1.rows[0].count);

    // 2. Orphan offer_slots (no buy_offer)
    const res2 = await pool.query(`
      SELECT COUNT(*) FROM public.offer_slots 
      WHERE product_id NOT IN (SELECT product_id FROM public.buy_offers)
    `);
    console.log('Orphan offer_slots:', res2.rows[0].count);

    // 3. Orphan bookings (no buy_offer or no slot or no profile)
    const res3 = await pool.query(`
      SELECT COUNT(*) FROM public.bookings 
      WHERE product_id NOT IN (SELECT product_id FROM public.buy_offers)
         OR (slot_id IS NOT NULL AND slot_id NOT IN (SELECT slot_id FROM public.offer_slots))
         OR farmer_id NOT IN (SELECT profile_id FROM public.profiles)
         OR buyer_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log('Orphan bookings:', res3.rows[0].count);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
