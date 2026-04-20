/**
 * services/ditScraper.js
 * ดึงราคาสินค้าเกษตรจากเว็บ DIT (กรมการค้าภายใน)
 * แล้ว upsert ลง Supabase ทุกวันอัตโนมัติ
 */

const cron   = require('node-cron');
const XLSX   = require('xlsx');
const https  = require('https');
const http   = require('http');
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// รายการสินค้าที่ต้องการดึง
const COMMODITIES = [
  { key: 'durian',     label: 'ทุเรียน',  ditName: 'ทุเรียน',      group: 'ผลไม้',  type: 2 },
  { key: 'mangosteen', label: 'มังคุด',  ditName: 'มังคุด',      group: 'ผลไม้',  type: 2 },
  { key: 'longkong',   label: 'ลองกอง',  ditName: 'ลองกอง',      group: 'ผลไม้',  type: 2 },
  { key: 'rambutan',   label: 'เงาะ',    ditName: 'เงาะ',        group: 'ผลไม้',  type: 2 },
  { key: 'palm',       label: 'ปาล์ม',   ditName: 'ปาล์มน้ำมัน', group: 'พืชไร่', type: 2 },
  { key: 'rubber',     label: 'ยางพารา', ditName: 'ยางพารา',     group: 'พืชไร่', type: 2 },
  { key: 'vegetable',  label: 'ผักสด',   ditName: 'ผักสด',       group: 'ผัก',    type: 2 },
];

// แปลงชื่อเดือนไทยย่อเป็นเลขเดือน
const THAI_MONTH = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4,
  'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7,  'ส.ค.': 8,
  'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12
};

// แปลง "25 ก.ย. 2568" -> "2025-09-25"
function parseThaiDate(str) {
  const s = String(str || '').trim();
  const m = s.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!m) return null;
  const day  = parseInt(m[1], 10);
  const mon  = THAI_MONTH[m[2]];
  const year = parseInt(m[3], 10) - 543;
  if (!mon || !year || year < 1900) return null;
  return year + '-' + String(mon).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

// format วันที่เป็น yyyy-mm-dd แบบ พ.ศ. สำหรับส่ง DIT
function toThaiDateStr(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear() + 543;   // DIT ใช้ปี พ.ศ.
  return y + '-' + m + '-' + d;
}

function shiftDate(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

// download file จาก URL พร้อม redirect
function downloadBuffer(url) {
  return new Promise(function(resolve, reject) {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch(e) { return reject(new Error('Invalid URL: ' + url)); }

    const options = {
      hostname: parsedUrl.hostname,
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET',
      headers:  {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept':     'application/vnd.ms-excel, */*',
        'Referer':    'https://pricelist.dit.go.th/',
      },
    };

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.request(options, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
        let loc = res.headers.location;
        if (!loc) return reject(new Error('Redirect without location'));
        if (loc.startsWith('/')) loc = parsedUrl.protocol + '//' + parsedUrl.hostname + loc;
        return downloadBuffer(loc).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end',  function()  { resolve(Buffer.concat(chunks)); });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// Parse Excel/HTML buffer จาก DIT
function parseExcelBuffer(buffer, commodityKey, commodityLabel) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (e) {
    console.warn('[DIT Parse] read workbook failed for ' + commodityLabel + ':', e.message);
    return [];
  }

  if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
    console.warn('[DIT Parse] no sheet found for ' + commodityLabel);
    return [];
  }

  console.log('[DIT Parse] ' + commodityLabel + ' (' + commodityKey + ') — sheets:', workbook.SheetNames);

  const rows = [];

  for (let si = 0; si < workbook.SheetNames.length; si++) {
    const sheetName = workbook.SheetNames[si];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    let data;
    try {
      data = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
    } catch (e) {
      console.warn('[DIT Parse] sheet_to_json failed for sheet ' + sheetName + ':', e.message);
      continue;
    }

    console.log('[DIT Parse] sheet "' + sheetName + '" — ' + data.length + ' rows');
    if (data.length > 0) console.log('[DIT Parse] row 0:', JSON.stringify(data[0]));

    // หา header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(data.length, 10); i++) {
      if (!Array.isArray(data[i])) continue;
      const rowStr = data[i].map(function(c) { return String(c || ''); });
      if (rowStr.some(function(c) { return c.includes('วันที่') || c.includes('ราคา'); })) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) continue;
    if (!Array.isArray(data[headerIdx])) continue;

    const headers = data[headerIdx].map(function(c) { return String(c || '').trim(); });
    console.log('[DIT Parse] headers:', headers);

    const colDate    = headers.findIndex(function(h) { return h.includes('วันที่') || h.includes('date'); });
    const colVariety = headers.findIndex(function(h) { return h.includes('สินค้า') || h.includes('ชนิด'); });
    const colUnit    = headers.findIndex(function(h) { return h.includes('หน่วย') || h.includes('unit'); });
    const colMin     = headers.findIndex(function(h) { return h.includes('ต่ำสุด'); });
    const colMax     = headers.findIndex(function(h) { return h.includes('สูงสุด'); });
    const colAvg     = headers.findIndex(function(h) { return h.includes('เฉลี่ย') || h.includes('avg'); });
    const colMinMax  = (colMin === -1) ? headers.findIndex(function(h) { return h.includes('ต่ำ-สูง'); }) : -1;

    for (var j = headerIdx + 1; j < data.length; j++) {
      var row = data[j];
      if (!Array.isArray(row)) continue;
      if (!row || row[colDate] == null) continue;

      // parse วันที่
      var price_date = new Date().toISOString().slice(0, 10);
      var rawDate = row[colDate];

      if (rawDate instanceof Date) {
        price_date = new Date(rawDate.getTime() - rawDate.getTimezoneOffset() * 60000)
          .toISOString().slice(0, 10);
      } else if (typeof rawDate === 'number') {
        var pd = XLSX.SSF.parse_date_code(rawDate);
        if (pd) price_date = pd.y + '-' + String(pd.m).padStart(2,'0') + '-' + String(pd.d).padStart(2,'0');
      } else if (typeof rawDate === 'string' && rawDate.trim()) {
        var thai = parseThaiDate(rawDate);
        if (thai) {
          price_date = thai;
        } else {
          var parts = rawDate.includes('/') ? rawDate.split('/') : rawDate.split('-');
          if (parts.length === 3) {
            price_date = rawDate.includes('/')
              ? parts[2] + '-' + String(parts[1]).padStart(2,'0') + '-' + String(parts[0]).padStart(2,'0')
              : rawDate.trim();
          }
        }
      }

      // parse ราคา
      var min_price = null, max_price = null, avg_price = null;

      if (colMin !== -1 && row[colMin] != null) min_price = parseFloat(row[colMin]) || null;
      if (colMax !== -1 && row[colMax] != null) max_price = parseFloat(row[colMax]) || null;

      if (colMinMax !== -1 && row[colMinMax]) {
        var str  = String(row[colMinMax]);
        var mmatch = str.match(/([\d.]+)\s*[-\u2013]\s*([\d.]+)/);
        if (mmatch) {
          min_price = parseFloat(mmatch[1]);
          max_price = parseFloat(mmatch[2]);
        } else if (!min_price) {
          min_price = parseFloat(str) || null;
        }
      }

      if (colAvg !== -1 && row[colAvg] != null) avg_price = parseFloat(row[colAvg]) || null;

      if (!min_price && !max_price && !avg_price) continue;

      var varietyRaw = colVariety !== -1 ? String(row[colVariety] || '').trim() : '';
      var unitRaw    = colUnit    !== -1 ? String(row[colUnit]    || '').trim() : 'กก.';

      rows.push({
        commodity:  commodityKey,
        variety:    varietyRaw || (commodityLabel + ' (คละ)'),
        unit:       unitRaw || 'กก.',
        min_price:  min_price,
        max_price:  max_price,
        avg_price:  avg_price,
        price_date: price_date,
        source:     'dit.go.th',
      });
    }
  }

  return rows;
}

function buildExportUrl(commodity, mode, fromStr, toStr) {
  var endpoint = mode === 'day' ? 'exportexcel.php' : 'exportexcel_avg.php';
  return 'https://pricelist.dit.go.th/' + endpoint
    + '?settime=' + mode
    + '&from=' + fromStr
    + '&to='   + toStr
    + '&type=' + commodity.type
    + '&group=' + encodeURIComponent(commodity.group)
    + '&name='  + encodeURIComponent(commodity.ditName);
}

async function tryCommodityWindow(commodity, mode, fromDate, toDate) {
  var fromStr = toThaiDateStr(fromDate);
  var toStr   = toThaiDateStr(toDate);
  var url     = buildExportUrl(commodity, mode, fromStr, toStr);

  console.log('[DIT] ' + commodity.label + ' [' + mode + '] URL:', url);
  var buffer = await downloadBuffer(url);
  var rows   = parseExcelBuffer(buffer, commodity.key, commodity.label);

  return {
    rows: rows,
    rangeUsed: {
      from: fromStr,
      to: toStr,
      fallback: mode !== 'day' || fromStr !== toStr,
      mode: mode,
    },
  };
}

// ดึงข้อมูล 1 สินค้า — ไล่จากรายวัน → รายสัปดาห์ → รายเดือน
// ปรับให้ค้นหาเร็วขึ้น: รายวัน 14 วันล่าสุด, รายสัปดาห์ 12 สัปดาห์, รายเดือน 6 เดือน
async function fetchOneCommodity(commodity, dateStr) {
  var baseDate = new Date();
  var attempt;

  // 1) รายวัน: ไล่ย้อนหลังทีละวันก่อน (ล่าสุด 14 วัน)
  for (attempt = 0; attempt <= 14; attempt++) {
    var dayTo = shiftDate(baseDate, -attempt);
    var dayResult = await tryCommodityWindow(commodity, 'day', dayTo, dayTo);
    if (dayResult.rows.length > 0) {
      if (attempt > 0) {
        console.log('[DIT] ' + commodity.label + ': เจอข้อมูลรายวันเมื่อ ' + attempt + ' วันก่อน (' + dayResult.rangeUsed.from + ') ได้ ' + dayResult.rows.length + ' แถว');
      }
      return dayResult;
    }
  }

  // 2) รายสัปดาห์: ไล่ย้อนหลังทีละ 7 วัน (ล่าสุด 12 สัปดาห์)
  for (attempt = 0; attempt <= 12; attempt++) {
    var weekTo = shiftDate(baseDate, -(attempt * 7));
    var weekFrom = shiftDate(weekTo, -6);
    var weekResult = await tryCommodityWindow(commodity, 'week', weekFrom, weekTo);
    if (weekResult.rows.length > 0) {
      console.log('[DIT] ' + commodity.label + ': เจอข้อมูลรายสัปดาห์ช่วง ' + weekResult.rangeUsed.from + ' ถึง ' + weekResult.rangeUsed.to + ' ได้ ' + weekResult.rows.length + ' แถว');
      return weekResult;
    }
  }

  // 3) รายเดือน: ไล่ย้อนหลังทีละ 30 วัน (ล่าสุด 6 เดือน)
  for (attempt = 0; attempt <= 6; attempt++) {
    var monthTo = shiftDate(baseDate, -(attempt * 30));
    var monthFrom = shiftDate(monthTo, -29);
    var monthResult = await tryCommodityWindow(commodity, 'month', monthFrom, monthTo);
    if (monthResult.rows.length > 0) {
      console.log('[DIT] ' + commodity.label + ': เจอข้อมูลรายเดือนช่วง ' + monthResult.rangeUsed.from + ' ถึง ' + monthResult.rangeUsed.to + ' ได้ ' + monthResult.rows.length + ' แถว');
      return monthResult;
    }
  }

  console.log('[DIT] ' + commodity.label + ': ไม่พบข้อมูลในรายวัน/รายสัปดาห์/รายเดือน');
  return { rows: [], rangeUsed: { from: dateStr, to: dateStr, fallback: false, mode: 'day' } };
}

// upsert ลง Supabase
async function upsertPrices(rows) {
  if (!rows.length) return 0;
  var result = await supabaseAdmin
    .from('gov_prices')
    .upsert(rows, { onConflict: 'commodity,variety,price_date', ignoreDuplicates: false })
    .select('id');
  if (result.error) throw new Error(result.error.message);
  return result.data ? result.data.length : rows.length;
}

// Main sync
async function syncDITPrices(targetDate) {
  var date    = targetDate || new Date();
  var dateStr = toThaiDateStr(date);
  console.log('\n[DIT Sync] เริ่ม sync วันที่ ' + dateStr + '...');

  var totalSaved = 0;
  var errors     = [];
  var details    = [];

  for (var i = 0; i < COMMODITIES.length; i++) {
    var commodity = COMMODITIES[i];
    try {
      var fetched = await fetchOneCommodity(commodity, dateStr);
      var rows = fetched.rows || [];
      var saved = await upsertPrices(rows.map(function(row) {
        return Object.assign({}, row, {
          source: 'dit.go.th/' + (fetched.rangeUsed && fetched.rangeUsed.mode ? fetched.rangeUsed.mode : 'day'),
        });
      }));
      totalSaved += saved;

      var latestFetchedDate = null;
      if (rows.length > 0) {
        latestFetchedDate = rows.reduce(function(max, r) {
          return String(r.price_date || '') > String(max || '') ? r.price_date : max;
        }, null);
      }

      details.push({
        commodity: commodity.label,
        commodity_key: commodity.key,
        fetched_rows: rows.length,
        saved_rows: saved,
        latest_fetched_date: latestFetchedDate,
        range_used: fetched.rangeUsed,
      });
      await new Promise(function(r) { setTimeout(r, 500); });
    } catch (e) {
      console.error('[DIT] error ' + commodity.label + ':', e.message);
      errors.push({ commodity: commodity.label, error: e.message });
      details.push({
        commodity: commodity.label,
        commodity_key: commodity.key,
        fetched_rows: 0,
        saved_rows: 0,
        latest_fetched_date: null,
        error: e.message,
      });
    }
  }

  console.log('[DIT Sync] เสร็จ — บันทึก ' + totalSaved + ' แถว, error ' + errors.length + ' รายการ\n');
  return { totalSaved: totalSaved, errors: errors, details: details };
}

// Cron ทุกวัน 06:00 น.
cron.schedule('0 6 * * *', function() {
  console.log('[DIT Cron] sync ราคาสินค้าเกษตรจาก DIT...');
  syncDITPrices().catch(function(e) { console.error('[DIT Cron] Error:', e.message); });
}, { timezone: 'Asia/Bangkok' });

console.log('DIT Scraper: auto-sync ทุกวัน 06:00 น. (Asia/Bangkok)');

module.exports = { syncDITPrices };