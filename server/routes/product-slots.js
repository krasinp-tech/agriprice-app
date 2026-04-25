const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/product-slots
 * ดึงรายการคิวของสินค้า
 */
router.get('/', async (req, res) => {
  try {
    const { product_id } = req.query;
    if (!product_id) return res.status(400).json(response.error('กรุณาระบุ product_id'));

    const { data, error } = await supabaseAdmin
      .from('product_slots')
      .select('*')
      .eq('product_id', product_id)
      .eq('is_active', true)
      .order('time_start');

    if (error) throw error;
    res.json(response.success('ดึงข้อมูลสำเร็จ', data || []));
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
