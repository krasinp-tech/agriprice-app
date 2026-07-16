const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');
const { normalizeOffer } = require('../utils/offers');

function getBangkokDayRangeFromDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  return {
    startOfDay: new Date(`${date}T00:00:00+07:00`).toISOString(),
    endOfDay: new Date(`${date}T23:59:59.999+07:00`).toISOString(),
  };
}

/**
 * GET /api/product-slots
 * ดึงรายการคิวของสินค้า
 * รองรับ: ?offer_id=xxx, ?product_id=xxx หรือ ?farmer_id=xxx (ดึงทุก slot ของ buyer นั้น)
 */
router.get('/', async (req, res) => {
  try {
    const { product_id, offer_id, farmer_id, date } = req.query;
    const requestedOfferId = offer_id || product_id;

    if (!requestedOfferId && !farmer_id) {
      return res.status(400).json(response.error('กรุณาระบุ offer_id/product_id หรือ farmer_id'));
    }

    let query = supabaseAdmin
      .from('offer_slots')
      .select(`
        *,
        buy_offers!offer_id(
          offer_id,
          product_id:offer_id,
          user_id,
          description,
          unit,
          image,
          is_active,
          created_at,
          updated_at,
          variety_id,
          profiles:profiles!user_id(profile_id, first_name, last_name, avatar),
          variety_ref:varieties!variety_id(
            variety_id,
            variety_name,
            product_ref:products!product_id(product_id, product_name, category)
          ),
          offer_grades!offer_id(id, grade_name, price)
        )
      `)
      .eq('is_active', true)
      .order('time_start');

    if (requestedOfferId) {
      // กรณีปกติ: ดึง slot ของ product นั้น
      query = query.eq('offer_id', requestedOfferId);
    } else if (farmer_id) {
      // กรณี farmer_id: หา products ของ buyer นั้นก่อน แล้วดึง slot
      const { data: products, error: pErr } = await supabaseAdmin
        .from('buy_offers')
        .select('offer_id')
        .eq('user_id', farmer_id)
        .eq('is_active', true);

      if (pErr) throw pErr;
      if (!products || products.length === 0) {
        return res.json(response.success('ดึงข้อมูลสำเร็จ', []));
      }
      const ids = products.map(p => p.offer_id);
      query = query.in('offer_id', ids);
    }

    // กรองตามวันที่ถ้าระบุมา
    if (date) {
      query = query.lte('start_date', date).gte('end_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    const dayRange = getBangkokDayRangeFromDate(date);

    // Dynamically calculate booked count for each slot.
    // When date is provided, capacity is per slot per Bangkok day.
    const slotsWithCount = await Promise.all((data || []).map(async (slot) => {
      let countQuery = supabaseAdmin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('slot_id', slot.slot_id)
        .neq('status', 'cancel');

      if (dayRange) {
        countQuery = countQuery
          .gte('scheduled_time', dayRange.startOfDay)
          .lte('scheduled_time', dayRange.endOfDay);
      }

      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      return {
        ...slot,
        product_id: slot.offer_id,
        buy_offers: normalizeOffer(slot.buy_offers),
        booked_count: count || 0
      };
    }));

    res.json(response.success('ดึงข้อมูลสำเร็จ', slotsWithCount));
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
    const { product_id, offer_id, start_date, end_date, rounds } = req.body;
    const requestedOfferId = offer_id || product_id;

    if (!requestedOfferId || !rounds || !Array.isArray(rounds) || rounds.length === 0) {
      return res.status(400).json(response.error('ข้อมูลไม่ครบถ้วน (ต้องการ offer_id/product_id และ rounds[])'));
    }

    // [BUG FIX] Verify ownership — prevent any user from wiping another user's slots
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('buy_offers')
      .select('user_id')
      .eq('offer_id', requestedOfferId)
      .maybeSingle();

    if (prodErr || !product) {
      return res.status(404).json(response.error('ไม่พบสินค้านี้'));
    }
    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json(response.error('คุณไม่มีสิทธิ์แก้ไขคิวของสินค้านี้'));
    }

    // เตรียมข้อมูลสำหรับการ Insert
    const slotsToInsert = rounds.map(r => ({
      offer_id: requestedOfferId,
      slot_name: r.name || 'รอบคิว',
      start_date: start_date || null,
      end_date: end_date || null,
      time_start: r.start,
      time_end: r.end,
      capacity: Number(r.capacity || 0),
      is_active: r.enabled !== false
    }));

    // แทนที่จะลบทิ้ง (ซึ่งอาจติด FK) ให้ Mark เป็น inactive ของเก่าออกก่อน
    const { error: deactivateError } = await supabaseAdmin
      .from('offer_slots')
      .update({ is_active: false })
      .eq('offer_id', requestedOfferId);
    if (deactivateError) throw deactivateError;

    // Insert คิวใหม่
    const { data, error } = await supabaseAdmin
      .from('offer_slots')
      .insert(slotsToInsert)
      .select();

    if (error) throw error;

    // Reactivate the parent buy offer if there's any active slot
    const hasActiveSlot = slotsToInsert.some(s => s.is_active);
    if (hasActiveSlot) {
      const { error: reactivateError } = await supabaseAdmin
        .from('buy_offers')
        .update({ is_active: true })
        .eq('offer_id', requestedOfferId);
      if (reactivateError) throw reactivateError;
    }

    const rows = (data || []).map((slot) => ({
      ...slot,
      product_id: slot.offer_id,
    }));
    res.status(201).json(response.success('บันทึกคิวสำเร็จ', rows));
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
    if (isNaN(Number(id))) {
      return res.status(400).json(response.error('รูปแบบ ID ไม่ถูกต้อง'));
    }

    // [BUG FIX] ตรวจสอบ ownership ของ slot
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id')
      .eq('slot_id', id)
      .maybeSingle();

    if (slotErr || !slot) {
      return res.status(404).json(response.error('ไม่พบรอบคิวนี้'));
    }

    const { data: product, error: prodErr } = await supabaseAdmin
      .from('buy_offers')
      .select('user_id')
      .eq('offer_id', slot.offer_id)
      .maybeSingle();

    if (prodErr || !product) {
      return res.status(404).json(response.error('ไม่พบสินค้านี้'));
    }

    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json(response.error('คุณไม่มีสิทธิ์แก้ไขคิวของสินค้านี้'));
    }

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
      .from('offer_slots')
      .update(updates)
      .eq('slot_id', id)
      .select()
      .single();

    if (error) throw error;

    // Reactivate parent buy offer if this slot is active
    if (data && data.is_active) {
      await supabaseAdmin
        .from('buy_offers')
        .update({ is_active: true })
        .eq('offer_id', data.offer_id);
    }

    res.json(response.success('อัปเดตคิวสำเร็จ', {
      ...data,
      product_id: data.offer_id,
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (isNaN(Number(id))) {
      return res.status(400).json(response.error('รูปแบบ ID ไม่ถูกต้อง'));
    }

    // [BUG FIX] ตรวจสอบ ownership ของ slot
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id')
      .eq('slot_id', id)
      .maybeSingle();

    if (slotErr || !slot) {
      return res.status(404).json(response.error('ไม่พบรอบคิวนี้'));
    }

    const { data: product, error: prodErr } = await supabaseAdmin
      .from('buy_offers')
      .select('user_id')
      .eq('offer_id', slot.offer_id)
      .maybeSingle();

    if (prodErr || !product) {
      return res.status(404).json(response.error('ไม่พบสินค้านี้'));
    }

    if (String(product.user_id) !== String(req.user.id)) {
      return res.status(403).json(response.error('คุณไม่มีสิทธิ์ลบคิวของสินค้านี้'));
    }

    const { error } = await supabaseAdmin
      .from('offer_slots')
      .update({ is_active: false })
      .eq('slot_id', id);

    if (error) throw error;
    res.json(response.success('ลบคิวสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
