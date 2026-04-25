require('dotenv').config();
const db = require('./db');

async function listProfiles() {
  try {
    const res = await db.query('SELECT profile_id, first_name, last_name, phone FROM profiles');
    console.log('--- Profiles ---');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

listProfiles();
