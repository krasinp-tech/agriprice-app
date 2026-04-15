/**
 * routes/deviceSessions.js
 * GET  /api/device-sessions          → รายการ session อุปกรณ์ของ user
 * POST /api/device-sessions/:id/logout → ลบ session อุปกรณ์นั้น (ต้องใส่รหัสผ่าน)
 *
 * วิธีใช้ใน server.js:
 *   const deviceSessionsRouter = require('./routes/deviceSessions');
 *   app.use('/api/device-sessions', auth, deviceSessionsRouter);
 *
 * วิธีบันทึก session ตอน login — เพิ่มใน route POST /api/auth/login หลัง signToken():
 *   await recordDeviceSession(supabaseAdmin, profile.profile_id, req);
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Helper: แปลง User-Agent → ชื่ออุปกรณ์ + icon ──────────────────────────
function parseUserAgent(ua) {
  const s = String(ua || '').toLowerCase();

  if (s.includes('ipad'))                              return { name: 'iPad',          icon: 'tablet_mac'    };
  if (s.includes('iphone') || s.includes('ipod'))     return { name: 'iPhone',         icon: 'phone_iphone'  };
  if (s.includes('android') && s.includes('mobile'))  return { name: 'Android Phone',  icon: 'smartphone'    };
  if (s.includes('android'))                           return { name: 'Android Tablet', icon: 'tablet_android'};
  if (s.includes('windows'))                           return { name: 'Windows PC',     icon: 'computer'      };
  if (s.includes('macintosh') || s.includes('mac os')) return { name: 'Mac',           icon: 'laptop_mac'    };
  if (s.includes('linux'))                             return { name: 'Linux',          icon: 'computer'      };
  return { name: 'Unknown Device', icon: 'devices_other' };
}

// ─── Helper: แปลง last_active → ข้อความภาษาไทย ─────────────────────────────
function formatLastActive(dateStr) {
  if (!dateStr) return 'ไม่ระบุเวลา';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)   return 'เมื่อกี้';
  if (minutes < 60)  return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

// ─── Exported helper: เรียกจาก login route ──────────────────────────────────
async function recordDeviceSession(supabase, userId, req) {
  try {
    const ua       = req.headers['user-agent'] || '';
    const ip       = req.ip || req.connection?.remoteAddress || '';
    const { name, icon } = parseUserAgent(ua);

    await supabase.from('device_sessions').insert({
      user_id:     userId,
      device_name: name,
      device_type: icon,
      ip_address:  ip,
      user_agent:  ua,
      last_active: new Date().toISOString(),
    });
  } catch (_) {
    // ไม่ให้ error นี้ทำให้ login ล้มเหลว
  }
}

// ─── GET /api/device-sessions ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('device_sessions')
      .select('session_id, device_name, device_type, ip_address, last_active, created_at')
      .eq('user_id', req.user.id)
      .order('last_active', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ success: false, message: error.message });

    const result = (data || []).map(d => ({
      id:               d.session_id,
      name:             d.device_name || 'Unknown Device',
      icon:             d.device_type || 'devices_other',
      location:         d.ip_address  || 'Unknown location',
      last_active_text: formatLastActive(d.last_active),
      created_at:       d.created_at,
      current:          false, // frontend จัดการ current device เองอยู่แล้ว
    }));

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── POST /api/device-sessions/:id/logout ────────────────────────────────────
router.post('/:id/logout', async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'กรุณาใส่รหัสผ่าน' });
    }

    // ตรวจสอบว่า session นั้นเป็นของ user คนนี้จริง
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('device_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (sessionErr || !session) {
      return res.status(404).json({ success: false, message: 'ไม่พบ session นี้' });
    }

    // ตรวจสอบรหัสผ่าน
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('password_hash')
      .eq('profile_id', req.user.id)
      .single();

    if (!profile?.password_hash) {
      return res.status(404).json({ success: false, message: 'ไม่พบบัญชี' });
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
    }

    // ลบ session
    await supabaseAdmin
      .from('device_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', req.user.id);

    res.json({ success: true, message: 'ออกจากระบบอุปกรณ์นั้นแล้ว' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { router, recordDeviceSession };