const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/pirap/Downloads/New folder/server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    console.log('Checking all tables for orphaned rows (data referencing deleted records)...');
    
    // 1. buy_offers
    const r1 = await pool.query('SELECT COUNT(*) FROM public.buy_offers WHERE user_id NOT IN (SELECT profile_id FROM public.profiles)');
    console.log(' - Orphaned buy_offers (no profile):', r1.rows[0].count);

    // 2. offer_slots
    const r2 = await pool.query('SELECT COUNT(*) FROM public.offer_slots WHERE product_id NOT IN (SELECT product_id FROM public.buy_offers)');
    console.log(' - Orphaned offer_slots (no buy_offer):', r2.rows[0].count);

    // 3. bookings
    const r3 = await pool.query(`
      SELECT COUNT(*) FROM public.bookings 
      WHERE product_id NOT IN (SELECT product_id FROM public.buy_offers)
         OR slot_id NOT IN (SELECT slot_id FROM public.offer_slots)
         OR farmer_id NOT IN (SELECT profile_id FROM public.profiles)
         OR buyer_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log(' - Orphaned bookings (missing offer, slot, farmer or buyer):', r3.rows[0].count);

    // 4. offer_grades
    const r4 = await pool.query('SELECT COUNT(*) FROM public.offer_grades WHERE offer_id NOT IN (SELECT product_id FROM public.buy_offers)');
    console.log(' - Orphaned offer_grades (no buy_offer):', r4.rows[0].count);

    // 5. follows
    const r5 = await pool.query(`
      SELECT COUNT(*) FROM public.follows 
      WHERE follower_id NOT IN (SELECT profile_id FROM public.profiles)
         OR following_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log(' - Orphaned follows (no follower/following profile):', r5.rows[0].count);

    // 6. chat_rooms
    const r6 = await pool.query(`
      SELECT COUNT(*) FROM public.chat_rooms 
      WHERE user1_id NOT IN (SELECT profile_id FROM public.profiles)
         OR user2_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log(' - Orphaned chat_rooms (no profile):', r6.rows[0].count);

    // 7. chat_messages
    const r7 = await pool.query(`
      SELECT COUNT(*) FROM public.chat_messages 
      WHERE room_id NOT IN (SELECT room_id FROM public.chat_rooms)
         OR sender_id NOT IN (SELECT profile_id FROM public.profiles)
    `);
    console.log(' - Orphaned chat_messages (no room/sender):', r7.rows[0].count);

    // 8. notifications
    const r8 = await pool.query('SELECT COUNT(*) FROM public.notifications WHERE user_id NOT IN (SELECT profile_id FROM public.profiles)');
    console.log(' - Orphaned notifications (no user profile):', r8.rows[0].count);

    // 9. notification_settings
    const r9 = await pool.query('SELECT COUNT(*) FROM public.notification_settings WHERE user_id NOT IN (SELECT profile_id FROM public.profiles)');
    console.log(' - Orphaned notification_settings (no user profile):', r9.rows[0].count);

    // 10. device_sessions
    const r10 = await pool.query('SELECT COUNT(*) FROM public.device_sessions WHERE user_id NOT IN (SELECT profile_id FROM public.profiles)');
    console.log(' - Orphaned device_sessions (no user profile):', r10.rows[0].count);

    console.log('Integrity check completed.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
