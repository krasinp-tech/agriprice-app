require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function debugVarieties() {
  console.log('--- 🔎 Debugging Varieties Table ---');
  try {
    // 1. Check if table exists
    const { error: checkError } = await supabaseAdmin.from('varieties').select('count', { count: 'exact', head: true });
    
    if (checkError) {
      console.log('❌ Table "varieties" status:', checkError.message);
      if (checkError.code === '42P01') {
        console.log('💡 CONFIRMED: Table "varieties" does not exist yet.');
      }
    } else {
      console.log('✅ Table "varieties" EXISTS.');
      
      // 2. Check data content
      const { data, error: dataError } = await supabaseAdmin.from('varieties').select('*').limit(5);
      if (dataError) {
        console.log('❌ Error fetching data:', dataError.message);
      } else {
        console.log('📊 Data count in table:', data.length);
        console.log('Sample data:', data);
      }
    }

    // 3. Check what is in 'products' table for comparison
    const { data: pData } = await supabaseAdmin.from('products').select('name').limit(5);
    console.log('🍎 Names in "products" table:', pData ? pData.map(p => p.name) : 'none');

  } catch (e) {
    console.error('❌ Unexpected Error:', e.message);
  }
}

debugVarieties();
