/**
 * routes/govPrices.js
 * ดึงราคากลางสินค้าเกษตรโดยตรงจากตาราง public.gov_prices ใน Supabase
 * รองรับโครงสร้างตารางเดิม 100% (ไม่มีคอลัมน์ category และไม่มี UNIQUE constraint ใน DDL หลัก)
 */

const express = require('express');
const router  = express.Router();
const { supabaseAdmin } = require('../utils/supabase');

// ฟังก์ชันจำแนกหมวดหมู่สินค้าเกษตรแบบไดนามิกจากชื่อสินค้า (ไม่ต้องมีคอลัมน์ category ในฐานข้อมูล)
function getCategoryByCommodity(commodity) {
  if (!commodity) return 'สินค้าเกษตร';
  const name = commodity.toLowerCase();

  if (name.includes('ทุเรียน') || name.includes('มังคุด') || name.includes('มะม่วง') || name.includes('ส้ม') || name.includes('กล้วย') || name.includes('เงาะ') || name.includes('ลองกอง') || name.includes('ลำไย') || name.includes('สับปะรด') || name.includes('ลิ้นจี่') || name.includes('แตงโม')) {
    return 'ผลไม้';
  }
  if (name.includes('มะนาว') || name.includes('พริก') || name.includes('มะเขือ') || name.includes('ผัก') || name.includes('คะน้า') || name.includes('กะหล่ำ') || name.includes('หอมใหญ่') || name.includes('กระเทียม') || name.includes('แตงกวา') || name.includes('ถั่วฝักยาว') || name.includes('กวางตุ้ง')) {
    return 'ผักสด';
  }
  if (name.includes('ข้าว') || name.includes('เปลือก') || name.includes('ข้าวสาร')) {
    return 'ข้าว';
  }
  if (name.includes('มันสำปะหลัง') || name.includes('ข้าวโพด') || name.includes('อ้อย') || name.includes('ปาล์ม') || name.includes('ยางพารา') || name.includes('ถั่ว')) {
    return 'พืชไร่';
  }
  if (name.includes('ขิง') || name.includes('ข่า') || name.includes('ตะไคร้') || name.includes('ใบกะเพรา') || name.includes('กระชาย') || name.includes('สมุนไพร')) {
    return 'สมุนไพร';
  }
  if (name.includes('หมู') || name.includes('ไก่') || name.includes('เนื้อ') || name.includes('ไข่') || name.includes('เป็ด') || name.includes('ปศุสัตว์')) {
    return 'ปศุสัตว์';
  }
  return 'สินค้าเกษตร';
}

function calcStaleDays(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ─── GET /api/gov-prices ─────────────────────────────────────────────────────
// คืนรายชื่อสินค้าทั้งหมดที่มีในฐานข้อมูล Supabase (distinct)
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gov_prices')
      .select('commodity, price_date')
      .order('price_date', { ascending: false });

    if (error) throw error;

    const seen = new Map();
    for (const row of data) {
      const key = row.commodity;
      if (!key) continue;
      const prev = seen.get(key);
      if (!prev || String(row.price_date || '') > String(prev.latest_date || '')) {
        seen.set(key, {
          commodity: key,
          category: getCategoryByCommodity(key), // ดึงหมวดหมู่แบบไดนามิกแทนการคิวรีคอลัมน์ที่ไม่มี
          latest_date: row.price_date
        });
      }
    }
    const commodities = Array.from(seen.values());
    res.json({ success: true, commodities });
  } catch (e) {
    console.error('[govPrices] GET /:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /api/gov-prices/status ─────────────────────────────────────────────
// คืนสถานะสรุปของสินค้าทั้งหมด
router.get('/status', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gov_prices')
      .select('commodity, price_date')
      .order('price_date', { ascending: false });

    if (error) throw error;

    const latestByCommodity = new Map();
    for (const row of data || []) {
      const commodity = row.commodity;
      if (!commodity) continue;

      const latest = latestByCommodity.get(commodity);
      const date = row.price_date;
      if (!latest || String(date || '') > String(latest.latest_date || '')) {
        latestByCommodity.set(commodity, {
          commodity,
          category: getCategoryByCommodity(commodity),
          latest_date: date,
          row_count_on_latest_date: 1
        });
      } else if (String(date || '') === String(latest.latest_date || '')) {
        latest.row_count_on_latest_date += 1;
      }
    }

    const commodities = Array.from(latestByCommodity.values()).map(item => ({
      ...item,
      stale_days: calcStaleDays(item.latest_date)
    }));
    commodities.sort((a, b) => String(a.commodity).localeCompare(String(b.commodity)));

    const summary = {
      commodity_count: commodities.length,
      oldest_latest_date: commodities.reduce((oldest, item) => {
        if (!item.latest_date) return oldest;
        if (!oldest) return item.latest_date;
        return String(item.latest_date) < String(oldest) ? item.latest_date : oldest;
      }, null),
      max_stale_days: commodities.reduce((max, item) => Math.max(max, item.stale_days || 0), 0)
    };

    res.json({ success: true, summary, commodities });
  } catch (e) {
    console.error('[govPrices] GET /status:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:commodity', async (req, res) => {
  try {
    const commodityRaw = decodeURIComponent(req.params.commodity);
    const dateParam = req.query.date; // optional: YYYY-MM-DD
    const startDate = req.query.startDate; // optional: YYYY-MM-DD
    const endDate = req.query.endDate; // optional: YYYY-MM-DD

    // 1. Query all rows for this commodity
    const { data, error } = await supabaseAdmin
      .from('gov_prices')
      .select('*')
      .eq('commodity', commodityRaw)
      .order('price_date', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({
        success: true,
        commodity: commodityRaw,
        date: null,
        unit: null,
        rows: [],
        message: `ไม่พบข้อมูลของ "${commodityRaw}" ในฐานข้อมูล`,
      });
    }

    // 2. Filter based on date range or target date
    let filteredRows = data;
    let targetDate = dateParam;

    if (startDate && endDate) {
      filteredRows = data.filter(row => {
        const d = String(row.price_date || '');
        return d >= startDate && d <= endDate;
      });
      targetDate = filteredRows.reduce((latest, row) => {
        return !latest || String(row.price_date || '') > String(latest) ? row.price_date : latest;
      }, null);
    } else {
      if (!targetDate) {
        targetDate = data.reduce((latest, row) => {
          return !latest || String(row.price_date || '') > String(latest) ? row.price_date : latest;
        }, null);
      }
      filteredRows = data.filter(row => row.price_date === targetDate);
    }

    if (filteredRows.length === 0) {
      return res.json({
        success: true,
        commodity: commodityRaw,
        date: targetDate || startDate,
        unit: data[0]?.unit || 'กก.',
        rows: [],
        message: `ไม่มีการบันทึกราคากลางในช่วงเวลาที่เลือก`,
      });
    }

    const firstRow = filteredRows[0];
    const rows = filteredRows.map(r => ({
      variety: r.variety || `${commodityRaw} (คละ)`,
      min: Number(r.min_price || 0),
      max: Number(r.max_price || 0),
      avg: Number(r.avg_price || 0),
      date: r.price_date
    }));

    res.json({
      success: true,
      commodity: commodityRaw,
      date: targetDate || firstRow.price_date,
      unit: firstRow?.unit || 'กก.',
      source: 'supabase-db',
      updated_at: targetDate ? `${targetDate}T00:00:00.000Z` : null,
      rows,
    });
  } catch (e) {
    console.error(`[govPrices] GET /${req.params.commodity}:`, e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
