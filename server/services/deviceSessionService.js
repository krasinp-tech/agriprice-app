/**
 * services/deviceSessionService.js
 * บันทึกข้อมูลอุปกรณ์ที่เข้าสู่ระบบ (Device Session)
 * แยกออกมาจาก routes/deviceSessions.js เพื่อป้องกัน circular dependency
 */

function parseUserAgent(ua) {
  const s = String(ua || '').toLowerCase();

  if (s.includes('ipad')) return { name: 'iPad', icon: 'tablet_mac' };
  if (s.includes('iphone') || s.includes('ipod')) return { name: 'iPhone', icon: 'phone_iphone' };
  if (s.includes('android') && s.includes('mobile')) return { name: 'Android Phone', icon: 'smartphone' };
  if (s.includes('android')) return { name: 'Android Tablet', icon: 'tablet_android' };
  if (s.includes('windows')) return { name: 'Windows PC', icon: 'computer' };
  if (s.includes('macintosh') || s.includes('mac os')) return { name: 'Mac', icon: 'laptop_mac' };
  if (s.includes('linux')) return { name: 'Linux', icon: 'computer' };
  return { name: 'Unknown Device', icon: 'devices_other' };
}

function getRequestIp(req) {
  return req.ip || req.connection?.remoteAddress || '';
}

async function recordDeviceSession(supabase, userId, req) {
  try {
    const ua = req.headers['user-agent'] || '';
    const ip = getRequestIp(req);
    const { name, icon } = parseUserAgent(ua);

    await supabase.from('device_sessions').insert({
      user_id: userId,
      device_name: name,
      device_type: icon,
      ip_address: ip,
      user_agent: ua,
      last_active: new Date().toISOString(),
    });
  } catch (_) {
    // Device-session recording must not block login.
  }
}

module.exports = { recordDeviceSession, getRequestIp };
