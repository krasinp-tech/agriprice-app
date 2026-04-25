require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function testStatuses() {
  const statuses = ['missed', 'cancelled', 'cancel', 'expired', 'timeout'];
  
  // We need an existing booking ID to test updates on.
  const { data: booking } = await supabaseAdmin.from('bookings').select('booking_id').limit(1);
  if (!booking || booking.length === 0) {
    console.log('❌ No bookings to test with.');
    return;
  }
  
  const id = booking[0].booking_id;
  
  for (const status of statuses) {
    console.log(`Testing status: ${status}`);
    const { error } = await supabaseAdmin.from('bookings').update({ status }).eq('booking_id', id);
    if (error) {
      console.log(`❌ Failed: ${error.message}`);
    } else {
      console.log(`✅ Success: '${status}' is allowed!`);
      // Revert back
      await supabaseAdmin.from('bookings').update({ status: 'waiting' }).eq('booking_id', id);
      break;
    }
  }
}

testStatuses();
