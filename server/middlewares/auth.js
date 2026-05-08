/**
 * middlewares/auth.js
 * ตรวจสอบ JWT token จาก Authorization header
 * ใส่ req.user = { id, phone, role } ถ้า token ถูกต้อง
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {
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
    req.user = {
      id:    payload.id,
      phone: payload.phone,
      role:  payload.role,
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