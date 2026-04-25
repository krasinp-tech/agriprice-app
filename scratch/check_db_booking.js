
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './server/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Testing Database Connectivity ---');
  
  // 1. Check profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('profile_id, role').limit(5);
  if (pErr) console.error('Error fetching profiles:', pErr);
  else console.log('Profiles found:', profiles.length);

  // 2. Check product_slots
  const { data: slots, error: sErr } = await supabase.from('product_slots').select('*').limit(5);
  if (sErr) console.error('Error fetching product_slots:', sErr);
  else console.log('Product slots found:', slots.length);

  // 3. Check bookings
  const { data: bookings, error: bErr } = await supabase.from('bookings').select('*').limit(5);
  if (bErr) console.error('Error fetching bookings:', bErr);
  else console.log('Bookings found:', bookings.length);

  // 4. Try to insert a mock slot if needed, but let's just see the structure
  const { data: cols, error: cErr } = await supabase.rpc('get_table_columns', { table_name: 'bookings' }).catch(() => ({ error: 'RPC get_table_columns not found' }));
  if (cErr) console.log('Could not get columns via RPC, structure must be verified manually');
}

runTest();
