require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function checkVarieties() {
  try {
    const { data, error } = await supabaseAdmin
      .from('varieties')
      .select('*')
      .limit(5);

    if (error) throw error;
    console.log('--- DB CHECK ---');
    console.log('Table "varieties" count:', data.length);
    console.log('Sample data:', data);
    console.log('----------------');
  } catch (e) {
    console.error('❌ DB ERROR:', e.message);
  }
}

checkVarieties();
