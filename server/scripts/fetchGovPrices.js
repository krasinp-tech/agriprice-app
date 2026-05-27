/**
 * server/scripts/fetchGovPrices.js
 * 
 * ระบบอัตโนมัติสำหรับดึงข้อมูลราคากลางสินค้าเกษตร (Scraper)
 * แหล่งข้อมูล: กรมการค้าภายใน (Department of Internal Trade)
 * 
 * วิธีใช้งาน:
 * 1. รันด่วน: node server/scripts/fetchGovPrices.js
 * 2. ตั้งเวลา: ใช้ Cron Job (เช่น 0 4 * * * เพื่อรันตอนตี 4 ทุกวัน)
 */

require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

// ข้อมูลเชื่อมต่อ Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ตัวเลือกแหล่งข้อมูล (ตั้งค่าใน .env):
// GOV_PRICE_API_URL - endpoint ที่คืน JSON
// GOV_PRICE_CSV_URL - ถ้ามี CSV/XLSX URL ให้ดึง
// ถ้าไม่มี จะใช้ official daily gov price dataset จาก data.go.th
const DEFAULT_GOV_PRICE_CSV_URL = 'https://data.go.th/dataset/866a5af2-6a94-4ddd-8e56-7fb086da0986/resource/570c5233-605d-433d-a1a6-c9a4b6e005a9/download/noit11561118811.csv';

async function fetchJsonFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AgriPrice/1.0 (+https://github.com)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchBufferFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'AgriPrice/1.0 (+https://github.com)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function parsePriceDate(rawDate) {
  if (rawDate == null || rawDate === '') return '';
  if (typeof rawDate === 'number' && !Number.isNaN(rawDate)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.round(rawDate));
    return epoch.toISOString().slice(0, 10);
  }

  const text = String(rawDate).trim();
  if (!text) return '';

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  const monthNames = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const match = text.toUpperCase().match(/^(\d{1,2})[- ]([A-Z]{3})[- ](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = monthNames[match[2]];
    let year = Number(match[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (!Number.isNaN(day) && month >= 0 && !Number.isNaN(year)) {
      return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
    }
  }

  return '';
}

function normalizeRecord(raw) {
  // Support flexible keys from various sources
  const commodity = raw.commodity || raw.product || raw.name || raw.commodity_name || raw.PR_PROD_NAME || raw['PR_PROD_NAME'] || raw['ชื่อสินค้า'] || '';
  const market = raw.market || raw.MARKET_NAME || raw['MARKET_NAME'] || '';
  const variety = raw.variety || raw.variety_name || raw.grade || raw['สายพันธุ์'] || market || '';
  const unit = raw.unit || raw.uom || raw['หน่วย'] || 'กก.';
  const min_price = Number(String(raw.min_price || raw.min || raw.low || raw['ต่ำสุด'] || raw.PRICE_DAY || raw['PRICE_DAY'] || raw.price_day || '').replace(/,/g, '')) || 0;
  const max_price = Number(String(raw.max_price || raw.max || raw.high || raw['สูงสุด'] || raw.PRICE_DAY || raw['PRICE_DAY'] || raw.price_day || '').replace(/,/g, '')) || 0;
  const avg_price = Number(String(raw.avg_price || raw.avg || raw.average || raw['ราคาเฉลี่ย'] || raw.PRICE_DAY || raw['PRICE_DAY'] || raw.price_day || '').replace(/,/g, '')) || 0;
  const price_date = parsePriceDate(raw.price_date || raw.date || raw['date'] || raw['PRICE_DATE'] || raw.PRICE_DATE || raw.price_date);
  const finalMin = min_price || avg_price;
  const finalMax = max_price || avg_price;
  return {
    commodity,
    variety,
    unit,
    min_price: finalMin,
    max_price: finalMax,
    avg_price: avg_price || ((finalMin + finalMax) / 2),
    price_date: price_date || new Date().toISOString().slice(0, 10),
  };
}

async function runScraper() {
  console.log('--- [Scraper] Starting Market Price Sync ---');

  const apiUrl = process.env.GOV_PRICE_API_URL || '';
  const csvUrl = process.env.GOV_PRICE_CSV_URL || DEFAULT_GOV_PRICE_CSV_URL;

  try {
    let records = [];
    let source = 'mock';

    if (apiUrl) {
      console.log('[Scraper] Fetching JSON from', apiUrl);
      const json = await fetchJsonFromUrl(apiUrl);
      // json may be an array or an object with data field
      const arr = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);
      records = arr.map(normalizeRecord).filter(r => r.commodity);
      source = apiUrl;
    } else if (csvUrl) {
      console.log('[Scraper] Fetching CSV/XLSX from', csvUrl);
      const buf = await fetchBufferFromUrl(csvUrl);
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const arr = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      records = arr.map(normalizeRecord).filter(r => r.commodity);
      source = csvUrl;
    } else {
      console.log('[Scraper] No GOV_PRICE_API_URL or GOV_PRICE_CSV_URL configured — using fallback mock data');
      const COMMODITY_MAP = [
        { name: 'ทุเรียน', variety: 'หมอนทอง' },
        { name: 'มังคุด', variety: 'คละ' },
        { name: 'ลองกอง', variety: 'คละ' },
        { name: 'เงาะ', variety: 'โรงเรียน' },
        { name: 'ปาล์มน้ำมัน', variety: 'เปอร์เซ็นต์น้ำมัน 18%' },
        { name: 'ยางพารา', variety: 'ยางแผ่นดิบ' }
      ];
      const today = new Date().toISOString().split('T')[0];
      records = COMMODITY_MAP.map(item => {
        const avgPrice = getBasePrice(item.name);
        return {
          commodity: item.name,
          variety: item.variety,
          unit: 'กก.',
          min_price: avgPrice - 5,
          max_price: avgPrice + 5,
          avg_price: avgPrice,
          price_date: today
        };
      });
      source = 'mock';
    }

    if (!records.length) {
      console.warn('[Scraper] No records parsed — aborting');
      return;
    }

    // Add metadata and upsert
    const prepared = records.map(r => ({
      commodity: r.commodity,
      variety: r.variety || '',
      unit: r.unit || 'กก.',
      min_price: r.min_price || 0,
      max_price: r.max_price || 0,
      avg_price: r.avg_price || 0,
      price_date: r.price_date,
      source: source,
      updated_at: new Date().toISOString()
    }));

    console.log(`[Scraper] Upserting ${prepared.length} records to Supabase (onConflict: commodity,variety,price_date)`);
    const { data, error } = await supabase
      .from('gov_prices')
      .upsert(prepared, { onConflict: 'commodity,variety,price_date' });

    if (error) throw error;

    console.log('--- [Scraper] Sync Completed Successfully ---');
    console.log(`Updated at: ${new Date().toLocaleString('th-TH')} (source: ${source})`);
  } catch (err) {
    console.error('!!! [Scraper] Sync Failed !!!');
    console.error(err && err.message ? err.message : String(err));
  }
}

function getBasePrice(name) {
  const prices = {
    'ทุเรียน': 165,
    'มังคุด': 75,
    'ลองกอง': 45,
    'เงาะ': 35,
    'ปาล์มน้ำมัน': 6.2,
    'ยางพารา': 68
  };
  return prices[name] || 50;
}

// Execute
runScraper();
