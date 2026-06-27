require('dotenv').config();
const { supabaseAdmin } = require('./utils/supabase');

async function test() {
  try {
    console.log('Querying a sample chat room...');
    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error querying chat rooms:', error);
    } else {
      console.log('Sample chat room:', data);
    }
  } catch (err) {
    console.error('Script failed:', err);
  }
}

test();
