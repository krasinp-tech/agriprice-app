const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/notification-settings
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    // ค่า default ถ้ายังไม่มีในฐานข้อมูล
    const defaults = {
      booking: true,
      chat: true,
      promo: false,
      system: true,
    };

    res.json(response.success('', data?.settings || defaults));
  } catch (e) {
    // graceful — return defaults เสมอเพื่อไม่ให้ UI พัง
    res.json(response.success('', { booking: true, chat: true, promo: false, system: true }));
  }
});

/**
 * PATCH /api/notification-settings
 */
router.patch('/', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) return res.status(400).json(response.error('ต้องส่ง settings'));

    // upsert
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .upsert({ user_id: req.user.id, settings, role: req.user.role || 'guest' }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json(response.error('บันทึกการตั้งค่าไม่สำเร็จ', error.message));
    }
    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', data?.settings || settings));
  } catch (e) {
    res.status(500).json(response.error('บันทึกการตั้งค่าไม่สำเร็จ', e.message));
  }
});

module.exports = router;
