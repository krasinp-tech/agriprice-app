const { supabaseAdmin } = require('../utils/supabase');
const { makeBookingNo } = require('../utils/helpers');
const { sendPushNotification } = require('./fcmService');

class BookingService {
  async listBookings(userId, role, status) {
    console.log('[BookingService] Querying bookings for:', { userId, role, status });
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        farmer:profiles!farmer_id(profile_id, first_name, last_name, phone, avatar),
        buyer:profiles!buyer_id(profile_id, first_name, last_name, phone, avatar, address_line1, address_line2, map_link),
        product:buy_offers!product_id(product_id, name, category, unit),
        slot:offer_slots!slot_id(slot_id, slot_name, time_start, time_end)
      `)
      .order('created_at', { ascending: false });

    if (role === 'farmer') {
      query = query.eq('farmer_id', userId);
    } else if (role === 'buyer') {
      query = query.eq('buyer_id', userId);
    } else {
      throw new Error('Unauthorized role');
    }

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[BookingService] Database Error:', error);
      throw error;
    }
    return data;
  }

  async getBookingDetail(bookingIdOrNo, userId) {
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        farmer:profiles!farmer_id(*),
        buyer:profiles!buyer_id(*),
        product:buy_offers!product_id(*),
        slot:offer_slots!slot_id(*)
      `);

    if (!isNaN(Number(bookingIdOrNo))) {
      query = query.eq('booking_id', bookingIdOrNo);
    } else {
      query = query.eq('booking_no', bookingIdOrNo);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('ไม่พบข้อมูลการจอง');

    if (data.farmer_id !== userId && data.buyer_id !== userId) {
      throw new Error('Forbidden');
    }

    return data;
  }

  async getQueueStatus(bookingId, userId) {
    const booking = await this.getBookingDetail(bookingId, userId);
    if (!booking) throw new Error('ไม่พบข้อมูลการจอง');

    if (booking.status !== 'waiting' || !booking.slot_id) {
      return {
        currentQueue: booking.queue_no || '-',
        waitingAhead: 0,
        status: booking.status
      };
    }

    // Calculate start and end of the booking day in Asia/Bangkok (UTC+7)
    let startOfDay, endOfDay;
    try {
      const bkkTime = new Date(new Date(booking.scheduled_time).getTime() + 7 * 60 * 60 * 1000);
      const bkkDateString = bkkTime.toISOString().split('T')[0];
      startOfDay = new Date(`${bkkDateString}T00:00:00+07:00`).toISOString();
      endOfDay = new Date(`${bkkDateString}T23:59:59.999+07:00`).toISOString();
    } catch (e) {
      // Fallback in case of parse error
      startOfDay = new Date().toISOString();
      endOfDay = new Date().toISOString();
    }

    // Count bookings ahead in the same slot on the same day (waiting status and created earlier)
    const { count: waitingAhead, error: countErr } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', booking.slot_id)
      .eq('status', 'waiting')
      .gte('scheduled_time', startOfDay)
      .lte('scheduled_time', endOfDay)
      .lt('created_at', booking.created_at);

    if (countErr) throw countErr;

    // Get the queue_no currently at the front of the queue (oldest waiting booking in this slot on the same day)
    const { data: currentBookingRow, error: curErr } = await supabaseAdmin
      .from('bookings')
      .select('queue_no')
      .eq('slot_id', booking.slot_id)
      .eq('status', 'waiting')
      .gte('scheduled_time', startOfDay)
      .lte('scheduled_time', endOfDay)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (curErr) throw curErr;

    return {
      currentQueue: currentBookingRow?.queue_no || '-',
      waitingAhead: waitingAhead || 0,
      status: booking.status
    };
  }

  async createBooking(farmerId, bookingData) {
    const { product_id, slot_id, scheduled_time, note } = bookingData;
    const vehicle_info = bookingData.vehicle_info || bookingData.vehicle_plates || '';
    const expected_qty = bookingData.expected_qty !== undefined ? bookingData.expected_qty : (bookingData.product_amount || 0);

    // 0. Get slot to check capacity & active status
    if (slot_id) {
      const { data: slot } = await supabaseAdmin.from('offer_slots').select('*').eq('slot_id', slot_id).single();
      if (!slot) throw new Error('ไม่พบรอบคิวที่เลือก');
      if (!slot.is_active) throw new Error('รอบคิวนี้ปิดให้บริการแล้ว');
      if (slot.capacity > 0 && slot.booked_count >= slot.capacity) {
        throw new Error('ขออภัย รอบคิวนี้เต็มแล้ว');
      }
    }

    // 1. Get product to find buyer_id
    const { data: product } = await supabaseAdmin.from('buy_offers').select('user_id').eq('product_id', product_id).single();
    if (!product) throw new Error('ไม่พบข้อมูลประกาศรับซื้อ');


    const buyerId = product.user_id;
    const booking_no = makeBookingNo();

    // 2. Queue logic (Atomic sequence with daily reset)
    let queue_no = 'Q-01';
    let bkkDateString = new Date().toISOString().split('T')[0];
    try {
      if (scheduled_time) {
        const bkkTime = new Date(new Date(scheduled_time).getTime() + 7 * 60 * 60 * 1000);
        bkkDateString = bkkTime.toISOString().split('T')[0];
      }
    } catch (_) {}

    const { data: nextSeq, error: rpcErr } = await supabaseAdmin.rpc('next_queue_sequence', { 
      p_slot_id: slot_id
    });
    const sequence = (!rpcErr && nextSeq != null) ? nextSeq : 1; 
    queue_no = `Q-${String(sequence).padStart(2, '0')}`;

    // 3. Insert booking
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        booking_no,
        queue_no,
        farmer_id: farmerId,
        buyer_id: buyerId,
        product_id,
        slot_id,
        scheduled_time,
        vehicle_plates: String(vehicle_info || ''), 
        quantity: parseFloat(expected_qty) || 0,
        contact_name: bookingData.contact_name || '',
        contact_phone: bookingData.contact_phone || '',
        address: bookingData.address || '',
        note,
        status: 'waiting'
      })
      .select()
      .single();

    if (error) throw error;

    // 4. Update slot capacity (increment booked_count)
    if (slot_id) {
      try {
        await supabaseAdmin.rpc('increment_booked_count', { p_slot_id: slot_id });
      } catch (err) {
        console.error('[BookingService] Failed to increment booked count:', err.message);
      }
    }

    // 5. Notify buyer
    await sendPushNotification(buyerId, 'มีการจองคิวใหม่', `เลขที่ ${booking_no} (${queue_no})`).catch(() => {});

    return data;
  }

  async updateBookingStatus(bookingId, userId, role, status) {
    const booking = await this.getBookingDetail(bookingId, userId);

    if (booking.status === status) {
      return booking; // already in this status
    }

    if (role === 'farmer' && status !== 'cancel') {
      throw new Error('เกษตรกรสามารถยกเลิกได้เท่านั้น');
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status })
      .eq('booking_id', booking.booking_id)
      .select()
      .single();

    if (error) throw error;

    // Logic for notifications and slot decrement on cancel...
    if (status === 'cancel' && booking.slot_id) {
      try {
        await supabaseAdmin.rpc('decrement_booked_count', { p_slot_id: booking.slot_id });
      } catch (err) {
        console.error('[BookingService] Failed to decrement booked count:', err.message);
      }
    }

    return data;
  }
}

module.exports = new BookingService();
