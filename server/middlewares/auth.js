/**
 * middlewares/auth.js
 * ตรวจสอบ JWT token จาก Authorization header
 * ใส่ req.user = { id, phone, role } ถ้า token ถูกต้อง
 */
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../utils/supabase');

const JWT_SECRET = process.env.JWT_SECRET;

async function auth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน (ไม่พบ Authorization header)' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({ success: false, message: 'รูปแบบ token ไม่ถูกต้อง (ต้องเป็น Bearer <token>)' });
    }

    const token = parts[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'ไม่พบ token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    // A one-time sign-in refresh is required for tokens issued before
    // revocable device sessions were introduced.
    if (!payload.session_id) {
      return res.status(401).json({ success: false, code: 'SESSION_REFRESH_REQUIRED', message: 'กรุณาเข้าสู่ระบบใหม่เพื่อยืนยันอุปกรณ์' });
    }

    if (payload.session_id) {
      const { data: session, error } = await supabaseAdmin
        .from('device_sessions')
        .select('session_id')
        .eq('session_id', payload.session_id)
        .eq('user_id', payload.id)
        .maybeSingle();

      if (error) {
        console.error('[Auth] Device session check failed:', error.message);
        return res.status(503).json({ success: false, message: 'ไม่สามารถตรวจสอบเซสชันได้ กรุณาลองใหม่' });
      }
      if (!session) {
        return res.status(401).json({ success: false, code: 'SESSION_REVOKED', message: 'อุปกรณ์นี้ถูกออกจากระบบแล้ว' });
      }
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_status')
      .eq('profile_id', payload.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Auth] Account status check failed:', profileError.message);
      return res.status(503).json({ success: false, message: 'ไม่สามารถตรวจสอบสถานะบัญชีได้ กรุณาลองใหม่' });
    }
    if (!profile) {
      return res.status(401).json({ success: false, code: 'ACCOUNT_NOT_FOUND', message: 'ไม่พบบัญชีผู้ใช้' });
    }

    if (profile.account_status === 'disabled') {
      const requestPath = String(req.originalUrl || '').split('?')[0].replace(/\/$/, '');
      const isProfileRoot = requestPath === '/api/profile';
      const bodyKeys = Object.keys(req.body || {});
      const isReactivation = isProfileRoot
        && req.method === 'PATCH'
        && bodyKeys.length === 1
        && bodyKeys[0] === 'account_status'
        && req.body.account_status === 'active';
      const isRecoveryRequest = (isProfileRoot && ['GET', 'DELETE'].includes(req.method))
        || isReactivation
        || (requestPath === '/api/auth/logout' && req.method === 'POST');

      if (!isRecoveryRequest) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_DISABLED',
          message: 'บัญชีนี้ถูกปิดใช้งานอยู่ กรุณาเปิดใช้งานบัญชีก่อน'
        });
      }
    }

    req.user = {
      id:    payload.id,
      phone: payload.phone,
      role:  payload.role,
      sessionId: payload.session_id ? String(payload.session_id) : null,
      accountStatus: profile.account_status || 'active',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
    return res.status(401).json({ success: false, message: 'ไม่ได้รับอนุญาต' });
  }
}

module.exports = auth;
