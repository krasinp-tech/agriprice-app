const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/users/search?q=...&limit=20
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q = '', limit = 20 } = req.query;
    if (!q.trim()) return res.json(response.success('', []));

    const term = q.trim();
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, avatar, role, province')
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
      .neq('id', req.user.id)
      .limit(Number(limit));

    if (error) throw error;
    res.json(response.success('ผลการค้นหา', data || []));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
