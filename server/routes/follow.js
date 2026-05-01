const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/follow/:userId/status — เช็คว่า follow อยู่หรือเปล่า
 */
router.get('/:userId/status', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // ถ้าตารางไม่มี ให้ตอบ false ไปก่อน (graceful)
      return res.json(response.success('', { following: false }));
    }
    res.json(response.success('', { following: !!data }));
  } catch (e) {
    res.json(response.success('', { following: false }));
  }
});

/**
 * GET /api/follow/:userId/followers — รายชื่อ followers
 */
router.get('/:userId/followers', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('follower:profiles!follower_id(id, first_name, last_name, avatar, role)')
      .eq('following_id', req.params.userId);

    if (error) throw error;
    res.json(response.success('', (data || []).map(d => d.follower)));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/follow/:userId/following — รายชื่อที่ follow อยู่
 */
router.get('/:userId/following', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('follows')
      .select('following:profiles!following_id(id, first_name, last_name, avatar, role)')
      .eq('follower_id', req.params.userId);

    if (error) throw error;
    res.json(response.success('', (data || []).map(d => d.following)));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/follow/:userId — follow
 */
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId) return res.status(400).json(response.error('ไม่สามารถ follow ตัวเองได้'));

    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId })
      .select();

    // ignore duplicate
    if (error && !error.message.includes('duplicate')) throw error;
    res.json(response.success('Follow สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/follow/:userId — unfollow
 */
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', req.user.id)
      .eq('following_id', req.params.userId);

    if (error) throw error;
    res.json(response.success('Unfollow สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
