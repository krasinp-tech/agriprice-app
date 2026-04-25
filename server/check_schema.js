
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking bookings table schema ---');
  // ลองดึงมา 1 แถวเพื่อดูคอลัมน์
  const { data, error } = await supabase.from('bookings').select('*').limit(1);
  
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Available columns:', Object.keys(data[0]));
  } else {
    console.log('No data in bookings table, trying to get columns via another way...');
    // ลองดึงโครงสร้างตาราง (ถ้ามีสิทธิ์)
    const { data: cols, error: colErr } = await supabase.rpc('get_table_columns', { table_name: 'bookings' }).catch(() => ({ error: 'RPC not found' }));
    console.log('Columns from RPC:', cols || colErr);
  }
}

checkSchema();
