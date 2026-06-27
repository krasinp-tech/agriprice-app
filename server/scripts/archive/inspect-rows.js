const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    // 1. Profiles
    const resProfiles = await pool.query(`SELECT profile_id, first_name, last_name, role, phone FROM public.profiles`);
    console.log(`\n--- Profiles (${resProfiles.rows.length} rows) ---`);
    resProfiles.rows.forEach(r => {
      console.log(` - ID: ${r.profile_id}, Name: ${r.first_name} ${r.last_name}, Role: ${r.role}, Phone: ${r.phone}`);
    });

    // 2. Buy Offers
    const resOffers = await pool.query(`SELECT product_id, user_id, name, is_active FROM public.buy_offers`);
    console.log(`\n--- Buy Offers (${resOffers.rows.length} rows) ---`);
    resOffers.rows.forEach(r => {
      console.log(` - ID: ${r.product_id}, Owner user_id: ${r.user_id}, Name: ${r.name}, Active: ${r.is_active}`);
    });

    // 3. Bookings
    const resBookings = await pool.query(`SELECT booking_id, booking_no, farmer_id, buyer_id, product_id, status FROM public.bookings`);
    console.log(`\n--- Bookings (${resBookings.rows.length} rows) ---`);
    resBookings.rows.forEach(r => {
      console.log(` - ID: ${r.booking_id}, No: ${r.booking_no}, Farmer: ${r.farmer_id}, Buyer: ${r.buyer_id}, Offer: ${r.product_id}, Status: ${r.status}`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
