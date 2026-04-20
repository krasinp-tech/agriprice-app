const express = require('express');
const router = express.Router();
const response = require('../response');
const { supabaseAdmin } = require('../utils/supabase');

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
      .from('varieties')
      .select('product_name')
      .order('product_name');

    if (error) throw error;

    // Remove duplicates
    const uniqueFruits = [...new Set(data.map(item => item.product_name))].map((name, index) => ({
      id: `P${1000 + index}`,
      name: name
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
router.get('/fruit-varieties', async (req, res) => {
  try {
    const { name } = req.query; // The frontend might send name or fruit_id
    if (!name) return res.json(response.success('กรุณาระบุชื่อผลผลิต', []));

    const { data, error } = await supabaseAdmin
      .from('varieties')
      .select('variety')
      .eq('product_name', name)
      .order('variety');

    if (error) throw error;

    const result = (data || []).map((item, index) => ({
      variety_id: `V${index}`,
      name: item.variety
    }));

    res.json(response.success('ดึงข้อมูลสายพันธุ์สำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
