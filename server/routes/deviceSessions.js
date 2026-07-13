const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const { getRequestIp } = require('../services/deviceSessionService');

function formatLastActive(dateStr) {
  if (!dateStr) return 'Unknown time';
  const timestamp = new Date(dateStr).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown time';

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

function pickCurrentSession(rows, req) {
  const ua = req.headers['user-agent'] || '';
  const ip = getRequestIp(req);

  return rows.find((d) => d.user_agent === ua && d.ip_address === ip)
    || rows.find((d) => d.user_agent === ua)
    || rows[0]
    || null;
}

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('device_sessions')
      .select('session_id, device_name, device_type, ip_address, user_agent, last_active, created_at')
      .eq('user_id', req.user.id)
      .order('last_active', { ascending: false })
      .limit(20);

    if (error) return res.status(500).json({ success: false, message: error.message });

    const rows = data || [];
    const currentSession = pickCurrentSession(rows, req);
    const result = rows.map((d) => ({
      id: d.session_id,
      name: d.device_name || 'Unknown Device',
      icon: d.device_type || 'devices_other',
      location: d.ip_address || 'Unknown location',
      last_active_text: formatLastActive(d.last_active),
      created_at: d.created_at,
      current: currentSession ? d.session_id === currentSession.session_id : false,
    }));

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/:id/logout', async (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const { password } = req.body;

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid session id' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('device_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (sessionErr) return res.status(500).json({ success: false, message: sessionErr.message });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('password_hash')
      .eq('profile_id', req.user.id)
      .maybeSingle();

    if (profileErr) return res.status(500).json({ success: false, message: profileErr.message });
    if (!profile?.password_hash) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('device_sessions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', req.user.id);

    if (deleteError) return res.status(500).json({ success: false, message: deleteError.message });

    res.json({ success: true, message: 'Device session logged out' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = { router };
