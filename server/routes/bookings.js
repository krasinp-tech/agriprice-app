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
    const { status } = req.query;

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        farmer:profiles!farmer_id(profile_id, first_name, last_name, phone, avatar),
        buyer:profiles!buyer_id(profile_id, first_name, last_name, phone, avatar),
        product:products(product_id, name, variety, category, unit),
        slot:product_slots(slot_id, slot_name, time_start, time_end)
      `)
      .order('scheduled_time', { ascending: false });

    if (role === 'farmer') {
      query = query.eq('farmer_id', userId);
    } else if (role === 'buyer') {
      query = query.eq('buyer_id', userId);
    }

    if (status) query = query.eq('status', status);

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
 * GET /api/bookings/:id
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    let query = supabaseAdmin
      .from('bookings')
      .select(`
        *,
        farmer:profiles!farmer_id(profile_id, first_name, last_name, phone, avatar),
        buyer:profiles!buyer_id(profile_id, first_name, last_name, phone, avatar),
        product:products(product_id, name, variety, category, unit, product_grades(grade, price)),
        slot:product_slots(slot_id, slot_name, time_start, time_end, capacity, booked_count)
      `);

    // รองรับทั้ง booking_id (number) และ booking_no (string เช่น BK-xxx)
    if (!isNaN(Number(id))) {
      query = query.eq('booking_id', id);
    } else {
      query = query.eq('booking_no', id);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json(response.error('ไม่พบข้อมูลการจอง'));

    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/bookings/:id/queue-status
 * ดึงสถานะคิวสำหรับ Farmer (ตำแหน่งในคิว, จำนวนที่รอ ฯลฯ)
 */
router.get('/:id/queue-status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // หา booking นี้ก่อน
    let query = supabaseAdmin.from('bookings').select('*, slot:product_slots(*)');
    if (!isNaN(Number(id))) {
      query = query.eq('booking_id', id);
    } else {
      query = query.eq('booking_no', id);
    }
    const { data: booking, error: bErr } = await query.maybeSingle();
    if (bErr) throw bErr;
    if (!booking) return res.status(404).json(response.error('ไม่พบข้อมูลการจอง'));

    // หาคิวที่รออยู่ก่อนหน้า (waiting และ booking_id น้อยกว่า)
    const { count: queueAhead } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', booking.slot_id)
      .eq('status', 'waiting')
      .lt('booking_id', booking.booking_id);

    res.json({
      success: true,
      data: {
        booking_id: booking.booking_id,
        booking_no: booking.booking_no,
        status: booking.status,
        queue_position: (queueAhead || 0) + 1,
        slot: booking.slot,
        scheduled_time: booking.scheduled_time,
      }
    });
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

    const { product_id, slot_id, scheduled_time, note, address } = validBody;
    
    // ดึงข้อมูลเพิ่มเติมจาก note (กรณีหน้าบ้านส่งรวมมาใน note)
    let extracted = {};
    try { 
      if (typeof note === 'string') extracted = JSON.parse(note);
      else if (typeof note === 'object') extracted = note;
    } catch(e) {}

    const final_contact_name = validBody.contact_name || extracted.contact_name || extracted.fullName || '';
    const final_contact_phone = validBody.contact_phone || extracted.contact_phone || extracted.phone || '';
    const final_product_amount = validBody.product_amount || extracted.product_amount || extracted.amount || 0;
    
    // จัดการเรื่องทะเบียนรถ (แปลงจาก Array เป็น String ถ้าจำเป็น)
    let final_plates = validBody.vehicle_plates || extracted.vehicle_plates || extracted.vehicles || '';
    if (Array.isArray(final_plates)) {
      final_plates = final_plates.map(v => typeof v === 'object' ? (v.plate || v.no) : v).filter(Boolean).join(', ');
    }
    
    const booking_no = makeBookingNo();

    // หาข้อมูล product เพื่อดึง buyer_id (เจ้าของ product คือ buyer)
    const { data: prodData } = await supabaseAdmin
      .from('products')
      .select('user_id')
      .eq('product_id', product_id)
      .single();
    if (!prodData) return res.status(404).json(response.error('ไม่พบสินค้านี้'));

    // คำนวณลำดับคิว (Sequence) อัตโนมัติภายใน Slot นั้นๆ
    let queue_no = 'Q-01';
    if (slot_id) {
      const { count } = await supabaseAdmin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('slot_id', slot_id);
      
      const sequence = (count || 0) + 1;
      queue_no = `Q-${String(sequence).padStart(2, '0')}`;
    }

    const bookingData = {
      booking_no,
      queue_no, // เพิ่มเลขคิวเข้าไปในฐานข้อมูล
      farmer_id: req.user.id,  // คนจอง = farmer
      buyer_id: prodData.user_id, // เจ้าของ product = buyer
      product_id,
      slot_id: slot_id || null,
      scheduled_time,
      note: typeof note === 'object' ? JSON.stringify(note) : note,
      address: address || null,
      contact_name: final_contact_name || null,
      contact_phone: final_contact_phone || null,
      product_amount: Number(final_product_amount || 0),
      vehicle_plates: final_plates || null,
      status: 'waiting'
    };

    const { data, error } = await supabaseAdmin.from('bookings').insert(bookingData).select().single();
    if (error) {
      console.error('❌ Supabase Booking Error:', error);
      
      // แปลง Error ของฐานข้อมูลเป็นภาษาที่เข้าใจง่าย
      let userMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      if (error.code === '23503') {
        userMessage = 'ไม่สามารถจองได้เนื่องจากสินค้าหรือรอบคิวนี้ไม่มีอยู่ในระบบแล้ว (อาจถูกแก้ไขหรือลบโดยผู้ซื้อ)';
      } else if (error.code === '23505') {
        userMessage = 'หมายเลขการจองซ้ำ กรุณาลองใหม่อีกครั้ง';
      }
      
      return res.status(400).json(response.error(userMessage, error));
    }

    // เพิ่ม booked_count ใน slot ถ้ามี slot_id
    if (slot_id) {
      await supabaseAdmin.rpc('increment_booked_count', { p_slot_id: slot_id }).catch((e) => {
          console.error('❌ RPC Error (Non-critical):', e);
      });
    }

    res.status(201).json(response.success('จองคิวสำเร็จ', data));
  } catch (e) {
    console.error('❌ Internal Server Error:', e);
    res.status(500).json(response.error('เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: ' + e.message));
  }
});

/**
 * PATCH /api/bookings/:id
 * อัปเดตสถานะการจอง
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['waiting', 'success', 'cancel'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json(response.error(`สถานะไม่ถูกต้อง (ใช้ได้: ${allowedStatuses.join(', ')})`));
    }

    const updates = {};
    if (status) updates.status = status;

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updates)
      .eq('booking_id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(response.success('อัปเดตสำเร็จ', data));
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

    let query = supabaseAdmin.from('bookings').select('*');
    if (!isNaN(Number(id))) {
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
      .update({ status: 'cancel' })
      .eq('booking_id', req.params.id);

    if (error) throw error;
    res.json(response.success('ยกเลิกการจองสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
