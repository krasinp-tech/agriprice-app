/**
 * routes/govPrices.js
 * GET /api/gov-prices            → รายชื่อสินค้าทั้งหมดที่มีในฐาน
 * GET /api/gov-prices/:commodity → ราคาล่าสุดของสินค้านั้น
 *                                  ?date=YYYY-MM-DD  (optional, default = วันล่าสุด)
 *
 * ตาราง Supabase: gov_prices
 *   commodity | variety | unit | min_price | max_price | avg_price | price_date | source
 */

const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const COMMODITY_ALIASES = {
  durian: ['durian', 'ทุเรียน'],
  longkong: ['longkong', 'ลองกอง'],
  mangosteen: ['mangosteen', 'มังคุด'],
  rambutan: ['rambutan', 'เงาะ'],
  palm: ['palm', 'ปาล์ม', 'ปาล์มน้ำมัน'],
  rubber: ['rubber', 'ยางพารา'],
  vegetable: ['vegetable', 'ผักสด'],
  seed: ['seed', 'เมล็ดพันธุ์', 'เมล็ดพันธ์ุ'],
  ornamental: ['ornamental', 'ไม้ประดับ'],
  herb: ['herb', 'สมุนไพร'],
};

function normalizeCommodity(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const rawLower = raw.toLowerCase();
  for (const [key, aliases] of Object.entries(COMMODITY_ALIASES)) {
    if (key === rawLower) return key;
    if (aliases.some((a) => String(a).toLowerCase() === rawLower)) return key;
  }
  return rawLower;
}

function aliasesForCommodity(input) {
  const key = normalizeCommodity(input);
  return COMMODITY_ALIASES[key] || [String(input || '').trim()];
}

function calcStaleDays(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ─── GET /api/gov-prices ─────────────────────────────────────────────────────
// คืนรายชื่อสินค้าทั้งหมดที่มีในฐานข้อมูล (distinct)
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gov_prices')
      .select('commodity, price_date')
      .order('price_date', { ascending: false });

    if (error) throw error;

    // distinct commodity พร้อมวันที่ล่าสุด
    const seen = new Map();
    for (const row of (data || [])) {
      const normalized = normalizeCommodity(row.commodity);
      const prev = seen.get(normalized);
      if (!prev || String(row.price_date || '') > String(prev || '')) {
        seen.set(normalized, row.price_date);
      }
    }

    const commodities = [...seen.entries()].map(([commodity, latest_date]) => ({
      commodity,
      latest_date,
    }));

    res.json({ success: true, commodities });
  } catch (e) {
    console.error('[govPrices] GET /:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /api/gov-prices/status ────────────────────────────────────────────
// สรุปสถานะข้อมูลล่าสุดของแต่ละสินค้า (วันล่าสุด, ความเก่าเป็นวัน, จำนวนแถววันล่าสุด)
router.get('/status', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gov_prices')
      .select('commodity, price_date')
      .order('price_date', { ascending: false });

    if (error) throw error;

    const latestByCommodity = new Map();
    for (const row of (data || [])) {
      const key = normalizeCommodity(row.commodity);
      const prev = latestByCommodity.get(key);
      if (!prev || String(row.price_date || '') > String(prev.latest_date || '')) {
        latestByCommodity.set(key, { latest_date: row.price_date, row_count_on_latest_date: 1 });
      } else if (String(row.price_date || '') === String(prev.latest_date || '')) {
        prev.row_count_on_latest_date += 1;
      }
    }

    const commodities = [...latestByCommodity.entries()].map(([commodity, info]) => ({
      commodity,
      latest_date: info.latest_date,
      stale_days: calcStaleDays(info.latest_date),
      row_count_on_latest_date: info.row_count_on_latest_date,
    }));

    commodities.sort((a, b) => String(a.commodity).localeCompare(String(b.commodity)));

    const maxStaleDays = commodities.reduce((max, c) => Math.max(max, c.stale_days || 0), 0);
    const minLatestDate = commodities.reduce((min, c) => {
      if (!c.latest_date) return min;
      if (!min) return c.latest_date;
      return String(c.latest_date) < String(min) ? c.latest_date : min;
    }, null);

    res.json({
      success: true,
      summary: {
        commodity_count: commodities.length,
        oldest_latest_date: minLatestDate,
        max_stale_days: maxStaleDays,
      },
      commodities,
    });
  } catch (e) {
    console.error('[govPrices] GET /status:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── GET /api/gov-prices/:commodity ─────────────────────────────────────────
// คืนราคาล่าสุด (หรือตามวันที่ที่ระบุ) ของสินค้านั้น
router.get('/:commodity', async (req, res) => {
  try {
    const commodityRaw = decodeURIComponent(req.params.commodity);
    const commodity = normalizeCommodity(commodityRaw);
    const commodityAliases = aliasesForCommodity(commodityRaw);
    const dateParam = req.query.date; // optional: YYYY-MM-DD

    let query = supabaseAdmin
      .from('gov_prices')
      .select('commodity, variety, unit, min_price, max_price, avg_price, price_date, source, created_at')
      .in('commodity', commodityAliases)
      .order('price_date', { ascending: false });

    if (dateParam) {
      // ถ้าระบุวัน ดึงเฉพาะวันนั้น
      query = query.eq('price_date', dateParam);
    } else {
      // ดึงวันล่าสุด: หาวันล่าสุดก่อน แล้วค่อย filter
      const { data: latestRow, error: latestErr } = await supabaseAdmin
        .from('gov_prices')
        .select('price_date')
        .in('commodity', commodityAliases)
        .order('price_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) throw latestErr;
      if (!latestRow) {
        return res.json({
          success: true,
          commodity,
          date: null,
          unit: null,
          rows: [],
          message: `ไม่พบข้อมูลของ "${commodity}"`,
        });
      }

      query = query.eq('price_date', latestRow.price_date);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []).map(r => ({
      variety:   r.variety  || `${commodity} (คละ)`,
      min:       r.min_price,
      max:       r.max_price,
      avg:       r.avg_price,
    }));

    // unit + date จากแถวแรก (ทุกแถวของสินค้าเดียวกันใช้ unit เดียว)
    const firstRow = data?.[0];
    const latestCreatedAt = (data || []).reduce((max, row) => {
      const curr = row?.created_at ? String(row.created_at) : '';
      if (!curr) return max;
      return !max || curr > max ? curr : max;
    }, null);

    res.json({
      success:   true,
      commodity,
      date:      firstRow?.price_date  || null,
      unit:      firstRow?.unit        || 'กก.',
      source:    firstRow?.source      || 'dit.go.th',
      updated_at: latestCreatedAt,
      rows,
    });
  } catch (e) {
    console.error(`[govPrices] GET /${req.params.commodity}:`, e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
