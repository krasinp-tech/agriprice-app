const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT 
        r.routine_name, 
        r.routine_type, 
        r.data_type AS return_type, 
        r.routine_definition,
        pg_get_function_arguments(p.oid) AS arguments
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      JOIN pg_namespace n ON p.pronamespace = n.oid AND n.nspname = r.routine_schema
      WHERE r.routine_schema = 'public' 
        AND r.routine_name IN ('increment_booked_count', 'decrement_booked_count', 'next_queue_sequence')
    `);
    console.log('Found functions:');
    res.rows.forEach(r => {
      console.log(`\n--- Function: ${r.routine_name}(${r.arguments}) ---`);
      console.log(`Type: ${r.routine_type}, Return: ${r.return_type}`);
      console.log(r.routine_definition);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
