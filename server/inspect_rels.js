require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function inspectRelations() {
  console.log('--- Inspecting Relationships for bookings ---');
  // Raw RPC or inspection might be hard with Supabase-JS without a custom function,
  // so we will test different relationship names.
  const tests = [
    '*, profiles!farmer_id(*)',
    '*, profiles!bookings_farmer_id_fkey(*)',
    '*, farmer:profiles!farmer_id(*)',
    '*'
  ];

  for (const t of tests) {
    console.log(`Testing select: ${t}`);
    const { data, error } = await supabaseAdmin.from('bookings').select(t).limit(1);
    if (error) {
      console.log(`❌ Fail: ${error.message}`);
    } else {
      console.log(`✅ Success! Data keys: ${Object.keys(data[0]).join(', ')}`);
    }
  }
}

inspectRelations();
