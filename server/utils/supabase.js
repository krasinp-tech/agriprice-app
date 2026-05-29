/**
 * utils/supabase.js
 * [Database Connection] ไฟล์ตั้งค่าการเชื่อมต่อกับฐานข้อมูล Supabase (BaaS)
 * 
 * แบ่งการเชื่อมต่อเป็น 2 แบบ:
 * 1. supabase: สิทธิ์ทั่วไป ใช้สำหรับส่ง/ยืนยัน OTP เท่านั้น
 * 2. supabaseAdmin: สิทธิ์สูงสุด (Service Role) ใช้ดึงข้อมูล/เขียนข้อมูลทั้งหมดข้ามกฏ RLS ของ Database
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('❌ Missing Supabase environment variables');
}

// Client 1: สิทธิ์จำกัด (Anon)
const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Client 2: สิทธิ์แอดมิน (Bypass Security Rules)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { supabase, supabaseAdmin };
