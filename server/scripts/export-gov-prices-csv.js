#!/usr/bin/env node
// server/scripts/export-gov-prices-csv.js
// Usage: node scripts/export-gov-prices-csv.js [output/path.csv]

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const outPath = process.argv[2] || path.join(__dirname, '..', 'exports', 'gov_prices.csv');

async function exportCsv() {
  try {
    const res = await pool.query('SELECT * FROM gov_prices ORDER BY price_date DESC, commodity, variety;');
    if (!res.rows) {
      console.error('No rows returned');
      return;
    }
    const rows = res.rows;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const keys = Object.keys(rows[0] || {});
    const header = keys.join(',') + '\n';
    const lines = rows.map(r => keys.map(k => {
      const v = r[k];
      if (v === null || v === undefined) return '';
      return String(v).replace(/"/g, '""');
    }).map(cell => `"${cell}"`).join(',')).join('\n');
    fs.writeFileSync(outPath, header + lines);
    console.log(`Exported ${rows.length} rows to ${outPath}`);
  } catch (e) {
    console.error('Export failed:', e.message);
  } finally {
    try { await pool.end(); } catch(e){}
  }
}

exportCsv();
