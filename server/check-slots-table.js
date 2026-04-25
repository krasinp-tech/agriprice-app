require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function checkSlotsTable() {
  try {
    console.log('--- Checking Product Slots Table ---');
    const { error } = await supabaseAdmin.from('product_slots').select('id').limit(1);
    if (error) {
      console.log('❌ Table "product_slots" does not exist:', error.message);
    } else {
      console.log('✅ Table "product_slots" EXISTS.');
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

checkSlotsTable();
