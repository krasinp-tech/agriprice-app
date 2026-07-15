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

    req.user = {
      id:    payload.id,
      phone: payload.phone,
      role:  payload.role,
      sessionId: payload.session_id ? String(payload.session_id) : null,
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
