#!/usr/bin/env node
// server/scripts/query-db.js
// Usage:
//   cd server
//   node scripts/query-db.js "SELECT * FROM gov_prices ORDER BY price_date DESC LIMIT 20;"
//   node scripts/query-db.js --tables

require('dotenv').config();
const pool = require('../db');

const arg = process.argv[2];

async function listTables() {
  const q = `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`;
  const res = await pool.query(q);
  console.log('Public tables:');
  res.rows.forEach(r => console.log(r.table_name));
}

async function runSql(sql) {
  try {
    const res = await pool.query(sql);
    console.log(`Returned ${res.rowCount} rows`);
    console.table(res.rows.slice(0, 50));
  } catch (e) {
    console.error('Query error:', e.message);
  }
}

(async () => {
  try {
    if (!arg || arg === '--help') {
      console.log('\nUsage:');
      console.log('  node scripts/query-db.js "SELECT * FROM gov_prices LIMIT 20;"');
      console.log('  node scripts/query-db.js --tables\n');
      process.exit(0);
    }

    if (arg === '--tables') {
      await listTables();
    } else {
      await runSql(arg);
    }
  } finally {
    // close pool
    try { await pool.end(); } catch(e){}
  }
})();
