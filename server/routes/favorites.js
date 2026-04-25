const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/favorites
 * ดึงรายการผู้ใช้/สินค้าที่บันทึกไว้
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .select('relation_id, target_user_id, created_at, profiles!target_user_id(profile_id,first_name,last_name,tagline,avatar,role)')
      .eq('relation_type', 'favorite')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data || []).map(fav => ({
      id: fav.relation_id,
      user_id: fav.target_user_id,
      first_name: fav.profiles?.first_name || '',
      last_name:  fav.profiles?.last_name  || '',
      tagline:    fav.profiles?.tagline    || '',
      avatar:     fav.profiles?.avatar     || '',
      role:       fav.profiles?.role       || '',
      created_at: fav.created_at,
    }));

    res.json(response.success('ดึงรายการโปรดสำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/favorites
 * เพิ่มรายการโปรด
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json(response.error('กรุณาระบุ user_id'));
    if (user_id === req.user.id) return res.status(400).json(response.error('ไม่สามารถเพิ่มตัวเองได้'));

    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .upsert(
        { relation_type: 'favorite', user_id: req.user.id, target_user_id: user_id },
        { onConflict: 'relation_type,user_id,target_user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(response.success('เพิ่มรายการโปรดสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/favorites/:targetUserId
 * ลบรายการโปรด
 */
router.delete('/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('user_relations')
      .delete()
      .eq('relation_type', 'favorite')
      .eq('user_id', req.user.id)
      .eq('target_user_id', req.params.targetUserId);

    if (error) throw error;
    res.json(response.success('ลบรายการโปรดสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
