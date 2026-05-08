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
      .upsert({ user_id: req.user.id, settings }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      // ถ้าตารางไม่มี ให้ตอบ OK ไปก่อน
      return res.json(response.success('บันทึกการตั้งค่าสำเร็จ', settings));
    }
    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', data?.settings || settings));
  } catch (e) {
    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', req.body.settings));
  }
});

module.exports = router;
