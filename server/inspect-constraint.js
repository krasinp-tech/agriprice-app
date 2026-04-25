require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function inspectConstraint() {
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT pg_get_constraintdef(c.oid) AS constraint_def
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'bookings' AND c.conname = 'bookings_status_check';
      `
    });
    
    if (error) {
      console.log('❌ Error inspecting constraint via RPC:', error.message);
      // Fallback: If RPC is not available, we can't easily query system catalogs via Supabase JS client.
    } else {
      console.log('✅ Constraint definition:', data);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

inspectConstraint();
