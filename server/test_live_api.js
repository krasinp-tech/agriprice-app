
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const API_URL = 'https://agriprice-app.onrender.com/api/bookings';

const testFarmer = {
  id: 'c9a38310-0e6a-41ce-9f32-6cb8613d1745',
  phone: '0812345678',
  role: 'farmer'
};

const token = jwt.sign(testFarmer, JWT_SECRET);

async function testLiveAPI() {
  console.log('📡 Sending LIVE Booking Request to the CORRECT URL...');
  
  const payload = {
    product_id: 52,
    slot_id: 59,
    scheduled_time: new Date().toISOString(),
    note: JSON.stringify({ contact_name: 'TEST FINAL', contact_phone: '0000000000', amount: 99 }),
    address: 'API FINAL TEST'
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      console.log('✅ LIVE TEST SUCCESS!');
      console.log('🎉 Queue Number Assigned:', result.data.queue_no);
      console.log('📦 Booking No:', result.data.booking_no);
    } else {
      console.log('❌ LIVE TEST FAILED:', result.message);
    }
  } catch (e) {
    console.error('❌ Network Error:', e.message);
  }
}

testLiveAPI();
