/**
 * routes/govPrices.js
 * GET /api/gov-prices            → รายชื่อสินค้าทั้งหมดที่มีในฐาน (ดึงจาก Excel)
 * GET /api/gov-prices/status     → สถานะราคากลางล่าสุด
 * GET /api/gov-prices/:commodity → ราคาล่าสุดของสินค้านั้น
 */

const express = require('express');
const router  = express.Router();
const excelPriceService = require('../services/excelPriceService');

function calcStaleDays(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

// ─── GET /api/gov-prices ─────────────────────────────────────────────────────
// คืนรายชื่อสินค้าทั้งหมดที่มีใน Excel (distinct)
router.get('/', async (_req, res) => {
  try {
    const commodities = excelPriceService.getCommodities();
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
    const allPrices = excelPriceService.getAllPrices();
    const latestByCommodity = new Map();
    
    for (const row of allPrices) {
      const key = row.commodity;
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
// คืนราคาล่าสุด (หรือตามวันที่ที่ระบุ) ของสินค้านั้น จาก Excel
router.get('/:commodity', async (req, res) => {
  try {
    const commodityRaw = decodeURIComponent(req.params.commodity);
    const dateParam = req.query.date; // optional: YYYY-MM-DD

    const commodityRows = excelPriceService.getPricesByCommodity(commodityRaw);

    if (commodityRows.length === 0) {
      return res.json({
        success: true,
        commodity: commodityRaw,
        date: null,
        unit: null,
        rows: [],
        message: `ไม่พบข้อมูลของ "${commodityRaw}"`,
      });
    }

    // หาวันล่าสุด หรือกรองตาม dateParam
    let targetDate = dateParam;
    if (!targetDate) {
      targetDate = commodityRows.reduce((latest, row) => {
        return !latest || String(row.price_date || '') > String(latest) ? row.price_date : latest;
      }, null);
    }

    const filteredRows = commodityRows.filter(row => row.price_date === targetDate);
    const firstRow = filteredRows[0];

    const rows = filteredRows.map(r => ({
      variety: r.variety || `${commodityRaw} (คละ)`,
      min: r.min_price,
      max: r.max_price,
      avg: r.avg_price,
    }));

    res.json({
      success: true,
      commodity: commodityRaw,
      date: targetDate || null,
      unit: firstRow?.unit || 'กก.',
      source: 'excel-db',
      updated_at: targetDate ? `${targetDate}T00:00:00.000Z` : null,
      rows,
    });
  } catch (e) {
    console.error(`[govPrices] GET /${req.params.commodity}:`, e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
