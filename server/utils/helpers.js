const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signTempToken(phone) {
  return jwt.sign({ phone, otp_verified: true }, JWT_SECRET, { expiresIn: '10m' });
}

function toE164(phone) {
  if (!phone) return phone;
  const d = String(phone).replace(/\D/g, '');
  if (d.startsWith('66')) return '+' + d;
  if (d.startsWith('0'))  return '+66' + d.slice(1);
  return '+' + d;
}

function getDefaultAvatarByRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'farmer') return '/assets/images/avatar-farmer.svg';
  if (normalized === 'buyer') return '/assets/images/avatar-buyer.svg';
  return '/assets/images/avatar-guest.svg';
}

function makeBookingNo() {
  const randPart = Math.floor(1000 + Math.random() * 9000);
  return `A${randPart}`;
}

function getOptionalAuthUser(req) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return null;
    const parts = String(authHeader).split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) return null;
    const payload = jwt.verify(parts[1], JWT_SECRET);
    return { id: payload.id, phone: payload.phone, role: payload.role };
  } catch (_) {
    return null;
  }
}

module.exports = {
  signToken,
  signTempToken,
  toE164,
  getDefaultAvatarByRole,
  makeBookingNo,
  getOptionalAuthUser,
  JWT_SECRET,
};
