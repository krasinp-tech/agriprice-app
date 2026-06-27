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
    const sqlPath = path.join(__dirname, '../../infrastructure/database/normalization-grades-migration.sql');
    console.log('Reading normalization SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying grades normalization in database...');
    await pool.query(sql);
    console.log('✅ Grades normalization applied successfully.');
  } catch (err) {
    console.error('❌ Grades normalization failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
