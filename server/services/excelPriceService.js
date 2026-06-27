const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = path.join(__dirname, '../data/gov_prices.xlsx');

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

function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400) * 1000);
    return date.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return String(val);
}

function getAllPrices() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Excel file not found at ${EXCEL_PATH}`);
    return [];
  }
  
  // Read file dynamically on each request to support real-time updates
  const workbook = xlsx.readFile(EXCEL_PATH, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = xlsx.utils.sheet_to_json(worksheet);

  return rawData.map(row => {
    const category = String(row['หมวดหมู่'] || row.Category || '').trim();
    const commodity = String(row['ชนิดสินค้า'] || row.Commodity || '').trim();
    const variety = String(row['สายพันธุ์'] || row.Variety || '').trim();
    const unit = String(row['หน่วย'] || row.Unit || 'กก.').trim();

    // Parse prices (Thai: ราคาขั้นต่ำ / English: MinPrice)
    const minRaw = row['ราคาขั้นต่ำ'] !== undefined ? row['ราคาขั้นต่ำ'] : row.MinPrice;
    const min_price = typeof minRaw === 'number' ? minRaw : parseFloat(minRaw) || 0;

    const maxRaw = row['ราคาสูงสุด'] !== undefined ? row['ราคาสูงสุด'] : row.MaxPrice;
    const max_price = typeof maxRaw === 'number' ? maxRaw : (parseFloat(maxRaw) || min_price);

    const avgRaw = row['ราคาเฉลี่ย'] !== undefined ? row['ราคาเฉลี่ย'] : row.AvgPrice;
    const avg_price = typeof avgRaw === 'number' ? avgRaw : (parseFloat(avgRaw) || min_price);

    const dateRaw = row['วันที่อัพเดท'] || row['วันที่'] || row.PriceDate;
    const price_date = parseExcelDate(dateRaw);

    return {
      category,
      commodity,
      variety,
      unit,
      min_price,
      max_price,
      avg_price,
      price_date
    };
  });
}

function getCommodities() {
  const prices = getAllPrices();
  const seen = new Map();
  for (const row of prices) {
    const key = row.commodity;
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev || String(row.price_date || '') > String(prev.price_date || '')) {
      seen.set(key, {
        commodity: key,
        category: row.category,
        latest_date: row.price_date
      });
    }
  }
  return Array.from(seen.values());
}

function getPricesByCommodity(commodityName) {
  const prices = getAllPrices();
  const normalizedSearch = normalizeCommodity(commodityName);
  
  return prices.filter(row => {
    const normalizedRow = normalizeCommodity(row.commodity);
    return normalizedRow === normalizedSearch || 
           String(row.commodity || '').toLowerCase().trim() === String(commodityName || '').toLowerCase().trim();
  });
}

module.exports = {
  getAllPrices,
  getCommodities,
  getPricesByCommodity,
  normalizeCommodity
};
