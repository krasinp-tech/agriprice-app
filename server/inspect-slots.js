require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function inspectSlotsTable() {
  try {
    const { data, error } = await supabaseAdmin.from('product_slots').select('*').limit(1);
    if (error) {
      console.log('❌ Error inspecting table:', error.message);
    } else {
      console.log('✅ Table structure:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty, cannot see columns');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

inspectSlotsTable();
