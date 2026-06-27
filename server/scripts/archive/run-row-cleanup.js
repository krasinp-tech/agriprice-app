const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const sqlPath = path.join(__dirname, '../../infrastructure/database/row-cleanup-migration.sql');
    console.log('Reading row cleanup SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying row cleanup in database...');
    const res = await pool.query(sql);
    console.log(`✅ Row cleanup applied successfully. Deleted ${res.rowCount} rows.`);
  } catch (err) {
    console.error('❌ Row cleanup failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
