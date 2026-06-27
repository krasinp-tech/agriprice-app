const { Pool } = require('pg');
require('dotenv').config({ path: 'c:/Users/pirap/Downloads/New folder/server/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT 
        table_name, 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);
    
    const tables = {};
    res.rows.forEach(r => {
      if (!tables[r.table_name]) {
        tables[r.table_name] = [];
      }
      tables[r.table_name].push({
        column: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable,
        default: r.column_default
      });
    });
    
    console.log(JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
