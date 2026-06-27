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
    const sqlPath = path.join(__dirname, '../../infrastructure/database/update-functions-migration.sql');
    console.log('Reading update functions SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying functions update in database...');
    await pool.query(sql);
    console.log('✅ Functions update applied successfully.');
  } catch (err) {
    console.error('❌ Functions update failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
