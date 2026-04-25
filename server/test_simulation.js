
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSimulation() {
  console.log('🚀 Starting Full Booking Simulation...');

  try {
    // 1. หา Buyer และ Farmer สำหรับทดสอบ
    const { data: profiles } = await supabase.from('profiles').select('profile_id, role').limit(10);
    const buyer = profiles.find(p => p.role === 'buyer');
    const farmer = profiles.find(p => p.role === 'farmer');

    if (!buyer || !farmer) {
      console.error('Could not find enough test profiles (need 1 buyer and 1 farmer)');
      return;
    }
    console.log(`✅ Using Buyer: ${buyer.profile_id}, Farmer: ${farmer.profile_id}`);

    // 2. จำลองการสร้าง Product โดย Buyer
    const { data: product, error: pErr } = await supabase.from('products').insert({
      user_id: buyer.profile_id,
      name: 'ทุเรียนหมอนทอง (Test)',
      category: 'ผลไม้',
      variety: 'หมอนทอง',
      price: 150,
      grade: 'A',
      unit: 'กก.',
      is_active: true
    }).select().single();

    if (pErr) throw pErr;
    console.log(`✅ Product Created: ${product.product_id}`);

    // 3. จำลองการสร้าง Slot (รอบคิว)
    const { data: slot, error: sErr } = await supabase.from('product_slots').insert({
      product_id: product.product_id,
      slot_name: 'รอบเช้า (Test)',
      time_start: '08:00',
      time_end: '12:00',
      capacity: 10,
      is_active: true,
      booked_count: 0,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0]
    }).select().single();

    if (sErr) throw sErr;
    console.log(`✅ Slot Created: ${slot.slot_id}`);

    // 4. จำลองการจองโดย Farmer (เลียนแบบ Logic ใน bookings.js)
    // เช็คคิวปัจจุบัน
    const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('slot_id', slot.slot_id);
    const queue_no = `Q-${String((count || 0) + 1).padStart(2, '0')}`;
    
    const { data: booking, error: bErr } = await supabase.from('bookings').insert({
      booking_no: 'BK-TEST-' + Math.floor(Math.random()*1000),
      queue_no: queue_no,
      farmer_id: farmer.profile_id,
      buyer_id: buyer.profile_id,
      product_id: product.product_id,
      slot_id: slot.slot_id,
      scheduled_time: new Date().toISOString(),
      status: 'waiting',
      product_amount: 50,
      quantity: 50,
      contact_name: 'เกษตรกร ทดสอบ',
      contact_phone: '0812345678'
    }).select().single();

    if (bErr) throw bErr;
    console.log(`🎉 Booking Successful! Queue Number: ${booking.queue_no}`);
    console.log('--- Simulation Passed ---');

    // ลบข้อมูลทดสอบทิ้ง (Cleanup)
    await supabase.from('bookings').delete().eq('booking_id', booking.booking_id);
    await supabase.from('product_slots').delete().eq('slot_id', slot.slot_id);
    await supabase.from('products').delete().eq('product_id', product.product_id);
    console.log('🧹 Cleanup done.');

  } catch (err) {
    console.error('❌ Simulation Failed:', err.message);
  }
}

runSimulation();
