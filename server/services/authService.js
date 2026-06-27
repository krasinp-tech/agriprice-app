const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../utils/supabase');
const { toE164, signToken, signTempToken, getDefaultAvatarByRole } = require('../utils/helpers');

const DEV_OTP_MODE = process.env.OTP_MOCK === 'true';

class AuthService {
  async findAuthUserByPhone(phone) {
    const cleanPhone = toE164(phone);
    let page = 1;
    const perPage = 100;
    while (page <= 20) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users || [];
      const found = users.find(user => toE164(user.phone || '') === cleanPhone);
      if (found) return found;
      if (users.length < perPage) return null;
      page += 1;
    }
    return null;
  }

  async sendOtp(phone) {
    const cleanPhone = toE164(phone);
    if (DEV_OTP_MODE) {
      return { success: true, message: 'ส่ง OTP แล้ว (Mock Mode)' };
    }
    // สำหรับโหมด Real: เนื่องจากฝั่ง Client (เว็บ/Capacitor) จะใช้ Firebase Phone Auth ส่ง SMS เอง
    // ตัว Backend จึงไม่ต้องส่งผ่าน Supabase เพื่อหลีกเลี่ยงความขัดแย้งและข้อผิดพลาดของการไม่ได้เปิดใช้งาน SMS ใน Supabase
    // ให้ผ่านฉลุยเพื่อให้ Frontend สามารถเริ่มกระบวนการส่ง OTP ทาง Firebase ได้ทันที
    return { success: true, message: 'ส่ง OTP แล้ว' };
  }

  async verifyOtp(phone, otp) {
    const cleanPhone = toE164(phone);
    if (!DEV_OTP_MODE) {
      const { error } = await supabase.auth.verifyOtp({ phone: cleanPhone, token: otp, type: 'sms' });
      if (error) throw new Error(error.message);
    }

    const [profileResult, authUser] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('profile_id, first_name, last_name, role, tier, password_hash')
        .eq('phone', cleanPhone)
        .maybeSingle(),
      this.findAuthUserByPhone(cleanPhone),
    ]);

    const existing = profileResult?.data || null;
    const hasRegisteredProfile = !!(existing && existing.password_hash);
    const isNewUser = !hasRegisteredProfile;
    const temp_token = signTempToken(cleanPhone);

    return {
      verified: true,
      temp_token,
      isNewUser,
      user: existing
    };
  }

  async verifyFirebaseOtp(idToken, phone) {
    const cleanPhone = toE164(phone);
    let verifiedPhone = cleanPhone;

    // 1. Verify token with firebase-admin
    const admin = require('firebase-admin');
    
    // โหลดและ Initialize Firebase Admin แบบ On-demand หากมี PROJECT_ID แต่ยังไม่ถูกสร้าง
    if (admin.apps.length === 0 && process.env.FIREBASE_PROJECT_ID) {
      try {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        console.log('[AuthService] Initialized Firebase Admin on-demand using Project ID:', process.env.FIREBASE_PROJECT_ID);
      } catch (err) {
        console.error('[AuthService] Failed to initialize Firebase Admin on-demand:', err.message);
      }
    }
    
    // Check if firebase admin has been initialized
    let firebaseVerified = false;
    if (admin.apps.length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const firebasePhone = toE164(decodedToken.phone_number);
        
        if (firebasePhone !== cleanPhone) {
          throw new Error(`เบอร์โทรศัพท์ไม่ตรงกับในระบบ Firebase (${firebasePhone} vs ${cleanPhone})`);
        }
        verifiedPhone = firebasePhone;
        firebaseVerified = true;
      } catch (err) {
        console.error('[AuthService] Firebase ID Token verification failed:', err.message);
        throw new Error('การยืนยันตัวตนกับ Firebase ล้มเหลว: ' + err.message);
      }
    } else {
      // Fallback/Mock mode if Firebase Admin is not configured but client sent some token
      console.warn('[AuthService] Firebase Admin not initialized, verifying mock-style');
      firebaseVerified = true;
    }

    if (!firebaseVerified) {
      throw new Error('ไม่สามารถตรวจสอบสิทธิ์กับ Firebase ได้');
    }

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('profile_id, first_name, last_name, role, tier, password_hash')
      .eq('phone', verifiedPhone)
      .maybeSingle();

    if (profileResult.error) throw profileResult.error;

    const existing = profileResult?.data || null;
    const hasRegisteredProfile = !!(existing && existing.password_hash);
    const isNewUser = !hasRegisteredProfile;
    const temp_token = signTempToken(verifiedPhone);

    return {
      verified: true,
      temp_token,
      isNewUser,
      user: existing
    };
  }

  async registerFinish({ temp_token, role, profile, password }) {
    if (!temp_token) throw new Error('ไม่พบ Token ยืนยัน OTP');

    let verifiedPhone;
    try {
      const decoded = jwt.verify(temp_token, process.env.JWT_SECRET);
      console.log('[AuthService] Decoded temp_token:', { phone: decoded.phone, verified: decoded.otp_verified });

      if (!decoded.phone || !decoded.otp_verified) throw new Error('Invalid token payload (missing phone or verified status)');
      verifiedPhone = decoded.phone;
    } catch (err) {
      console.error('[AuthService] Token Verification Failed:', err.message);
      throw new Error('Token ยืนยัน OTP หมดอายุหรือไมถูกต้อง');
    }

    const password_hash = await bcrypt.hash(password, 10);
    const fakeEmail = `${verifiedPhone.replace('+', '')}@agriprice.app`;

    const { data: authUser, error: supaErr } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      phone: verifiedPhone,
      phone_confirm: true,
      password,
    });

    let userId = null;
    if (supaErr) {
      const msg = supaErr.message.toLowerCase();
      if (msg.includes('already exists') || msg.includes('already been registered')) {
        const u = await this.findAuthUserByPhone(verifiedPhone);
        if (!u) throw new Error('ผู้ใช้นี้มีอยู่ในระบบแล้ว แต่ไม่สามารถดึงข้อมูลได้');
        userId = u.id;
      } else {
        throw new Error(supaErr.message);
      }
    } else {
      userId = authUser.user.id;
    }

    const defaultAvatar = getDefaultAvatarByRole(role);

    const { error: upsertErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        profile_id: userId,
        phone: verifiedPhone,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role,
        password_hash,
        avatar: defaultAvatar,
        tier: 'free',
        email: profile.email || null,
      }, { onConflict: 'profile_id' });

    if (upsertErr) {
      // Don't delete auth user if they already existed (e.g. partial registration)
      // but if we just created them, we might want to cleanup.
      // For simplicity, we just throw.
      throw new Error(upsertErr.message);
    }

    const token = signToken({ id: userId, phone: verifiedPhone, role, tier: 'free' });
    return {
      token,
      user: { id: userId, phone: verifiedPhone, role, tier: 'free', first_name: profile.first_name, last_name: profile.last_name, avatar: defaultAvatar }
    };
  }

  async login(identifier, password) {
    const cleanId = (identifier || '').trim();
    console.log('[AuthService] Login attempt for:', cleanId);

    const isEmail = cleanId.includes('@');
    const searchPhone = isEmail ? null : toE164(cleanId);
    const rawDigits = cleanId.replace(/\D/g, '');

    let profile = null;
    if (searchPhone) {
      console.log('[AuthService] Searching for phone variations:', searchPhone, rawDigits);

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(`phone.eq."${searchPhone}",phone.eq."${rawDigits}",phone.ilike."%${rawDigits}%"`)
        .maybeSingle();

      if (error) console.error('[AuthService] DB Error:', error);
      profile = data;
    }

    if (!profile && isEmail) {
      console.log('[AuthService] Searching for email:', cleanId);
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', cleanId.toLowerCase())
        .maybeSingle();
      profile = data;
    }

    if (!profile) {
      console.log('[AuthService] Profile not found');
      throw new Error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
    }

    if (!profile.password_hash) {
      console.log('[AuthService] Profile has no password_hash (null or empty)');
      throw new Error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
    }

    console.log('[AuthService] Found profile, hash length:', profile.password_hash.length);
    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      console.log('[AuthService] Invalid password');
      throw new Error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง');
    }

    if (profile.account_status === 'disabled') throw new Error('บัญชีนี้ถูกปิดใช้งานอยู่');

    console.log('[AuthService] Login successful for:', profile.profile_id);
    const token = signToken({ id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free' });
    return {
      token,
      user: { id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free', first_name: profile.first_name, last_name: profile.last_name }
    };
  }
}

module.exports = new AuthService();
