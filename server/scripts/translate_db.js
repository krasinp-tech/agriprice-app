
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const MAPPING = {
  // Fruits
  'durian': 'ทุเรียน',
  'longkong': 'ลองกอง',
  'mangosteen': 'มังคุด',
  'rambutan': 'เงาะ',
  'banana': 'กล้วย',
  'mango': 'มะม่วง',
  'orange': 'ส้ม',
  'pineapple': 'สับปะรด',
  'watermelon': 'แตงโม',
  'palm': 'ปาล์ม',
  'rubber': 'ยางพารา',
  'vegetable': 'ผัก',
  'seed': 'เมล็ดพันธุ์',
  
  // Varieties
  'monthong': 'หมอนทอง',
  'chanee': 'ชะนี',
  'kanyao': 'ก้านยาว',
  'puangmanee': 'พวงมณี',
  'nam dok mai': 'น้ำดอกไม้',
  'ok rong': 'อกร่อง',
  'rong rian': 'โรงเรียน',
};

async function translate() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('--- Starting DB Translation to Thai ---');

  for (const [en, th] of Object.entries(MAPPING)) {
    console.log(`Translating: ${en} -> ${th}`);

    // 1. Fruits table
    await supabase.from('fruits').update({ name: th }).ilike('name', en);

    // 2. Fruit Varieties table
    await supabase.from('fruit_varieties').update({ name: th }).ilike('name', en);

    // 3. Products table (name)
    await supabase.from('products').update({ name: th }).ilike('name', en);

    // 4. Products table (variety)
    await supabase.from('products').update({ variety: th }).ilike('variety', en);

    // 5. Gov Prices table (commodity)
    await supabase.from('gov_prices').update({ commodity: th }).ilike('commodity', en);

    // 6. Gov Prices table (variety)
    await supabase.from('gov_prices').update({ variety: th }).ilike('variety', en);
  }

  console.log('--- Translation Complete ---');
}

translate();
