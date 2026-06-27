const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

async function updateReadByAnyId(userId, notificationId) {
  // Try modern key first.
  let result = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .select('notification_id');

  if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
    return { updated: true };
  }

  // Fallback for legacy schema.
  result = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id');

  if (result.error) return { error: result.error };
  return { updated: Array.isArray(result.data) && result.data.length > 0 };
}

async function deleteByAnyId(userId, notificationId) {
  // Try modern key first.
  let result = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .select('notification_id');

  if (!result.error && Array.isArray(result.data) && result.data.length > 0) {
    return { deleted: true };
  }

  // Fallback for legacy schema.
  result = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select('id');

  if (result.error) return { error: result.error };
  return { deleted: Array.isArray(result.data) && result.data.length > 0 };
}

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

    if (error) return res.status(500).json(response.error('โหลดแจ้งเตือนไม่สำเร็จ', error.message));
    res.json(response.success('', data || []));
  } catch (e) {
    res.status(500).json(response.error('โหลดแจ้งเตือนไม่สำเร็จ', e.message));
  }
});

// ============================================================
// [BUG FIX] Static routes MUST be declared BEFORE /:id
// Otherwise Express matches "read-all", "settings", "push-token"
// as the :id parameter and calls the wrong handler.
// ============================================================

/**
 * PATCH /api/notifications/read-all — อ่านทั้งหมด
 */
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);
    if (error) return res.status(500).json(response.error('อ่านแจ้งเตือนทั้งหมดไม่สำเร็จ', error.message));

    res.json(response.success('อ่านแจ้งเตือนทั้งหมดสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error('อ่านแจ้งเตือนทั้งหมดไม่สำเร็จ', e.message));
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

/**
 * PATCH /api/notifications/:id/read — อ่านแจ้งเตือนชิ้นเดียว
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const result = await updateReadByAnyId(req.user.id, req.params.id);
    if (result.error) return res.status(500).json(response.error('อ่านแจ้งเตือนไม่สำเร็จ', result.error.message));
    if (!result.updated) return res.status(404).json(response.error('ไม่พบแจ้งเตือนรายการนี้'));
    res.json(response.success('อ่านแจ้งเตือนสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error('อ่านแจ้งเตือนไม่สำเร็จ', e.message));
  }
});

/**
 * DELETE /api/notifications/:id — ลบแจ้งเตือนรายการเดียว
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await deleteByAnyId(req.user.id, req.params.id);
    if (result.error) return res.status(500).json(response.error('ลบแจ้งเตือนไม่สำเร็จ', result.error.message));
    if (!result.deleted) return res.status(404).json(response.error('ไม่พบแจ้งเตือนรายการนี้'));
    res.json(response.success('ลบแจ้งเตือนสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error('ลบแจ้งเตือนไม่สำเร็จ', e.message));
  }
});

module.exports = router;
