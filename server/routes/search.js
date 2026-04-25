const express = require('express');
const router = express.Router();
const response = require('../response');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/search?q=...
 * ค้นหาสินค้า (products) และผู้ใช้ (profiles)
 */
router.get('/', async (req, res) => {
  try {
    const { q = '', limit = 20 } = req.query;
    if (!q.trim()) return res.json(response.success('ผลการค้นหา', { products: [], users: [] }));

    const term = q.trim();

    const [prodRes, userRes] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('product_id, name, variety, category, unit, image, is_active, profiles!user_id(first_name, last_name, avatar)')
        .eq('is_active', true)
        .or(`name.ilike.%${term}%,variety.ilike.%${term}%,category.ilike.%${term}%`)
        .limit(Number(limit)),

      supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, avatar, role, province')
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,province.ilike.%${term}%`)
        .limit(Number(limit)),
    ]);

    if (prodRes.error) throw prodRes.error;
    if (userRes.error) throw userRes.error;

    res.json(response.success('ผลการค้นหา', {
      products: prodRes.data || [],
      users: userRes.data || [],
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
