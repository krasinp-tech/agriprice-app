const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.fwrxthucmtrjbsswdrsq:Agriprice-1234@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query('ALTER TABLE public.products ADD COLUMN grades jsonb DEFAULT \'[]\'::jsonb;');
    console.log('Successfully added grades column to products table.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
