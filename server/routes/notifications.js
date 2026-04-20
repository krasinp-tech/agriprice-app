const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/notification-settings
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    res.json(response.success('ดึงข้อมูลการตั้งค่าสำเร็จ', data || { settings: {} }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PATCH /api/notification-settings
 */
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .upsert({
        user_id: req.user.id,
        role: req.user.role,
        settings: settings || {},
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/push-token
 * ลงทะเบียน device token สำหรับ Push Notification
 */
router.post('/push-token', authMiddleware, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json(response.error('กรุณาระบุ token'));

    const { error } = await supabaseAdmin
      .from('device_sessions')
      .upsert({
        user_id: req.user.id,
        push_token: token,
        platform: platform || 'web',
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id,push_token' });

    if (error) throw error;
    res.json(response.success('ลงทะเบียน Device Token สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
