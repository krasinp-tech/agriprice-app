const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/favorites
 * ดึงโปรไฟล์ที่บันทึกเป็นรายการโปรด (แยกจากการติดตาม)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data: rels, error } = await supabaseAdmin
      .from('profile_favorites')
      .select('owner_id, target_profile_id, created_at')
      .eq('owner_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Favorites] Supabase error:', error.message);
      return res.json(response.success('ดึงรายการโปรดสำเร็จ (ไม่มีข้อมูลเนื่องจากข้อผิดพลาด)', []));
    }

    const targetIds = (rels || []).map(r => r.target_profile_id);
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
      id: fav.target_profile_id,
      user_id: fav.target_profile_id,
      target_user_id: fav.target_profile_id,
      first_name: profilesMap[fav.target_profile_id]?.first_name || '',
      last_name:  profilesMap[fav.target_profile_id]?.last_name  || '',
      tagline:    profilesMap[fav.target_profile_id]?.tagline    || '',
      avatar:     profilesMap[fav.target_profile_id]?.avatar     || '',
      role:       profilesMap[fav.target_profile_id]?.role       || '',
      created_at: fav.created_at,
    }));

    res.json(response.success('ดึงรายการโปรดสำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/favorites
 * เพิ่มโปรไฟล์ในรายการโปรด โดยไม่เปลี่ยนสถานะการติดตาม
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json(response.error('กรุณาระบุ user_id'));
    if (String(user_id) === String(req.user.id)) return res.status(400).json(response.error('ไม่สามารถเพิ่มตัวเองได้'));

    const { data, error } = await supabaseAdmin
      .from('profile_favorites')
      .upsert(
        { owner_id: req.user.id, target_profile_id: user_id },
        { onConflict: 'owner_id,target_profile_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Map ฟิลด์ให้สอดคล้องกับความคาดหวังของระบบ
    const mappedData = {
      id: data.target_profile_id,
      user_id: data.target_profile_id,
      target_user_id: data.target_profile_id,
      created_at: data.created_at
    };

    res.status(201).json(response.success('เพิ่มรายการโปรดสำเร็จ', mappedData));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/favorites/:targetUserId
 * ลบโปรไฟล์ออกจากรายการโปรด โดยไม่ยกเลิกการติดตาม
 */
router.delete('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('profile_favorites')
      .delete()
      .eq('owner_id', req.user.id)
      .eq('target_profile_id', req.params.targetUserId);

    if (error) throw error;

    res.json(response.success('ลบรายการโปรดสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
