require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function testFlow() {
  console.log('--- 🧪 Testing Queue Creation & Booking Flow ---');
  
  try {
    // 1. Mock a product (if none exists)
    let productId;
    const { data: pData } = await supabaseAdmin.from('products').select('product_id').limit(1);
    if (pData && pData.length > 0) {
      productId = pData[0].product_id;
      console.log('✅ Using existing product:', productId);
    } else {
      console.log('❌ No products found. Please create a product first.');
      return;
    }

    // 2. Create a Slot (Mocking Step 2 Save)
    const slotPayload = {
      product_id: productId,
      slot_name: 'รอบทดสอบ 08:00 - 10:00',
      start_date: '2026-04-25',
      end_date: '2026-04-26',
      time_start: '08:00',
      time_end: '10:00',
      capacity: 5,
      booked_count: 0,
      is_active: true
    };

    console.log('⏳ Creating test slot...');
    const { data: sData, error: sError } = await supabaseAdmin.from('product_slots').insert(slotPayload).select().single();
    if (sError) throw sError;
    console.log('✅ Slot created successfully:', sData.slot_id);

    // 3. Mock a Booking (Farmer side)
    const { data: userData } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (!userData || userData.length === 0) {
      console.log('❌ No users found to perform booking.');
      return;
    }
    const farmerId = userData[0].id;

    const bookingPayload = {
      user_id: farmerId,
      product_id: productId,
      slot_id: sData.slot_id,
      quantity: 100, // 100 kg
      status: 'pending',
      booking_date: '2026-04-25'
    };

    console.log('⏳ Mocking farmer booking...');
    const { data: bData, error: bError } = await supabaseAdmin.from('bookings').insert(bookingPayload).select().single();
    if (bError) throw bError;
    console.log('✅ Booking successful! Booking ID:', bData.booking_id || bData.id);

    // 4. Verification
    const { data: finalSlot } = await supabaseAdmin.from('product_slots').select('*').eq('slot_id', sData.slot_id).single();
    console.log('📊 Final Slot Status:', finalSlot);

  } catch (e) {
    console.error('❌ Test Failed:', e.message);
  }
}

testFlow();
