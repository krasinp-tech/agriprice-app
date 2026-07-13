const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const { supabaseAdmin } = require('../utils/supabase');

async function findProductsByNameOrId(productKey) {
  const key = String(productKey || '').trim();
  if (!key) return [];

  const queries = [
    supabaseAdmin
      .from('products')
      .select('product_id')
      .ilike('product_name', `%${key}%`)
  ];

  const numericId = Number(key);
  if (Number.isInteger(numericId) && numericId > 0) {
    queries.push(
      supabaseAdmin
        .from('products')
        .select('product_id')
        .eq('product_id', numericId)
    );
  }

  const results = await Promise.all(queries);
  const seen = new Set();
  const products = [];
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data || []) {
      if (!seen.has(row.product_id)) {
        seen.add(row.product_id);
        products.push(row);
      }
    }
  }
  return products;
}

/**
 * GET /api/categories
 * ดึงรายการหมวดหมู่ผลผลิต
 */
router.get('/categories', async (req, res) => {
  try {
    // In this DB, category is often stored in 'products' or we can derive it from 'varieties'
    // For now, we provide the standard fixed categories used in the app
    const categories = [
      { id: 'fruit', name: 'ผลไม้', icon: '🍎' },
      { id: 'vegetable', name: 'ผักสด', icon: '🥬' },
      { id: 'rubber', name: 'ยางพารา', icon: '🪵' },
      { id: 'palm', name: 'ปาล์มน้ำมัน', icon: '🌴' }
    ];
    res.json(response.success('ดึงข้อมูลหมวดหมู่สำเร็จ', categories));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/fruits
 * ดึงรายการผลผลิตจากตาราง varieties
 */
router.get('/fruits', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('product_id, product_name')
      .order('product_name');

    if (error) throw error;

    // Remove duplicates
    const uniqueFruits = (data || []).map((item) => ({
      id: String(item.product_id),
      name: item.product_name
    }));

    res.json(response.success('ดึงข้อมูลผลผลิตสำเร็จ', uniqueFruits));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/fruit-varieties
 * ดึงรายการสายพันธุ์สำหรับผลผลิตที่ระบุ
 */
router.get('/product-types', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('product_id, product_name, category')
      .order('product_name');

    if (error) throw error;

    const result = (data || []).map((item) => ({
      id: String(item.product_id),
      product_id: String(item.product_id),
      fruit_id: String(item.product_id),
      name: item.product_name,
      product_name: item.product_name,
      category: item.category,
    }));

    res.json(response.success('OK', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.get('/fruit-varieties', async (req, res) => {
  try {
    const { name, fruit_id } = req.query;
    const productName = (name || fruit_id || '').trim();
    
    if (!productName) return res.json(response.success('กรุณาระบุชื่อผลผลิต', []));

    const products = await findProductsByNameOrId(productName);

    const productIds = (products || []).map((item) => item.product_id);
    if (productIds.length === 0) {
      return res.json(response.success('ดึงข้อมูลสายพันธุ์สำเร็จ', []));
    }

    const { data, error } = await supabaseAdmin
      .from('varieties')
      .select('variety_id, variety_name')
      .in('product_id', productIds)
      .order('variety_name');

    if (error) throw error;

    const result = (data || []).map((item) => ({
      variety_id: String(item.variety_id),
      name: item.variety_name
    }));

    res.json(response.success('ดึงข้อมูลสายพันธุ์สำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.get('/varieties', async (req, res) => {
  try {
    const { name, fruit_id, product_id, q } = req.query;
    const productKey = String(product_id || fruit_id || name || '').trim();
    const search = String(q || '').trim();

    let query = supabaseAdmin
      .from('varieties')
      .select('variety_id, variety_name, product_id')
      .order('variety_name');

    if (productKey) {
      const products = await findProductsByNameOrId(productKey);

      const productIds = (products || []).map((item) => item.product_id);
      if (productIds.length === 0) return res.json(response.success('OK', []));
      query = query.in('product_id', productIds);
    }

    if (search) query = query.ilike('variety_name', `%${search}%`);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    const result = (data || []).map((item) => ({
      id: String(item.variety_id),
      variety_id: String(item.variety_id),
      name: item.variety_name,
      variety: item.variety_name,
      product_id: String(item.product_id),
    }));

    res.json(response.success('OK', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
