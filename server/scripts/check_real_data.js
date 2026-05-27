require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await s.from('gov_prices').select('*').ilike('source', '%dit.go.th%').limit(5);
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
check();
