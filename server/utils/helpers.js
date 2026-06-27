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
  if (normalized === 'farmer') return 'assets/images/avatar-farmer.svg';
  if (normalized === 'buyer') return 'assets/images/avatar-buyer.svg';
  return 'assets/images/avatar-guest.svg';
}

function makeBookingNo() {
  const datePart = new Date().getTime().toString().slice(-4);
  const randPart = Math.floor(100 + Math.random() * 900);
  return `A${datePart}${randPart}`;
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

async function decrementSlotBookedCount(supabase, slotId) {
  if (!slotId) return;
  try {
    const { error: rpcErr } = await supabase.rpc('decrement_booked_count', { p_slot_id: slotId });
    if (rpcErr) {
      console.warn('⚠️  RPC decrement_booked_count ไม่พบ — ใช้ manual decrement แทน:', rpcErr.message);
      const { data: slotData } = await supabase
        .from('offer_slots')
        .select('booked_count')
        .eq('slot_id', slotId)
        .single();
      if (slotData) {
        const newCount = Math.max(0, (slotData.booked_count || 0) - 1);
        await supabase
          .from('offer_slots')
          .update({ booked_count: newCount })
          .eq('slot_id', slotId);
      }
    }
  } catch (err) {
    console.error('❌ decrementSlotBookedCount failed:', err.message);
  }
}

module.exports = {
  signToken,
  signTempToken,
  toE164,
  getDefaultAvatarByRole,
  makeBookingNo,
  getOptionalAuthUser,
  decrementSlotBookedCount,
  JWT_SECRET,
};
