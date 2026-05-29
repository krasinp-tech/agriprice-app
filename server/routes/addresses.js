const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');
const response = require('../utils/response');

/**
 * GET /api/addresses
 * ดึงรายการที่อยู่ทั้งหมดของผู้ใช้
 */
router.get('/', authMiddleware, async (req, res) => {
  console.log(`[Address] GET / for user: ${req.user.id}`);
  try {
    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .select('*')
      .eq('user_id', req.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      // ถ้าไม่มีตาราง user_addresses ให้ลอง fallback หรือส่ง error
      if (error.code === 'PGRST116' || error.message.includes('relation "user_addresses" does not exist')) {
          console.warn('[Address] Table user_addresses not found, returning empty.');
          return res.json(response.success('No addresses found', []));
      }
      throw error;
    }
    res.json(response.success('รายการที่อยู่', data || []));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/addresses
 * เพิ่มที่อยู่ใหม่
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { tag, first_name, last_name, phone, address_line1, address_line2, is_default } = req.body;
    
    if (is_default) {
      await supabaseAdmin
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', req.user.id);
    }

    const newAddress = {
      user_id: req.user.id,
      tag: tag || 'Home',
      first_name,
      last_name,
      phone,
      address_line1,
      address_line2,
      is_default: !!is_default
    };

    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .insert(newAddress)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(response.success('เพิ่มที่อยู่สำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PUT /api/addresses/:id
 * อัปเดตข้อมูลที่อยู่
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { tag, first_name, last_name, phone, address_line1, address_line2, is_default } = req.body;

    if (is_default) {
      await supabaseAdmin
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', req.user.id);
    }

    const updatedAddress = {
      tag: tag || 'Home',
      first_name,
      last_name,
      phone,
      address_line1,
      address_line2,
      is_default: !!is_default
    };

    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .update(updatedAddress)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(response.success('อัปเดตที่อยู่สำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/addresses/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('user_addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json(response.success('ลบที่อยู่สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
