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
      .select('product_id, user_id, name, variety, category, unit, price, grade, image, is_active, created_at, profiles!user_id(first_name, last_name, avatar, lat, lng)')
      .eq('is_active', true)
      .limit(safeLimit);

    let userQuery = supabaseAdmin
      .from('profiles')
      .select('id:profile_id, first_name, last_name, avatar, role, lat, lng, address_line2')
      .limit(safeLimit);

    if (term) {
      prodQuery = prodQuery.or(`name.ilike.%${term}%,variety.ilike.%${term}%,category.ilike.%${term}%`);
      
      const parts = term.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        userQuery = userQuery.or(`first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts[0]}%`);
      } else {
        const firstPart = parts[0];
        const lastPart = parts.slice(1).join(' ');
        userQuery = userQuery.or(`and(first_name.ilike.%${firstPart}%,last_name.ilike.%${lastPart}%),and(first_name.ilike.%${lastPart}%,last_name.ilike.%${firstPart}%)`);
      }
    }

    const [prodRes, userRes] = await Promise.all([prodQuery, userQuery]);

    if (prodRes.error) throw prodRes.error;
    if (userRes.error) throw userRes.error;

    // ดึง products ของ users ที่ค้นหาพบมา embed ในแต่ละ user object
    const users = userRes.data || [];
    if (users.length > 0) {
      const userIds = users.map(u => u.id).filter(Boolean);
      const { data: userProducts } = await supabaseAdmin
        .from('products')
        .select('product_id, user_id, name, variety, price, grade, unit, is_active')
        .in('user_id', userIds)
        .eq('is_active', true)
        .limit(100);

      const productsByUser = {};
      (userProducts || []).forEach(p => {
        if (!productsByUser[p.user_id]) productsByUser[p.user_id] = [];
        productsByUser[p.user_id].push(p);
      });

      users.forEach(u => {
        u.products = productsByUser[u.id] || [];
      });
    }

    res.json(response.success('ผลการค้นหา', {
      products: prodRes.data || [],
      users,
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;