const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const response = require('../utils/response');
const { supabaseAdmin } = require('../utils/supabase');

router.post('/app', authMiddleware, async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || '').trim();

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json(response.error('กรุณาระบุคะแนน 1-5'));
    }

    // ลบ review เก่าของ user นี้ (ถ้ามี) แล้ว insert ใหม่
    await supabaseAdmin
      .from('reviews')
      .delete()
      .eq('reviewer_id', req.user.id);

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: req.user.id,
        reviewer_id: req.user.id,
        rating,
        comment: comment || null,
        created_at: new Date().toISOString()
      })
      .select('id, rating, comment, created_at')
      .single();

    if (error) throw error;
    res.status(201).json(response.success('บันทึกรีวิวสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error('บันทึกรีวิวไม่สำเร็จ', e.message));
  }
});

module.exports = router;
