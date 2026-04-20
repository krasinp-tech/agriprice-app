const express = require('express');
const router = express.Router();
const response = require('../response');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { supabaseAdmin } = require('../utils/supabase');
const { getOptionalAuthUser } = require('../utils/helpers');
const { saveFile } = require('../services/fileService');

/**
 * GET /api/products
 */
router.get('/', async (req, res) => {
  try {
    const { q, user_id, category, page = 1, limit = 20 } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabaseAdmin
      .from('products')
      .select(
        'product_id, name, variety, grade, price, category, unit, image, is_active, created_at, updated_at, user_id, ' +
        'product_grades(grade, price), ' +
        'profiles!user_id(first_name, last_name, phone, avatar)',
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (user_id) query = query.eq('user_id', user_id);
    if (category) query = query.eq('category', category);

    // --- SMART SEARCH (q) ---
    if (q) {
      // Check if q looks like a date (e.g., 2026-04-16, 16-04-2026, 16/04/2026)
      const dateMatch = q.match(/^(\d{4}-\d{2}-\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})$/);
      if (dateMatch) {
        let dateObj = new Date(q);
        // Fallback for Thai/Alt formats if simple Date() fails
        if (isNaN(dateObj.getTime())) {
          const parts = q.split(/[-/]/);
          if (parts.length === 3) {
            // Assume DD-MM-YYYY or DD-MM-YY
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
            dateObj = new Date(y, m, d);
          }
        }

        if (!isNaN(dateObj.getTime())) {
          const start = new Date(dateObj).toISOString();
          const end = new Date(dateObj.setDate(dateObj.getDate() + 1)).toISOString();
          query = query.gte('created_at', start).lt('created_at', end);
        } else {
          // Fallback to text search if date parsing failed
          query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,variety.ilike.%${q}%`);
        }
      } else {
        // Normal text search across multiples fields
        query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,variety.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/products
 */
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { name, category, variety, price, grade, unit, grades } = req.body;
    if (!name || !price) return res.status(400).json(response.error('กรุณาระบุชื่อและราคาโปรโมชัน'));

    const updates = {
      user_id: req.user.id,
      name,
      category,
      variety,
      price: Number(price),
      grade: grade || 'คละ',
      unit: unit || 'กก.',
      is_active: true
    };

    if (req.file) {
      updates.image = await saveFile(req.file, 'products');
    }

    const { data, error } = await supabaseAdmin.from('products').insert(updates).select().single();
    if (error) throw error;

    // Insert grades if provided
    if (grades && Array.isArray(JSON.parse(grades))) {
      const gradesArr = JSON.parse(grades).map(g => ({
        product_id: data.product_id,
        grade: g.grade,
        price: Number(g.price)
      }));
      await supabaseAdmin.from('product_grades').insert(gradesArr);
    }

    res.status(201).json(response.success('เพิ่มรายการสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * PATCH /api/products/:id
 */
router.patch('/:id', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, category, variety, price, grade, unit, grades, is_active } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (variety !== undefined) updates.variety = variety;
    if (price !== undefined) updates.price = Number(price);
    if (grade !== undefined) updates.grade = grade;
    if (unit !== undefined) updates.unit = unit;
    if (is_active !== undefined) updates.is_active = is_active === 'true' || is_active === true;

    if (req.file) {
      updates.image = await saveFile(req.file, 'products');
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('product_id', productId)
      .eq('user_id', req.user.id) // Ensure ownership
      .select()
      .single();

    if (error) throw error;

    if (grades) {
      const gradesArr = JSON.parse(grades);
      // Simple sync: delete all and re-insert
      await supabaseAdmin.from('product_grades').delete().eq('product_id', productId);
      await supabaseAdmin.from('product_grades').insert(
        gradesArr.map(g => ({ product_id: productId, grade: g.grade, price: Number(g.price) }))
      );
    }

    res.json(response.success('อัปเดตรายการสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false })
      .eq('product_id', req.params.id)
      .eq('user_id', req.user.id);
    
    if (error) throw error;
    res.json(response.success('ลบรายการสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
