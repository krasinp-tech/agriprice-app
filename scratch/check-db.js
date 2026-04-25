require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const { supabaseAdmin } = require('../server/utils/supabase');

async function checkVarieties() {
  const { data, error } = await supabaseAdmin
    .from('varieties')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ Error fetching varieties:', error);
    return;
  }

  console.log('✅ Varieties found:', data);
}

checkVarieties();
