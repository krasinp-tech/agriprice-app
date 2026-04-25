require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function checkProducts() {
  try {
    console.log('--- Checking Your Products ---');
    
    // Try to fetch from 'products' table
    const { data: products, error: pError } = await supabaseAdmin
      .from('products')
      .select('*')
      .limit(20);

    if (pError) {
      console.log('❌ Error or Table "products" not found:', pError.message);
    } else {
      console.log('✅ Found', products.length, 'products in "products" table.');
      console.log('Sample Products:', products.map(p => p.name || p.product_name || p.title));
    }

    // Also check 'categories' or others if they exist
    const { data: categories, error: cError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .limit(10);
    
    if (!cError) {
      console.log('✅ Found', categories.length, 'categories.');
    }

  } catch (e) {
    console.error('❌ Error during check:', e.message);
  }
}

checkProducts();
