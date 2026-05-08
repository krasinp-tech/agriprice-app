/**
 * db.js
 * PostgreSQL connection pool (node-postgres)
 * ใช้ DATABASE_URL จาก .env ซึ่ง Supabase ให้มาในหน้า Settings > Database
 *
 * Supabase connection string format:
 *   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
 */
const { Pool } = require('pg');
const logger   = require('./utils/logger');

if (!process.env.DATABASE_URL) {
  throw new Error('❌ ต้องตั้งค่า DATABASE_URL ใน .env\n' +
    '   ดูได้ที่ Supabase Dashboard → Settings → Database → Connection string (URI)');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase ต้องการ SSL เสมอ
  max:             10,   // max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  logger.debug('🔌 DB: new client connected');
});

pool.on('error', (err) => {
  logger.error('❌ DB pool error:', { message: err.message });
});

// ทดสอบ connection ตอนเริ่ม
pool.query('SELECT 1')
  .then(() => logger.info('✅ DB: connected'))
  .catch(err => logger.error('❌ DB: connection failed — ' + err.message));

module.exports = pool;