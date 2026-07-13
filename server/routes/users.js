const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/users/search?q=...&limit=20
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q = '', limit = 20 } = req.query;
    const term = String(q || '').trim();
    if (!term) return res.json(response.success('', []));

    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);
    const select = 'id:profile_id, first_name, last_name, avatar, role, address_line2';
    const [firstNameRes, lastNameRes] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select(select)
        .ilike('first_name', `%${term}%`)
        .neq('profile_id', req.user.id)
        .limit(safeLimit),
      supabaseAdmin
        .from('profiles')
        .select(select)
        .ilike('last_name', `%${term}%`)
        .neq('profile_id', req.user.id)
        .limit(safeLimit),
    ]);

    if (firstNameRes.error) throw firstNameRes.error;
    if (lastNameRes.error) throw lastNameRes.error;

    const seen = new Set();
    const data = [...(firstNameRes.data || []), ...(lastNameRes.data || [])]
      .filter((row) => {
        const id = row.id || row.profile_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, safeLimit);

    res.json(response.success('OK', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
