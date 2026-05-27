const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * POST /api/presence/ping
 * อัปเดต last_seen ของผู้ใช้ปัจจุบัน
 */
router.post('/ping', authMiddleware, async (req, res) => {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('profile_id', req.user.id); // schema uses 'profile_id' as primary key
    res.json(response.success('Ping สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/presence/:userId
 * ตรวจสอบว่าผู้ใช้ออนไลน์ไหม (last_seen < 2 นาทีถือว่าออนไลน์)
 */
router.get('/:userId', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('last_seen')
      .eq('profile_id', req.params.userId)
      .single();

    if (error) throw error;
    
    const isOnline = data?.last_seen
      ? (Date.now() - new Date(data.last_seen).getTime()) < 2 * 60 * 1000
      : false;

    res.json({ online: isOnline, last_seen: data?.last_seen || null });
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
