const express = require('express');
const router = express.Router();
const response = require('../response');
const db = require('../db');
const authMiddleware = require('../middlewares/auth');
const bookingSchema = require('../validators/booking');
const logger = require('../utils/logger');
const { supabaseAdmin } = require('../utils/supabase');
const { makeBookingNo } = require('../utils/helpers');

/**
 * GET /api/bookings
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let query = supabaseAdmin
      .from('bookings')
      .select('*, farmer:profiles!farmer_id(profile_id, first_name, last_name, phone, avatar), buyer:profiles!buyer_id(profile_id, first_name, last_name, phone, avatar)')
      .order('scheduled_time', { ascending: false });

    if (role === 'farmer') {
      query = query.eq('farmer_id', userId);
    } else if (role === 'buyer') {
      query = query.eq('buyer_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[GET /bookings] Supabase error:', error);
      throw error;
    }
    res.json({ success: true, data: data || [] });
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/bookings
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { error: schemaErr, value: validBody } = bookingSchema.validate(req.body);
    if (schemaErr) return res.status(400).json(response.error(schemaErr.details[0].message));

    const { product_id, scheduled_time, license_plate, province } = validBody;
    const booking_no = makeBookingNo();

    // Check availability
    // (Logic simplified for brevity, in a real app check slot capacity)
    
    const { data: prodData } = await supabaseAdmin.from('products').select('user_id').eq('product_id', product_id).single();
    if (!prodData) return res.status(404).json(response.error('ไม่พบสินค้านี้'));

    const bookingData = {
      booking_no,
      farmer_id: prodData.user_id,
      buyer_id: req.user.id,
      product_id,
      scheduled_time,
      license_plate,
      province,
      status: 'waiting'
    };

    const { data, error } = await supabaseAdmin.from('bookings').insert(bookingData).select().single();
    if (error) throw error;

    res.status(201).json(response.success('จองคิวสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PATCH /api/bookings/:id/checkin
 * Instant QR Check-in logic
 */
router.patch('/:id/checkin', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: buyerId } = req.user;

    if (role !== 'buyer') return res.status(403).json(response.error('เฉพาะผู้ซื้อเท่านั้นที่แสกนเช็คอินได้'));

    // Try finding by internal ID or public booking_no
    let query = supabaseAdmin.from('bookings').select('*');
    if (Number.isInteger(Number(id))) {
      query = query.eq('booking_id', id);
    } else {
      query = query.eq('booking_no', id);
    }

    const { data: booking, error: fetchErr } = await query.maybeSingle();
    if (fetchErr || !booking) return res.status(404).json(response.error('ไม่พบข้อมูลการจอง'));

    if (booking.buyer_id !== buyerId) return res.status(403).json(response.error('คุณไม่มีสิทธิ์เช็คอินรายการนี้'));
    if (booking.status !== 'waiting') return res.status(400).json(response.error(`ไม่สามารถเช็คอินได้ เนื่องจากสถานะคือ ${booking.status}`));

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'success', actual_time: new Date().toISOString() })
      .eq('booking_id', booking.booking_id)
      .select()
      .single();

    if (updErr) throw updErr;

    // Log status change
    await db.query(
      'INSERT INTO booking_status_logs (booking_id, old_status, new_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)',
      [booking.booking_id, 'waiting', 'success', buyerId, 'Instant QR Check-in by Buyer']
    ).catch(() => {});

    res.json(response.success('เช็คอินสำเร็จ! ยินดีต้อนรับเข้าสู่งาน', updated));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/bookings/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('booking_id', req.params.id)
      .eq('farmer_id', req.user.id);
    
    if (error) throw error;
    res.json(response.success('ยกเลิกการจองสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
