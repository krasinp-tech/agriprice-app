require('dotenv').config();
const db = require('./db');
const logger = require('./utils/logger');

async function checkData() {
  try {
    const bookings = await db.query('SELECT count(*) FROM bookings');
    const chats = await db.query('SELECT count(*) FROM chat_rooms');
    const messages = await db.query('SELECT count(*) FROM chat_messages');
    const products = await db.query('SELECT count(*) FROM products');
    
    console.log('--- Database Stats ---');
    console.log('Bookings:', bookings.rows[0].count);
    console.log('Chats:', chats.rows[0].count);
    console.log('Messages:', messages.rows[0].count);
    console.log('Products:', products.rows[0].count);
    
    // Check for recent bookings
    const recentBookings = await db.query('SELECT booking_id, user_id, status, created_at FROM bookings ORDER BY created_at DESC LIMIT 5');
    console.log('\n--- Recent Bookings ---');
    console.log(recentBookings.rows);
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking data:', err);
    process.exit(1);
  }
}

checkData();
