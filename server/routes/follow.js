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
      .select('follower_id')
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
      .select('follower:profiles!follower_id(id:profile_id, first_name, last_name, avatar, role)')
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
      .select('following:profiles!following_id(id:profile_id, first_name, last_name, avatar, role)')
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
    if (String(followerId) === String(followingId))
      return res.status(400).json(response.error('ไม่สามารถ Follow ตัวเองได้'));

    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId })
      .select();

    // ตรวจสอบ Error จากการ Insert
    if (error) {
      if (error.message.includes('duplicate')) {
        return res.json(response.success('Follow สำเร็จ'));
      }
      console.warn('[FollowAPI] Follow insert error:', error.message);
      return res.status(500).json(response.error('Follow ไม่สำเร็จ: ' + error.message));
    }

    // อัปเดตตัวเลข followers_count และ following_count
    const [followerCountResult, followingCountResult] = await Promise.all([
      supabaseAdmin.rpc('increment_follower_count', { target_id: followingId }),
      supabaseAdmin.rpc('increment_following_count', { target_id: followerId }),
    ]);
    const counterError = followerCountResult.error || followingCountResult.error;
    if (counterError) {
      console.warn('[FollowAPI] Counter increment failed:', counterError.message);
    }

    res.json(response.success('Follow สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error('Follow ไม่สำเร็จ: ' + e.message));
  }
});

/**
 * DELETE /api/follow/:userId — unfollow
 */
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
    const followerId = req.user.id;
    const followingId = req.params.userId;

    const { data: deletedRows, error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .select('follower_id');

    if (error) throw error;

    if (!deletedRows?.length) {
      return res.json(response.success('Unfollow เธชเธณเน€เธฃเนเธ'));
    }

    // อัปเดตตัวเลขลดลง
    const [followerCountResult, followingCountResult] = await Promise.all([
      supabaseAdmin.rpc('decrement_follower_count', { target_id: followingId }),
      supabaseAdmin.rpc('decrement_following_count', { target_id: followerId }),
    ]);
    const counterError = followerCountResult.error || followingCountResult.error;
    if (counterError) {
      console.warn('[FollowAPI] Counter decrement failed:', counterError.message);
    }

    res.json(response.success('Unfollow สำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error('Unfollow ไม่สำเร็จ: ' + e.message));
  }
});

module.exports = router;
