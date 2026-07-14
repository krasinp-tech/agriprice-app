const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../utils/supabase');
const { toE164, signToken, signTempToken, getDefaultAvatarByRole } = require('../utils/helpers');

const DEV_OTP_MODE = process.env.OTP_MOCK === 'true';

class AuthService {
  async getRegisteredProfileByPhone(phone) {
    const cleanPhone = toE164(phone);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, first_name, last_name, role, tier, password_hash')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.password_hash) return null;
    return data;
  }

  async checkPhoneAvailability(phone) {
    const cleanPhone = toE164(phone);
    const profile = await this.getRegisteredProfileByPhone(cleanPhone);
    return {
      phone: cleanPhone,
      available: !profile,
      exists: !!profile,
      user: profile ? {
        id: profile.profile_id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        tier: profile.tier || 'free'
      } : null
    };
  }

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
    // Real OTP is sent by Firebase on the client/native layer.
    // This endpoint is kept as a lightweight compatibility preflight.
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
    const { getApps } = require('firebase-admin/app');
    
    // โหลดและ Initialize Firebase Admin แบบ On-demand หากมี PROJECT_ID แต่ยังไม่ถูกสร้าง
    if (getApps().length === 0 && process.env.FIREBASE_PROJECT_ID) {
      try {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } catch (err) {
        console.error('[AuthService] Failed to initialize Firebase Admin on-demand:', err.message);
      }
    }
    
    // Check if firebase admin has been initialized
    let firebaseVerified = false;
    let decodedPhone = null;

    if (getApps().length > 0) {
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        decodedPhone = decodedToken.phone_number;
        firebaseVerified = true;
      } catch (err) {
        console.warn('[AuthService] Firebase ID Token verification via Admin SDK failed, trying manual fallback...', err.message);
      }
    }

    // Manual verification fallback (useful for local dev without service account JSON)
    if (!firebaseVerified) {
      try {
        const projectId = process.env.FIREBASE_PROJECT_ID || 'agriprice-otp';
        const decodedHeader = jwt.decode(idToken, { complete: true });
        if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
          throw new Error('Invalid token structure');
        }

        const kid = decodedHeader.header.kid;
        const resPublicKeys = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
        if (!resPublicKeys.ok) {
          throw new Error('Failed to fetch Firebase public keys');
        }
        const keys = await resPublicKeys.json();
        const cert = keys[kid];
        if (!cert) {
          throw new Error('Public key not found for kid: ' + kid);
        }

        const decoded = jwt.verify(idToken, cert, {
          audience: projectId,
          issuer: `https://securetoken.google.com/${projectId}`,
          algorithms: ['RS256']
        });

        decodedPhone = decoded.phone_number;
        firebaseVerified = true;
      } catch (manualErr) {
        console.error('[AuthService] Manual Firebase verification failed:', manualErr.message);
        throw new Error('การยืนยันตัวตนกับ Firebase ล้มเหลว: ' + manualErr.message);
      }
    }

    if (!firebaseVerified || !decodedPhone) {
      throw new Error('ไม่สามารถตรวจสอบสิทธิ์กับ Firebase ได้');
    }

    const firebasePhone = toE164(decodedPhone);
    if (firebasePhone !== cleanPhone) {
      throw new Error(`เบอร์โทรศัพท์ไม่ตรงกับในระบบ Firebase (${firebasePhone} vs ${cleanPhone})`);
    }
    verifiedPhone = firebasePhone;

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

      if (!decoded.phone || !decoded.otp_verified) throw new Error('Invalid token payload (missing phone or verified status)');
      verifiedPhone = decoded.phone;
    } catch (err) {
      console.error('[AuthService] Token Verification Failed:', err.message);
      throw new Error('Token ยืนยัน OTP หมดอายุหรือไมถูกต้อง');
    }

    const registeredProfile = await this.getRegisteredProfileByPhone(verifiedPhone);
    if (registeredProfile) {
      const err = new Error('เบอร์โทรนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่');
      err.statusCode = 409;
      throw err;
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
        lat: profile.lat !== undefined ? profile.lat : null,
        lng: profile.lng !== undefined ? profile.lng : null,
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

  async passwordReset(tempToken, password) {
    if (!tempToken) throw new Error('ไม่พบ Token ยืนยัน OTP');

    let verifiedPhone;
    try {
      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (!decoded.phone || !decoded.otp_verified) {
        throw new Error('Invalid token payload');
      }
      verifiedPhone = decoded.phone;
    } catch (err) {
      console.error('[AuthService] Token Verification Failed:', err.message);
      throw new Error('Token ยืนยัน OTP หมดอายุหรือไมถูกต้อง');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('profile_id')
      .eq('phone', verifiedPhone)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!profile) throw new Error('ไม่พบข้อมูลบัญชีผู้ใช้งาน');

    const userId = profile.profile_id;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: password
    });
    if (authErr) {
      console.warn('[AuthService] Failed to update Supabase Auth password:', authErr.message);
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ password_hash: passwordHash })
      .eq('profile_id', userId);

    if (updateErr) throw updateErr;

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const { data: profile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('password_hash')
      .eq('profile_id', userId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!profile) throw new Error('ไม่พบข้อมูลบัญชีผู้ใช้งาน');

    if (!profile.password_hash) {
      throw new Error('บัญชีนี้ยังไม่ได้ตั้งค่ารหัสผ่าน');
    }

    const valid = await bcrypt.compare(currentPassword, profile.password_hash);
    if (!valid) {
      throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password in Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });
    if (authErr) {
      console.warn('[AuthService] Failed to update Supabase Auth password during changePassword:', authErr.message);
    }

    // Update in profiles table
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ password_hash: passwordHash })
      .eq('profile_id', userId);

    if (updateErr) throw updateErr;

    return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
  }

  async login(identifier, password) {
    const cleanId = (identifier || '').trim();

    const isEmail = cleanId.includes('@');
    const rawDigits = cleanId.replace(/\D/g, '');

    let profile = null;
    if (!isEmail) {
      if (rawDigits.length < 6) {
        throw new Error('Account not found');
      }

      const phoneCandidates = [...new Set([toE164(rawDigits), rawDigits].filter(Boolean))];
      const { data: exactRows, error: exactError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('phone', phoneCandidates)
        .limit(2);

      if (exactError) console.error('[AuthService] DB Error:', exactError);
      if (Array.isArray(exactRows) && exactRows.length === 1) {
        profile = exactRows[0];
      }

      if (!profile && rawDigits.length >= 8) {
        const { data: partialRows, error: partialError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .ilike('phone', `%${rawDigits}%`)
          .limit(2);

        if (partialError) console.error('[AuthService] DB Error:', partialError);
        if (Array.isArray(partialRows) && partialRows.length === 1) {
          profile = partialRows[0];
        }
      }
    }

    if (!profile && isEmail) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', cleanId.toLowerCase())
        .maybeSingle();
      profile = data;
    }

    if (!profile) {
      throw new Error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
    }

    if (!profile.password_hash) {
      throw new Error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน');
    }

    if (profile.account_status === 'disabled') throw new Error('บัญชีนี้ถูกปิดใช้งานอยู่');

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      throw new Error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง');
    }

    const token = signToken({ id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free' });
    return {
      token,
      user: { id: profile.profile_id, phone: profile.phone, role: profile.role, tier: profile.tier || 'free', first_name: profile.first_name, last_name: profile.last_name }
    };
  }
}

module.exports = new AuthService();
