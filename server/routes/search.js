const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * GET /api/search?q=...
 * ค้นหาสินค้า (products) และผู้ใช้ (profiles)
 */
router.get('/', async (req, res) => {
  try {
    const { q = '' } = req.query;
    // [FIXED #1] จำกัด limit ไม่ให้เกิน 50 และต้องเป็นตัวเลขบวก ป้องกัน scraping / server overload
    const safeLimit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 50);
    const term = q.trim();

    let prodQuery = supabaseAdmin
      .from('products')
      .select('product_id, user_id, name, variety, category, unit, price, image, is_active, created_at, profiles!user_id(first_name, last_name, avatar, lat, lng), product_grades(grade, price)')
      .eq('is_active', true)
      .limit(safeLimit);

    let userQuery = supabaseAdmin
      .from('profiles')
      .select('id:profile_id, first_name, last_name, avatar, role, lat, lng, address_line2')
      .limit(safeLimit);

    if (term) {
      prodQuery = prodQuery.or(`name.ilike.%${term}%,variety.ilike.%${term}%,category.ilike.%${term}%`);
      userQuery = userQuery.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
    }

    const [prodRes, userRes] = await Promise.all([prodQuery, userQuery]);

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