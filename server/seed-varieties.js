require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function seedVarieties() {
  const varieties = [
    { product_name: 'ทุเรียน', variety: 'หมอนทอง', category: 'fruit' },
    { product_name: 'ทุเรียน', variety: 'ก้านยาว', category: 'fruit' },
    { product_name: 'ทุเรียน', variety: 'ชะนี', category: 'fruit' },
    { product_name: 'ทุเรียน', variety: 'พวงมณี', category: 'fruit' },
    { product_name: 'มะม่วง', variety: 'น้ำดอกไม้', category: 'fruit' },
    { product_name: 'มะม่วง', variety: 'เขียวเสวย', category: 'fruit' },
    { product_name: 'มะม่วง', variety: 'อกร่อง', category: 'fruit' },
    { product_name: 'ส้ม', variety: 'สายน้ำผึ้ง', category: 'fruit' },
    { product_name: 'ยางพารา', variety: 'RRIM 600', category: 'rubber' },
    { product_name: 'ปาล์มน้ำมัน', variety: 'เทเนอรา', category: 'palm' },
  ];

  try {
    console.log('⏳ Starting to seed varieties...');
    
    // Check if table exists by trying a select
    const { error: checkError } = await supabaseAdmin.from('varieties').select('id').limit(1);
    
    if (checkError && checkError.code === '42P01') {
      console.log('❌ Table "varieties" does not exist. Please run the SQL I provided in Supabase SQL Editor first to create the table.');
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('varieties')
      .insert(varieties);

    if (error) throw error;
    console.log('✅ Successfully seeded varieties into your database!');
  } catch (e) {
    console.error('❌ Error seeding database:', e.message);
  }
}

seedVarieties();
