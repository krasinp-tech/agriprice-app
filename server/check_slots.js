require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function checkSlots() {
    const { data, error } = await supabaseAdmin
        .from('product_slots')
        .select('*')
        .eq('is_active', true);
    
    if (error) {
        console.error('Error fetching slots:', error);
        return;
    }
    
    console.log('Active Slots:', JSON.stringify(data, null, 2));
}

checkSlots();
