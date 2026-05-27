const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

function toBangkokDayRange(date) {
  const startLocal = new Date(`${date}T00:00:00+07:00`);
  const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
  return {
    startUtc: startLocal.toISOString(),
    endUtc: endLocal.toISOString(),
  };
}

/**
 * GET /api/product-slots
 * ดึงรายการคิวของสินค้า
 * รองรับ: ?product_id=xxx  หรือ  ?farmer_id=xxx (ดึงทุก slot ของ buyer นั้น)
 */
router.get('/', async (req, res) => {
  try {
    const { product_id, farmer_id, date } = req.query;

    if (!product_id && !farmer_id) {
      return res.status(400).json(response.error('กรุณาระบุ product_id หรือ farmer_id'));
    }

    let query = supabaseAdmin
      .from('product_slots')
      .select('*, products!product_id(product_id, name, variety, user_id)')
      .eq('is_active', true)
      .order('time_start');

    if (product_id) {
      // กรณีปกติ: ดึง slot ของ product นั้น
      query = query.eq('product_id', product_id);
    } else if (farmer_id) {
      // กรณี farmer_id: หา products ของ buyer นั้นก่อน แล้วดึง slot
      const { data: products, error: pErr } = await supabaseAdmin
        .from('products')
        .select('product_id')
        .eq('user_id', farmer_id)
        .eq('is_active', true);

      if (pErr) throw pErr;
      if (!products || products.length === 0) {
        return res.json(response.success('ดึงข้อมูลสำเร็จ', []));
      }
      const ids = products.map(p => p.product_id);
      query = query.in('product_id', ids);
    }

    // กรองตามวันที่ถ้าระบุมา
    if (date) {
      query = query.lte('start_date', date).gte('end_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    let slots = data || [];
    if (date && slots.length > 0) {
      const slotIds = slots.map(s => s.slot_id).filter(Boolean);
      if (slotIds.length > 0) {
        const { startUtc, endUtc } = toBangkokDayRange(date);
        const { data: bookings, error: bookingErr } = await supabaseAdmin
          .from('bookings')
          .select('slot_id')
          .in('slot_id', slotIds)
          .eq('status', 'waiting')
          .gte('scheduled_time', startUtc)
          .lt('scheduled_time', endUtc);

        if (bookingErr) throw bookingErr;

        const counts = bookings.reduce((acc, booking) => {
          if (!booking || !booking.slot_id) return acc;
          acc[booking.slot_id] = (acc[booking.slot_id] || 0) + 1;
          return acc;
        }, {});

        slots = slots.map((slot) => ({
          ...slot,
          booked_count: counts[slot.slot_id] || 0,
        }));
      }
    }

    res.json(response.success('ดึงข้อมูลสำเร็จ', slots));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/product-slots/batch
 * บันทึกคิวแบบหลายรายการ (Batch)
 * ต้องมาก่อน /:id routes
 */
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { product_id, start_date, end_date, rounds } = req.body;

    if (!product_id || !rounds || !Array.isArray(rounds)) {
      return res.status(400).json(response.error('ข้อมูลไม่ครบถ้วน (ต้องการ product_id และ rounds[])'));
    }

    // เตรียมข้อมูลสำหรับการ Insert
    const slotsToInsert = rounds.map(r => ({
      product_id,
      slot_name: r.name || 'รอบคิว',
      start_date: start_date || null,
      end_date: end_date || null,
      time_start: r.start,
      time_end: r.end,
      capacity: Number(r.capacity || 0),
      is_active: r.enabled !== false,
      booked_count: 0
    }));

    // แทนที่จะลบทิ้ง (ซึ่งอาจติด FK) ให้ Mark เป็น inactive ของเก่าออกก่อน
    await supabaseAdmin
      .from('product_slots')
      .update({ is_active: false })
      .eq('product_id', product_id);

    // Insert คิวใหม่
    const { data, error } = await supabaseAdmin
      .from('product_slots')
      .insert(slotsToInsert)
      .select();

    if (error) throw error;

    res.status(201).json(response.success('บันทึกคิวสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PATCH /api/product-slots/:id
 * อัปเดตข้อมูลคิวเดี่ยว
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { slot_name, time_start, time_end, capacity, is_active, start_date, end_date } = req.body;

    const updates = {};
    if (slot_name !== undefined) updates.slot_name = slot_name;
    if (time_start !== undefined) updates.time_start = time_start;
    if (time_end !== undefined) updates.time_end = time_end;
    if (capacity !== undefined) updates.capacity = Number(capacity);
    if (is_active !== undefined) updates.is_active = is_active === true || is_active === 'true';
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;

    const { data, error } = await supabaseAdmin
      .from('product_slots')
      .update(updates)
      .eq('slot_id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(response.success('อัปเดตคิวสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/product-slots/:id
 * ลบคิวเดี่ยว (soft delete)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('product_slots')
      .update({ is_active: false })
      .eq('slot_id', id);

    if (error) throw error;
    res.json(response.success('ลบคิวสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
