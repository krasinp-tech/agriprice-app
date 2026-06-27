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
    const sqlPath = path.join(__dirname, '../../infrastructure/database/rename-tables-migration.sql');
    console.log('Reading migration SQL from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration in database...');
    await pool.query(sql);
    console.log('✅ Migration applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

main();
