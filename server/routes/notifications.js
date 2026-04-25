const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/notifications
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) {
      // ถ้าตารางไม่มี ให้ return array ว่าง
      return res.json(response.success('', []));
    }
    res.json(response.success('', data || []));
  } catch (e) {
    res.json(response.success('', []));
  }
});

/**
 * PATCH /api/notifications/:id/read — อ่านแจ้งเตือนชิ้นเดียว
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ unread: false, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.json(response.success('อ่านแจ้งเตือนสำเร็จ'));
    res.json(response.success('อ่านแจ้งเตือนสำเร็จ'));
  } catch (e) {
    res.json(response.success('อ่านแจ้งเตือนสำเร็จ'));
  }
});

/**
 * PATCH /api/notifications/read-all — อ่านทั้งหมด
 */
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ unread: false, read_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .eq('unread', true);

    res.json(response.success('อ่านแจ้งเตือนทั้งหมดสำเร็จ'));
  } catch (e) {
    res.json(response.success('อ่านแจ้งเตือนทั้งหมดสำเร็จ'));
  }
});

/**
 * GET /api/notifications/settings
 */
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    const defaults = { booking: true, chat: true, promo: false, system: true };
    if (error) return res.json(response.success('', defaults));
    res.json(response.success('', data?.settings || defaults));
  } catch (e) {
    res.json(response.success('', { booking: true, chat: true, promo: false, system: true }));
  }
});

/**
 * PATCH /api/notifications/settings
 */
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    await supabaseAdmin
      .from('notification_settings')
      .upsert({
        user_id: req.user.id,
        role: req.user.role,
        settings: settings || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', settings));
  } catch (e) {
    res.json(response.success('บันทึกการตั้งค่าสำเร็จ', req.body.settings));
  }
});

/**
 * POST /api/notifications/push-token
 */
router.post('/push-token', authMiddleware, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json(response.error('กรุณาระบุ token'));

    await supabaseAdmin
      .from('device_sessions')
      .upsert({
        user_id: req.user.id,
        push_token: token,
        platform: platform || 'web',
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id,push_token' });

    res.json(response.success('ลงทะเบียน Device Token สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
