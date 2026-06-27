const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');
const response = require('../utils/response');

/* ─────────────────────────────────────────────────────────────
 *  NOTE: ระบบนี้ใช้ตาราง `profiles` เพื่อเก็บที่อยู่
 *  ฟิลด์ที่เกี่ยวข้อง: first_name, last_name, phone,
 *                      address_line1, address_line2
 *  ออกแบบให้มีที่อยู่ได้ 1 รายการต่อผู้ใช้
 * ─────────────────────────────────────────────────────────────
 */

/**
 * GET /api/addresses
 * ดึงที่อยู่จาก profiles ห่อเป็น array (max 1 item)
 */
router.get('/', authMiddleware, async (req, res) => {
  console.log('[DEBUG] GET /api/addresses called for user:', req.user.id);
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, first_name, last_name, phone, address_line1, address_line2')
      .eq('profile_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[DEBUG] Supabase error in GET /api/addresses:', error);
      throw error;
    }

    // ถ้าไม่มีข้อมูล หรือไม่มีที่อยู่เลย → ส่ง array ว่าง
    if (!data || (!data.address_line1 && !data.address_line2)) {
      return res.json(response.success('รายการที่อยู่', []));
    }

    // ห่อเป็น array 1 item เพื่อให้ client ใช้งานได้เหมือน multi-address
    const addressItem = {
      id: data.profile_id,          // ใช้ profile_id เป็น id
      user_id: data.profile_id,
      tag: 'Home',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      phone: data.phone || '',
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      is_default: true,
    };

    res.json(response.success('รายการที่อยู่', [addressItem]));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/addresses
 * เพิ่ม/อัปเดตที่อยู่ใน profiles
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, phone, address_line1, address_line2 } = req.body;

    const updates = {};
    if (first_name    !== undefined) updates.first_name    = first_name;
    if (last_name     !== undefined) updates.last_name     = last_name;
    if (phone         !== undefined) updates.phone         = phone;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;
    if (address_line2 !== undefined) updates.address_line2 = address_line2;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('profile_id', req.user.id)
      .select('profile_id, first_name, last_name, phone, address_line1, address_line2')
      .single();

    if (error) throw error;

    const addressItem = {
      id: data.profile_id,
      user_id: data.profile_id,
      tag: 'Home',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      phone: data.phone || '',
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      is_default: true,
    };

    res.status(201).json(response.success('บันทึกที่อยู่สำเร็จ', addressItem));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PATCH /api/addresses/:id
 * แก้ไขที่อยู่ — id ไม่สำคัญ (มีแค่ 1 รายการ = profile ของตัวเอง)
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { first_name, last_name, phone, address_line1, address_line2 } = req.body;

    const updates = {};
    if (first_name    !== undefined) updates.first_name    = first_name;
    if (last_name     !== undefined) updates.last_name     = last_name;
    if (phone         !== undefined) updates.phone         = phone;
    if (address_line1 !== undefined) updates.address_line1 = address_line1;
    if (address_line2 !== undefined) updates.address_line2 = address_line2;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('profile_id', req.user.id)
      .select('profile_id, first_name, last_name, phone, address_line1, address_line2')
      .single();

    if (error) throw error;

    const addressItem = {
      id: data.profile_id,
      user_id: data.profile_id,
      tag: 'Home',
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      phone: data.phone || '',
      address_line1: data.address_line1 || '',
      address_line2: data.address_line2 || '',
      is_default: true,
    };

    res.json(response.success('แก้ไขที่อยู่สำเร็จ', addressItem));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/addresses/:id
 * ลบที่อยู่ = ล้าง address_line1 และ address_line2 ใน profiles
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ address_line1: null, address_line2: null })
      .eq('profile_id', req.user.id);

    if (error) throw error;
    res.json(response.success('ลบที่อยู่สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
