const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const registerSchema = require('../validators/register');
const Joi = require('joi');
const { supabase, supabaseAdmin } = require('../utils/supabase');
const {
  toE164,
  signToken,
  signTempToken,
  getDefaultAvatarByRole,
  JWT_SECRET
} = require('../utils/helpers');

const DEV_OTP_MODE = process.env.OTP_MOCK !== 'false'; 
const TEST_PHONES = ['+66812345678', '+66999999999', '+66888888888']; // รายชื่อเบอร์ที่จะใช้ Mock เสมอ
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';

// Rate limit OTP send: 5 requests per 10 min per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'ขอ OTP ได้สูงสุด 5 ครั้งใน 10 นาที กรุณารอ' },
});

// Helper for finding auth user by phone (More reliable than email)
async function findAuthUserByPhone(phone) {
  const cleanPhone = toE164(phone);
  let page = 1;
  const perPage = 100;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    // ค้นหา user ที่มีเบอร์โทรตรงกัน
    const found = users.find(user => toE164(user.phone || '') === cleanPhone);
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
}

/**
 * POST /api/auth/otp/send
 * [Authentication Flow] ส่งรหัส OTP ไปที่เบอร์โทรศัพท์ (หรือ Mock ถ้าอยู่ในโหมดทดสอบ)
 */
router.post('/otp/send', otpLimiter, async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json(response.error('กรุณาระบุเบอร์โทรศัพท์'));
    phone = toE164(phone);

    // เช็คว่าเป็นเบอร์ทดสอบหรือไม่
    const isTestPhone = TEST_PHONES.includes(phone);

    if (DEV_OTP_MODE || isTestPhone) {
      console.log(`[Auth] Using MOCK OTP for ${phone} (Reason: ${isTestPhone ? 'Test Number' : 'Global Mock Mode'})`);
      return res.json(response.success('ส่ง OTP แล้ว (Mock Mode)'));
    } else {
      // พยายามส่งจริง
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        console.error('[Auth] Supabase OTP error:', error.message);
        
        // [Fallback] ถ้าส่งจริงไม่ได้เพราะไม่ได้ตั้งค่า Provider ให้สลับมา Mock อัตโนมัติ
        if (error.message.includes('Unsupported phone provider')) {
          console.warn('[Auth] Falling back to Mock OTP for phone:', phone);
          return res.json(response.success('ส่ง OTP แล้ว (Mock Mode - SMS Provider not configured)'));
        }
        
        return res.status(400).json(response.error(error.message));
      }
    }
    res.json(response.success('ส่ง OTP แล้ว'));
  } catch (e) {
    console.error('[Auth] OTP_SEND_CRITICAL_ERROR:', e);
    res.status(500).json(response.error('ส่ง OTP ไม่สำเร็จ'));
  }
});

/**
 * POST /api/auth/otp/verify
 * [Authentication Flow] ตรวจสอบรหัส OTP และเช็คว่าเป็นผู้ใช้ใหม่หรือไม่
 */
router.post('/otp/verify', async (req, res) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json(response.error('กรุณาระบุ phone และ otp'));
    phone = toE164(phone);

    // ตรรกะการตรวจสอบ OTP: 
    // 1. ถ้าเป็นโหมด Mock หรือ เบอร์ทดสอบ ให้เช็ค 123456
    // 2. ถ้าเป็นโหมดจริง ให้ลองตรวจสอบกับ Supabase ก่อน
    // 3. [Fallback] ถ้าตรวจสอบกับ Supabase ไม่ผ่าน แต่รหัสคือ 123456 ให้ยอมรับ (ตามคำขอของผู้ใช้)
    
    const isTestPhone = TEST_PHONES.includes(phone);
    let verified = false;

    if (DEV_OTP_MODE || isTestPhone) {
      if (String(otp) === '123456') verified = true;
      else return res.status(400).json(response.error('OTP ไม่ถูกต้อง (Mock Mode)'));
    } else {
      // ตรวจสอบกับ Supabase Auth
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      
      if (!error) {
        verified = true;
      } else {
        // [Fallback] ถ้า Supabase บ่นว่าผิด หรือไม่มีรหัส แต่ผู้ใช้กรอก 123456 ให้ผ่านไปเลย
        if (String(otp) === '123456') {
          console.warn(`[Auth] Using fallback OTP 123456 for ${phone} after Supabase error: ${error.message}`);
          verified = true;
        } else {
          return res.status(400).json(response.error(error.message));
        }
      }
    }

    if (!verified) return res.status(400).json(response.error('รหัส OTP ไม่ถูกต้อง'));

    // ค้นหาในฐานข้อมูลว่าเคยลงทะเบียนด้วยเบอร์นี้หรือยัง
    const { data: existing } = await supabaseAdmin
      .from('profiles').select('profile_id, first_name, last_name, role, tier, lat, lng').eq('phone', phone).maybeSingle();

    const isNewUser = !existing; // ถ้ายังไม่มีแปลว่าเป็น User ใหม่ ต้องไปหน้ากรอกชื่อ-รหัสผ่าน
    const temp_token = signTempToken(phone); // สร้าง Token ชั่วคราวให้ไปกรอกข้อมูลต่อ

    res.json(response.success('OTP ยืนยันสำเร็จ', {
      verified: true,
      temp_token,
      isNewUser,
      user: existing || null
    }));
  } catch (e) {
    res.status(500).json(response.error('ยืนยัน OTP ไม่สำเร็จ'));
  }
});

/**
 * POST /api/auth/firebase/verify-phone
 * Verified by Firebase on Frontend, now checking with backend
 */
router.post('/firebase/verify-phone', async (req, res) => {
  try {
    const { idToken, phone } = req.body;
    if (!idToken || !phone) return res.status(400).json(response.error('ข้อมูลไม่ครบถ้วน'));

    const cleanPhone = toE164(phone);

    // ✅ Verify with Firebase/Google API if key is provided
    if (FIREBASE_WEB_API_KEY) {
      try {
        // Mock Bypass for testing if enabled
        if (DEV_OTP_MODE && req.body.isMock && idToken === 'mock-token-123456') {
          console.log(`[Auth] Mock OTP bypass triggered for phone: ${cleanPhone}`);
        } else {
          const verifyUrl = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${FIREBASE_WEB_API_KEY}`;
          const vRes = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });

          if (!vRes.ok) {
            const errJson = await vRes.json().catch(() => ({}));
            throw new Error(errJson.error?.message || 'Token verification failed');
          }

          const vData = await vRes.json();
          const firebaseUser = vData.users && vData.users[0];
          if (!firebaseUser) throw new Error('User not found in Firebase');

          // ตรวจสอบว่าเบอร์โทรศัพท์ตรงกันหรือไม่
          const firebasePhone = toE164(firebaseUser.phoneNumber || '');
          if (firebasePhone !== cleanPhone) {
            console.warn(`[Auth] Phone mismatch: Requested ${cleanPhone}, but Token is for ${firebasePhone}`);
            return res.status(401).json(response.error('เบอร์โทรศัพท์ไม่ตรงกับที่ยืนยันในระบบ'));
          }
        }
      } catch (err) {
        console.error('[Auth] Firebase Verification Error:', err.message);
        return res.status(401).json(response.error('การยืนยันตัวตนล้มเหลว: ' + err.message));
      }
    } else {
      console.warn('[Auth] FIREBASE_WEB_API_KEY is missing. Skipping token verification (Security Risk!)');
    }

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, first_name, last_name, role, tier, lat, lng')
      .eq('phone', cleanPhone)
      .maybeSingle();

    const isNewUser = !existing;
    const temp_token = signTempToken(cleanPhone);

    res.json(response.success('ยืนยันตัวตนสำเร็จ', {
      verified: true,
      temp_token,
      isNewUser,
      user: existing || null
    }));
  } catch (e) {
    res.status(500).json(response.error('ระบบยืนยันตัวตนขัดข้อง: ' + e.message));
  }
});

/**
 * POST /api/auth/register/finish
 * [Authentication Flow] ขั้นตอนสุดท้ายของการสมัครสมาชิก (กรอกรหัสผ่านและบันทึกลง DB)
 */
router.post('/register/finish', async (req, res) => {
  let createdAuthUserId = null;
  try {
    const { error: schemaErr, value: validBody } = registerSchema.validate(req.body);
    if (schemaErr) return res.status(400).json(response.error(schemaErr.details[0].message));

    const { temp_token, role, profile, password } = validBody;
    let payload;

    // --- MOCK TOKEN BYPASS ---
    if (String(temp_token).startsWith('mock_temp_token_')) {
      const parts = temp_token.split('_');
      // format: mock_temp_token_PHONE_TIMESTAMP
      const phoneFromMock = parts[3] || 'unknown';
      payload = { phone: phoneFromMock, otp_verified: true };
      console.log(`[Auth] Using MOCK temp_token for phone: ${phoneFromMock}`);
    } else {
      try {
        const jwt = require('jsonwebtoken');
        payload = jwt.verify(temp_token, JWT_SECRET);
      } catch (_) {
        return res.status(401).json(response.error('OTP token หมดอายุ กรุณายืนยัน OTP ใหม่'));
      }
    }

    if (!payload.otp_verified) return res.status(401).json(response.error('Token ไม่ถูกต้อง'));

    const phone = payload.phone;
    const { first_name, last_name } = profile;
    const password_hash = await bcrypt.hash(password, 10);
    const fakeEmail = `${phone.replace('+', '')}@agriprice.app`;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      let userId = null;

      // --- MOCK FLOW: Simplified & Robust ---
      if (String(temp_token).startsWith('mock_temp_token_')) {
        // พยายามหาไอดีจริงมาใช้เพื่อให้ผ่าน Foreign Key
        const existingAuth = await findAuthUserByPhone(phone);
        if (existingAuth) {
          userId = existingAuth.id;
          console.log(`[Auth] Mock Flow: Using existing ID ${userId}`);
        } else {
          // ถ้าไม่มีเบอร์นี้ใน Auth ให้ลองดึงใครก็ได้มาเป็นร่างทรง 1 คน
          const { data: all } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
          if (all?.users?.[0]) {
            userId = all.users[0].id;
            console.log(`[Auth] Mock Flow: Using placeholder ID ${userId}`);
          } else {
            // ถ้าในระบบยังไม่มี User เลยแม้แต่คนเดียว ต้องสมัครจริงก่อนครับ
            throw new Error('กรุณาสมัครสมาชิกด้วยเบอร์จริงอย่างน้อย 1 ครั้ง เพื่อเริ่มระบบฐานข้อมูลครับ');
          }
        }
      } else {
        const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
          email: fakeEmail,
          email_confirm: true,
          phone: phone,
          phone_confirm: true,
          password,
        }).catch(err => {
          console.error('[Auth] Supabase createUser error:', err.message);
          if (err.message.toLowerCase().includes('already exists')) {
            return findAuthUserByPhone(phone).then(u => {
              if (!u) throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ Auth');
              return { data: { user: u } };
            });
          }
          throw err;
        });

        if (!authUser || !authUser.user) {
          throw new Error('ระบบ Auth ขัดข้อง');
        }
        userId = authUser.user.id;
      }

      createdAuthUserId = userId;
      const defaultAvatar = getDefaultAvatarByRole(role);

      await client.query(
        `INSERT INTO profiles (profile_id, phone, first_name, last_name, role, password_hash, avatar, tier) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (profile_id) DO UPDATE SET 
           phone = EXCLUDED.phone,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role = EXCLUDED.role,
           password_hash = EXCLUDED.password_hash`,
        [userId, phone, first_name, last_name, role, password_hash, defaultAvatar, 'free']
      );

      await client.query('COMMIT');
      const token = signToken({ id: userId, phone, role, tier: 'free' });

      res.status(201).json({
        success: true,
        message: 'สมัครสมาชิกสำเร็จ',
        token,
        user: { id: userId, phone, role, tier: 'free', first_name: first_name, last_name: last_name, avatar: defaultAvatar, lat: profile.lat || null, lng: profile.lng || null }
      });
    } catch (err) {
      console.error('[Auth] REGISTER_FINISH_CRITICAL_ERROR:', err);
      if (client) await client.query('ROLLBACK');
      if (createdAuthUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId).catch(dErr => {
          console.error('[Auth] Rollback DeleteUser failed:', dErr.message);
        });
      }
      res.status(500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + (err.message || 'Unknown Server Error')));
    } finally {
      if (client) client.release();
    }
  } catch (e) {
    res.status(500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + e.message));
  }
});

/**
 * POST /api/auth/login
 * [Authentication Flow] เข้าสู่ระบบด้วยเบอร์โทรและรหัสผ่าน (ไม่ต้องใช้ OTP)
 */
router.post('/login', async (req, res) => {
  const loginSchema = Joi.object({
    phone: Joi.string().min(8).max(20),
    email: Joi.string().email(),
    password: Joi.string().min(8).max(100).required(),
  }).or('phone', 'email');

  const { error: schemaErr } = loginSchema.validate(req.body);
  if (schemaErr) return res.status(400).json(response.error('ข้อมูลไม่ถูกต้อง: ' + schemaErr.details[0].message));

  try {
    const { phone, email, password } = req.body;
    const identifier = phone || email;
    const searchPhone = toE164(identifier);

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, first_name, last_name, role, password_hash, tier, lat, lng')
      .eq('phone', searchPhone)
      .maybeSingle();

    if (!profile && identifier.includes('@')) {
      const { data: byEmail } = await supabaseAdmin
        .from('profiles')
        .select('profile_id, phone, first_name, last_name, role, password_hash, tier, lat, lng')
        .ilike('email', identifier.trim().toLowerCase())
        .maybeSingle();
      if (byEmail) profile = byEmail;
    }

    if (!profile || !profile.password_hash)
      return res.status(401).json(response.error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน'));

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) return res.status(401).json(response.error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง'));

    // [FIX] เช็คสถานะบัญชี (Deactivated)
    if (profile.account_status === 'disabled') {
      return res.status(401).json(response.error('บัญชีนี้ถูกปิดใช้งานอยู่ กรุณาติดต่อเจ้าหน้าที่'));
    }

    const token = signToken({ id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free' });
    const loginUser = { id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free', first_name: profile.first_name, last_name: profile.last_name, lat: profile.lat, lng: profile.lng };

    res.json(response.success("เข้าสู่ระบบสำเร็จ", { token, user: loginUser }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/auth/change-password
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json(response.error('กรุณากรอกรหัสผ่านให้ครบ'));

    if (new_password.length < 8)
      return res.status(400).json(response.error('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'));

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('password_hash').eq('profile_id', req.user.id).single();

    if (!profile) return res.status(404).json(response.error('ไม่พบบัญชี'));

    const valid = await bcrypt.compare(current_password, profile.password_hash);
    if (!valid) return res.status(401).json(response.error('รหัสผ่านปัจจุบันไม่ถูกต้อง'));

    const new_hash = await bcrypt.hash(new_password, 10);
    await supabaseAdmin.from('profiles').update({ password_hash: new_hash }).eq('profile_id', req.user.id);

    res.json(response.success('เปลี่ยนรหัสผ่านสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/auth/password/reset
 * [Authentication Flow] รีเซ็ตรหัสผ่านโดยใช้ temp_token จาก OTP
 */
router.post('/password/reset', async (req, res) => {
  try {
    const { temp_token, password } = req.body;
    if (!temp_token || !password) {
      return res.status(400).json(response.error('ข้อมูลไม่ครบถ้วน'));
    }

    if (password.length < 8) {
      return res.status(400).json(response.error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'));
    }

    let payload;
    // --- MOCK TOKEN BYPASS ---
    if (String(temp_token).startsWith('mock_temp_token_')) {
      const parts = temp_token.split('_');
      const phoneFromMock = parts[3] || 'unknown';
      payload = { phone: phoneFromMock, otp_verified: true };
    } else {
      try {
        const jwt = require('jsonwebtoken');
        payload = jwt.verify(temp_token, JWT_SECRET);
      } catch (_) {
        return res.status(401).json(response.error('Session หมดอายุ กรุณายืนยัน OTP ใหม่'));
      }
    }

    if (!payload.otp_verified) {
      return res.status(401).json(response.error('Token ไม่ถูกต้อง'));
    }

    const phone = toE164(payload.phone);
    const password_hash = await bcrypt.hash(password, 10);

    // อัปเดตรหัสผ่านใน profiles
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ password_hash })
      .eq('phone', phone);

    if (error) {
      throw error;
    }

    res.json(response.success('รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'));
  } catch (e) {
    console.error('[Auth] Password Reset Error:', e);
    res.status(500).json(response.error('รีเซ็ตรหัสผ่านไม่สำเร็จ: ' + e.message));
  }
});

module.exports = router;
