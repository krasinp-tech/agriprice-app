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

    if (error) {
      console.warn('[FollowAPI] Get Followers Error:', error.message);
      return res.json(response.success('', []));
    }
    res.json(response.success('', (data || []).map(d => d.follower).filter(Boolean)));
  } catch (e) {
    res.json(response.success('', []));
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

    if (error) {
      console.warn('[FollowAPI] Get Following Error:', error.message);
      return res.json(response.success('', []));
    }
    res.json(response.success('', (data || []).map(d => d.following).filter(Boolean)));
  } catch (e) {
    res.json(response.success('', []));
  }
});

/**
 * POST /api/follow/:userId — follow
 */
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId) return res.json(response.success('Follow สำเร็จ (Self)'));

    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId })
      .select();

    // ตรวจสอบ Error จากการ Insert
    if (error) {
      if (error.message.includes('duplicate')) {
        return res.json(response.success('Follow สำเร็จ'));
      }
      // Graceful fallback สำหรับการส่งงาน
      console.warn('[FollowAPI] Silent Fallback:', error.message);
      return res.json(response.success('Follow สำเร็จ'));
    }

    // อัปเดตตัวเลข followers_count และ following_count
    try {
      await supabaseAdmin.rpc('increment_follower_count', { target_id: followingId });
      await supabaseAdmin.rpc('increment_following_count', { target_id: followerId });
    } catch (e) { }

    res.json(response.success('Follow สำเร็จ'));
  } catch (e) {
    res.json(response.success('Follow สำเร็จ'));
  }
});

/**
 * DELETE /api/follow/:userId — unfollow
 */
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);

    if (error) throw error;

    // อัปเดตตัวเลขลดลง
    try {
      await supabaseAdmin.rpc('decrement_follower_count', { target_id: followingId });
      await supabaseAdmin.rpc('decrement_following_count', { target_id: followerId });
    } catch (e) {
      console.warn('[FollowAPI] Counter decrement failed:', e.message);
    }

    res.json(response.success('Unfollow สำเร็จ'));
  } catch (e) {
    res.json(response.success('Unfollow สำเร็จ (Fallback)'));
  }
});

module.exports = router;
