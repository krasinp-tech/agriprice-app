/**
 * utils/supabase.js
 * [Database Connection] ไฟล์ตั้งค่าการเชื่อมต่อกับฐานข้อมูล Supabase (BaaS)
 * 
 * แบ่งการเชื่อมต่อเป็น 2 แบบ:
 * 1. supabase: สิทธิ์ทั่วไป ใช้สำหรับส่ง/ยืนยัน OTP เท่านั้น
 * 2. supabaseAdmin: สิทธิ์สูงสุด (Service Role) ใช้ดึงข้อมูล/เขียนข้อมูลทั้งหมดข้ามกฏ RLS ของ Database
 */
const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createUnavailableClient(clientName) {
  const message = `Supabase client "${clientName}" is unavailable because SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are not configured.`;
  let proxy;

  proxy = new Proxy(function noop() {}, {
    apply() {
      throw new Error(message);
    },
    get(_target, prop) {
      if (prop === 'toString') {
        return () => `[Unavailable ${clientName}]`;
      }

      if (prop === 'then') {
        return undefined;
      }

      return proxy;
    },
  });

  return proxy;
}

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  logger.warn('⚠️  Supabase env vars are missing; auth/storage features will stay disabled until .env is configured.');
  module.exports = {
    supabase: createUnavailableClient('supabase'),
    supabaseAdmin: createUnavailableClient('supabaseAdmin'),
  };
  return;
}

// Client 1: สิทธิ์จำกัด (Anon)
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Client 2: สิทธิ์แอดมิน (Bypass Security Rules)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabase, supabaseAdmin };
