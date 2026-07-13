const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/favorites
 * ดึงรายการผู้ใช้/ล้งที่กดติดตามไว้ (ดึงจากตาราง follows แทน user_relations เพื่อความเป็นระเบียบ)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: rels, error } = await supabaseAdmin
      .from('follows')
      .select('follower_id, following_id, created_at')
      .eq('follower_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Favorites] Supabase error:', error.message);
      return res.json(response.success('ดึงรายการโปรดสำเร็จ (ไม่มีข้อมูลเนื่องจากข้อผิดพลาด)', []));
    }

    const targetIds = (rels || []).map(r => r.following_id);
    let profilesMap = {};
    
    if (targetIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('profile_id,first_name,last_name,tagline,avatar,role')
        .in('profile_id', targetIds);
        
      if (profs) {
        profs.forEach(p => profilesMap[p.profile_id] = p);
      }
    }

    const result = (rels || []).map(fav => ({
      id: fav.following_id,
      user_id: fav.following_id,
      first_name: profilesMap[fav.following_id]?.first_name || '',
      last_name:  profilesMap[fav.following_id]?.last_name  || '',
      tagline:    profilesMap[fav.following_id]?.tagline    || '',
      avatar:     profilesMap[fav.following_id]?.avatar     || '',
      role:       profilesMap[fav.following_id]?.role       || '',
      created_at: fav.created_at,
    }));

    res.json(response.success('ดึงรายการโปรดสำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/favorites
 * เพิ่มรายการโปรด (ติดตามร้านค้า/ผู้ใช้)
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json(response.error('กรุณาระบุ user_id'));
    if (String(user_id) === String(req.user.id)) return res.status(400).json(response.error('ไม่สามารถเพิ่มตัวเองได้'));

    const { data, error } = await supabaseAdmin
      .from('follows')
      .upsert(
        { follower_id: req.user.id, following_id: user_id },
        { onConflict: 'follower_id,following_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // อัปเดตตัวเลข followers_count และ following_count เชิงสถิติ
    try {
      await supabaseAdmin.rpc('increment_follower_count', { target_id: user_id });
      await supabaseAdmin.rpc('increment_following_count', { target_id: req.user.id });
    } catch (e) {
      console.warn('[FavoritesAPI] Counter increment failed:', e.message);
    }

    // Map ฟิลด์ให้สอดคล้องกับความคาดหวังของระบบ
    const mappedData = {
      id: data.following_id,
      user_id: data.following_id,
      target_user_id: data.following_id,
      created_at: data.created_at
    };

    res.status(201).json(response.success('เพิ่มรายการโปรดสำเร็จ', mappedData));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/favorites/:targetUserId
 * ลบรายการโปรด (เลิกติดตามร้านค้า/ผู้ใช้)
 */
router.delete('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', req.user.id)
      .eq('following_id', req.params.targetUserId);

    if (error) throw error;

    // อัปเดตตัวเลขลดลง
    try {
      await supabaseAdmin.rpc('decrement_follower_count', { target_id: req.params.targetUserId });
      await supabaseAdmin.rpc('decrement_following_count', { target_id: req.user.id });
    } catch (e) {
      console.warn('[FavoritesAPI] Counter decrement failed:', e.message);
    }

    res.json(response.success('ลบรายการโปรดสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
