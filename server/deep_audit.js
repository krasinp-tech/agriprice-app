
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepAudit() {
  console.log('🔍 Starting Deep Audit...');
  
  try {
    // 1. ลองดึงข้อมูลแถวสุดท้ายมาดูว่าหน้าตาเป็นยังไง
    const { data: lastOne } = await supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(1);
    console.log('Last success entry:', lastOne);

    // 2. ลอง Insert ข้อมูลที่ "น่าจะพัง" เพื่อดูสาเหตุ
    console.log('Testing insertion with potentially missing fields...');
    const testData = {
      booking_no: 'FIX-' + Date.now(),
      farmer_id: 'c9a38310-0e6a-41ce-9f32-6cb8613d1745',
      buyer_id: 'ea51e584-c71d-4355-ab7f-a1e81d3f3001',
      product_id: 53,
      scheduled_time: new Date().toISOString(),
      status: 'waiting'
      // จงใจไม่ใส่ฟิลด์อื่นๆ เพื่อดูว่าตัวไหนเป็น NOT NULL
    };

    const { error } = await supabase.from('bookings').insert(testData);
    if (error) {
      console.log('❌ Caught the Bug! Error is:');
      console.log(JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Insertion passed without full fields. This means many fields are optional.');
    }

  } catch (e) {
    console.error('Audit script error:', e);
  }
}

deepAudit();
