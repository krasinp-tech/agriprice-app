const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const response = require('../response');
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
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';

// Rate limit OTP send: 5 requests per 10 min per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'ขอ OTP ได้สูงสุด 5 ครั้งใน 10 นาที กรุณารอ' },
});

// Helper for finding auth user (was internal to server.js)
async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 100;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(user => String(user.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
}

/**
 * POST /api/auth/otp/send
 */
router.post('/otp/send', otpLimiter, async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json(response.error('กรุณาระบุเบอร์โทรศัพท์'));
    phone = toE164(phone);

    if (DEV_OTP_MODE) {
      // Mock OTP bypass
    } else {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) return res.status(400).json(response.error(error.message));
    }
    res.json(response.success('ส่ง OTP แล้ว'));
  } catch (e) {
    res.status(500).json(response.error('ส่ง OTP ไม่สำเร็จ'));
  }
});

/**
 * POST /api/auth/otp/verify
 */
router.post('/otp/verify', async (req, res) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json(response.error('กรุณาระบุ phone และ otp'));
    phone = toE164(phone);

    if (DEV_OTP_MODE) {
      if (String(otp) !== '123456') return res.status(400).json(response.error('OTP ไม่ถูกต้อง'));
    } else {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (error) return res.status(400).json(response.error(error.message));
    }

    const { data: existing } = await supabaseAdmin
      .from('profiles').select('profile_id, first_name, role').eq('phone', phone).maybeSingle();

    const isNewUser = !existing;
    const temp_token = signTempToken(phone);

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
 * POST /api/auth/register/finish
 */
router.post('/register/finish', async (req, res) => {
  let createdAuthUserId = null;
  try {
    const { error: schemaErr, value: validBody } = registerSchema.validate(req.body);
    if (schemaErr) return res.status(400).json(response.error(schemaErr.details[0].message));

    const { temp_token, role, profile, password } = validBody;
    let payload;
    try {
      const jwt = require('jsonwebtoken');
      payload = jwt.verify(temp_token, JWT_SECRET);
    } catch (_) {
      return res.status(401).json(response.error('OTP token หมดอายุ กรุณายืนยัน OTP ใหม่'));
    }
    
    if (!payload.otp_verified) return res.status(401).json(response.error('Token ไม่ถูกต้อง'));
    
    const phone = payload.phone;
    const { firstName, lastName } = profile;
    const password_hash = await bcrypt.hash(password, 10);
    const fakeEmail = `${phone.replace('+', '')}@agriprice.app`;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        phone: phone,
        phone_confirm: true,
        password,
      }).catch(err => {
         // Fallback if already exists
         if (err.message.includes('already exists')) return findAuthUserByEmail(fakeEmail).then(u => ({ data: { user: u } }));
         throw err;
      });

      const userId = authUser.user.id;
      createdAuthUserId = userId;
      const defaultAvatar = getDefaultAvatarByRole(role);

      await client.query(
        'INSERT INTO profiles (profile_id, phone, first_name, last_name, role, password_hash, avatar) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [userId, phone, firstName, lastName, role, password_hash, defaultAvatar]
      );

      await client.query('COMMIT');
      const token = signToken({ id: userId, phone, role });

      res.status(201).json(response.success('สมัครสมาชิกสำเร็จ', {
        token,
        user: { id: userId, phone, role, name: `${firstName} ${lastName}`, avatar: defaultAvatar }
      }));
    } catch (err) {
      await client.query('ROLLBACK');
      if (createdAuthUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId).catch(() => {});
      }
      res.status(500).json(response.error(err.message));
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + e.message));
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  const loginSchema = Joi.object({
    phone: Joi.string().min(8).max(20),
    email: Joi.string().email(),
    password: Joi.string().min(8).max(100).required(),
  }).or('phone','email');

  const { error: schemaErr } = loginSchema.validate(req.body);
  if (schemaErr) return res.status(400).json(response.error('ข้อมูลไม่ถูกต้อง: ' + schemaErr.details[0].message));

  try {
    const { phone, email, password } = req.body;
    const identifier = phone || email;
    const searchPhone = toE164(identifier);

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, first_name, last_name, role, password_hash')
      .eq('phone', searchPhone)
      .maybeSingle();

    if (!profile && identifier.includes('@')) {
      const { data: byEmail } = await supabaseAdmin
        .from('profiles')
        .select('profile_id, phone, first_name, last_name, role, password_hash')
        .ilike('email', identifier.trim().toLowerCase())
        .maybeSingle();
      if (byEmail) profile = byEmail;
    }

    if (!profile || !profile.password_hash)
      return res.status(401).json(response.error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน'));

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) return res.status(401).json(response.error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง'));

    const token = signToken({ id: profile.profile_id, phone: profile.phone, role: profile.role });
    const loginUser = { id: profile.profile_id, phone: profile.phone, role: profile.role, name: `${profile.first_name} ${profile.last_name}` };

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

module.exports = router;
