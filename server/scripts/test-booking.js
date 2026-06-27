const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bookingService = require('../services/bookingService');
const { supabaseAdmin } = require('../utils/supabase');

async function testBooking() {
  console.log('🚀 Running Booking Integration Test...');

  try {
    // 1. Find a farmer profile
    const { data: farmers, error: farmerErr } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, first_name, last_name')
      .eq('role', 'farmer')
      .limit(1);

    if (farmerErr) throw farmerErr;
    if (!farmers || farmers.length === 0) {
      console.log('❌ No farmer found in database. Cannot run booking test.');
      return;
    }
    const farmer = farmers[0];
    console.log(`📌 Found test farmer: ${farmer.first_name} ${farmer.last_name} (${farmer.profile_id})`);

    // 2. Find any product
    const { data: products, error: productErr } = await supabaseAdmin
      .from('buy_offers')
      .select('product_id, name, user_id, is_active')
      .limit(5);

    if (productErr) throw productErr;
    console.log('📌 Products found in DB:', products);
    if (!products || products.length === 0) {
      console.log('❌ No products found in database. Cannot run booking test.');
      return;
    }
    const product = products[0];
    console.log(`📌 Found active product: ${product.name} (${product.product_id}) under buyer: ${product.user_id}`);

    let { data: slots, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('*')
      .eq('product_id', product.product_id)
      .eq('is_active', true)
      .limit(1);

    if (slotErr) throw slotErr;
    let slot = slots && slots[0];

    if (!slot) {
      const { data: newSlot, error: createSlotErr } = await supabaseAdmin
        .from('offer_slots')
        .insert({
          product_id: product.product_id,
          slot_name: 'Test Round A',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          time_start: '08:00:00',
          time_end: '12:00:00',
          capacity: 5,
          booked_count: 0,
          is_active: true
        })
        .select()
        .single();

      if (createSlotErr) throw createSlotErr;
      slot = newSlot;
      console.log(`✅ Temporary slot created: ${slot.slot_name} (${slot.slot_id})`);
    } else {
      console.log(`📌 Found active slot: ${slot.slot_name} (${slot.slot_id})`);
    }

    // Clear existing bookings for this slot to avoid unique queue constraint violation from partial runs
    console.log('⏳ Clearing any existing test bookings for this slot...');
    const { error: preClearErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('slot_id', slot.slot_id);
    if (preClearErr) throw preClearErr;

    // Reset booked_count to 0 for this test slot
    await supabaseAdmin
      .from('offer_slots')
      .update({ booked_count: 0 })
      .eq('slot_id', slot.slot_id);

    // 4. Test Create Booking
    const bookingData = {
      product_id: product.product_id,
      slot_id: slot.slot_id,
      scheduled_time: `${new Date().toISOString().split('T')[0]} 09:00:00`,
      vehicle_plates: 'กก 9999 กรุงเทพ',
      expected_qty: 150,
      contact_name: 'สมมุติ เกษตรกร',
      contact_phone: '0899999999',
      address: '123/45 หมู่บ้านทดสอบ',
      note: 'ทดสอบระบบจองคิวอัตโนมัติ'
    };

    console.log('⏳ Attempting to create booking...');
    const booking = await bookingService.createBooking(farmer.profile_id, bookingData);
    console.log('✅ Booking created successfully!');
    console.log('Booking details:', {
      booking_id: booking.booking_id,
      booking_no: booking.booking_no,
      queue_no: booking.queue_no,
      status: booking.status,
      vehicle_plates: booking.vehicle_plates,
      quantity: booking.quantity,
      contact_name: booking.contact_name,
      contact_phone: booking.contact_phone
    });

    // Verify fields were successfully saved
    if (booking.vehicle_plates !== bookingData.vehicle_plates) {
      console.log(`⚠️ Plate number mismatch. Expected ${bookingData.vehicle_plates}, got ${booking.vehicle_plates}`);
    }

    // 5. Clean up created booking
    console.log('⏳ Cleaning up test booking...');
    const { error: deleteErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('booking_id', booking.booking_id);

    if (deleteErr) throw deleteErr;
    console.log('✅ Test booking deleted from database.');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
  }
}

testBooking();
