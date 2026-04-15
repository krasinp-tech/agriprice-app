// ============================================================
// ROUTES — DEVICE SESSIONS
// ============================================================

/**
 * ============================================================
 * AGRIPRICE BACKEND — server.js v2
 * Express + Supabase + bcryptjs + JWT
 *
 * Auth Flow:
 *   สมัครใหม่ : phone → OTP → กรอกชื่อ/role/password → เสร็จ
 *   เข้าสู่ระบบ: phone + password → token
 *
 * ตั้งค่า:
 *   1. npm install
 *   2. cp .env.example .env  แล้วเติมค่า
 *   3. รัน schema.sql ใน Supabase SQL Editor
 *   4. npm run dev
 * ============================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const response = require('./response');
const express = require('express');
const fs      = require('fs');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
// Modular imports
const { logRequestMiddleware, logErrorMiddleware } = require('./middlewares/log');
const auth = require('./middlewares/auth');
const { router: deviceSessionsRouter, recordDeviceSession } = require('./routes/deviceSessions');
const upload = require('./middlewares/upload');
const logger = require('./utils/logger');
const { saveFile } = require('./services/fileService');
const bookingSchema = require('./validators/booking');
const registerSchema = require('./validators/register');
const { v4: uuidv4 } = require('uuid');

// ── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL  = process.env.SUPABASE_URL;
const ANON_KEY      = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('❌  ยังไม่ได้ตั้งค่า .env กรุณาคัดลอก .env.example → .env แล้วเติมค่า Supabase');
  process.exit(1);
}

const supabase      = createClient(SUPABASE_URL, ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── JWT ───────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  throw new Error('❌ ต้องตั้งค่า JWT_SECRET ใน .env');
}
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signTempToken(phone) {
  // token ชั่วคราว 10 นาที สำหรับ OTP → register/finish
  return jwt.sign({ phone, otp_verified: true }, JWT_SECRET, { expiresIn: '10m' });
}

function makeBookingNo() {
  const timePart = Date.now().toString(36).toUpperCase().slice(-2);
  const randPart = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `${timePart}${randPart}`;
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

const AUTO_SUCCESS_DELAY_MIN = Number(process.env.BOOKING_AUTO_SUCCESS_DELAY_MIN || 5);
const AUTO_SUCCESS_SCAN_MS = Math.max(15, Number(process.env.BOOKING_AUTO_SUCCESS_SCAN_SEC || 60)) * 1000;
const AUTO_SUCCESS_DEBUG = String(process.env.BOOKING_AUTO_SUCCESS_DEBUG || 'true').toLowerCase() === 'true';

async function autoCompleteDueBookings() {
  try {
    const cutoff = new Date(Date.now() - AUTO_SUCCESS_DELAY_MIN * 60 * 1000).toISOString();
    if (AUTO_SUCCESS_DEBUG) {
      logger.info(`[auto-booking-success] scan started cutoff=${cutoff}`);
    }
    const { data: dueRows, error: dueErr } = await supabaseAdmin
      .from('bookings')
      .select('booking_id,status,scheduled_time')
      .eq('status', 'waiting')
      .lte('scheduled_time', cutoff)
      .order('scheduled_time', { ascending: true })
      .limit(300);

    if (dueErr) {
      logger.warn('[auto-booking-success] failed to load due rows: ' + dueErr.message);
      return;
    }
    if (AUTO_SUCCESS_DEBUG) {
      logger.info(`[auto-booking-success] due rows=${Array.isArray(dueRows) ? dueRows.length : 0}`);
    }
    if (!Array.isArray(dueRows) || dueRows.length === 0) return;

    const ids = dueRows.map((r) => r.booking_id).filter((v) => Number.isFinite(Number(v)));
    if (!ids.length) return;

    const { data: updatedRows, error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'success' })
      .in('booking_id', ids)
      .eq('status', 'waiting')
      .select('booking_id');

    if (updErr) {
      logger.warn('[auto-booking-success] failed to update rows: ' + updErr.message);
      return;
    }

    const updated = Array.isArray(updatedRows) ? updatedRows : [];
    if (!updated.length) return;

    for (const row of updated) {
      try {
        await db.query(
          'INSERT INTO booking_status_logs (booking_id, old_status, new_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)',
          [row.booking_id, 'waiting', 'success', null, 'auto-complete after scheduled time + delay']
        );
      } catch (_) {
        // skip log errors to keep auto-complete running
      }
    }

    logger.info(`[auto-booking-success] completed ${updated.length} booking(s)`);
  } catch (err) {
    logger.warn('[auto-booking-success] unexpected error: ' + (err?.message || err));
  }
}

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 100;
  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(user => String(user.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
}

// ── OTP store (in-memory) ─────────────────────────────────────
const otpStore  = new Map();   // phone → { code, expiresAt, used }
const OTP_MOCK  = process.env.OTP_MOCK !== 'false';   // default: true
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const UPLOAD_MODE = process.env.UPLOAD_MODE || 'supabase-storage';

// ── Express ───────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS Configuration ─────────────────────────────────────────
let corsOrigin = process.env.CORS_ORIGIN;
if (!corsOrigin || corsOrigin === '*') {
  if (process.env.NODE_ENV === 'development') {
    corsOrigin = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ].join(',');
    console.warn('⚠️ DEV fallback CORS_ORIGIN: ' + corsOrigin);
  } else {
    throw new Error('❌ ต้องตั้งค่า CORS_ORIGIN ใน .env และห้ามใช้ * ใน production');
  }
}
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = corsOrigin.split(',').map(o => o.trim());
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(logRequestMiddleware);
app.use('/api/device-sessions', auth, deviceSessionsRouter);

// ── Announcements ─────────────────────────────────────────────
// ── Upload (static files สำหรับ local mode) ──────────────────
if ((process.env.UPLOAD_MODE || 'supabase-storage') === 'local') {
  const UPLOAD_DIR_STATIC = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
  fs.mkdirSync(UPLOAD_DIR_STATIC, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR_STATIC));
}

// ── Helper ────────────────────────────────────────────────────
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

const THAI_ANNOUNCEMENT_FEEDS = [
  { name: 'กระทรวงเกษตรและสหกรณ์', url: 'https://www.moac.go.th/site-home' },
  { name: 'กรมส่งเสริมการเกษตร', url: 'https://www.doae.go.th/home-new-2024/' },
  { name: 'กรมวิชาการเกษตร', url: 'https://www.doa.go.th/' },
  { name: 'สำนักงานเศรษฐกิจการเกษตร', url: 'https://www.oae.go.th/' },
];

const THAI_GOV_ALLOWED_HOST_SUFFIXES = ['go.th'];

const THAI_ANNOUNCEMENT_KEYWORDS = [
  'ผลไม้', 'เกษตร', 'พืชสวน', 'พืชไร่', 'สวน', 'ทุเรียน', 'มังคุด', 'เงาะ',
  'ลองกอง', 'ลำไย', 'ลิ้นจี่', 'สับปะรด', 'ยางพารา', 'ปาล์ม', 'มันสำปะหลัง',
  'อ้อย', 'ข้าวโพด', 'พริก', 'มะพร้าว', 'ไม้ผล', 'พืชพันธุ์', 'เกษตรกร',
];

let thaiAnnouncementCache = {
  expiresAt: 0,
  items: [],
};

function decodeXmlEntities(input) {
  return String(input || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/');
}

function stripHtml(input) {
  return String(input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickFirstTag(itemXml, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = itemXml.match(re);
    if (match && match[1]) return decodeXmlEntities(stripHtml(match[1]));
  }
  return '';
}

function normalizePublishedAt(value) {
  const ts = Date.parse(value || '');
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
}

function looksLikeThaiAgriNews(title, summary) {
  const haystack = `${title || ''} ${summary || ''}`.toLowerCase();
  return THAI_ANNOUNCEMENT_KEYWORDS.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
}

function isThaiGovernmentUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const host = String(parsed.hostname || '').toLowerCase();
    return THAI_GOV_ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch (_) {
    return false;
  }
}

function parseRssItems(xml, sourceName) {
  const items = [];
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const chunks = String(xml || '').match(itemRegex) || [];

  for (const chunk of chunks) {
    const title = pickFirstTag(chunk, ['title']);
    const link = pickFirstTag(chunk, ['link']);
    const summary = pickFirstTag(chunk, ['description', 'content:encoded']);
    const publishedAt = normalizePublishedAt(pickFirstTag(chunk, ['pubDate', 'dc:date']));
    const source = pickFirstTag(chunk, ['source']) || sourceName || 'ข่าวไทย';

    if (!title || !link) continue;
    items.push({ title, link, summary, source, publishedAt });
  }

  return items;
}

function parseHtmlNewsItems(html, feedUrl, sourceName) {
  const items = [];
  const seen = new Set();
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRegex.exec(String(html || ''))) && items.length < 80) {
    const rawHref = decodeXmlEntities(match[1] || '').trim();
    const rawText = decodeXmlEntities(stripHtml(match[2] || '')).trim();

    if (!rawHref || !rawText) continue;
    if (rawText.length < 14 || rawText.length > 240) continue;

    let resolved;
    try {
      resolved = new URL(rawHref, feedUrl).toString();
    } catch (_) {
      continue;
    }

    if (!isThaiGovernmentUrl(resolved)) continue;
    const likelyNewsLink = /news|detail|article|content|view|post|read|item|bulletin/i.test(resolved);
    const likelyNewsText = /ข่าว|ประชาสัมพันธ์|ประกาศ/.test(rawText);
    if (!likelyNewsLink && !likelyNewsText) continue;

    const key = `${resolved}|${rawText}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      title: rawText,
      link: resolved,
      summary: '',
      source: sourceName || 'หน่วยงานรัฐ',
      publishedAt: null,
    });
  }

  return items;
}

app.get('/api/announcements', async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit || '6'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 12)) : 6;

    if (Date.now() < thaiAnnouncementCache.expiresAt && thaiAnnouncementCache.items.length) {
      return res.json({
        success: true,
        data: thaiAnnouncementCache.items.slice(0, limit),
        message: 'ok',
      });
    }

    const settled = await Promise.allSettled(
      THAI_ANNOUNCEMENT_FEEDS.map(async (feed) => {
        const response = await fetch(feed.url, {
          method: 'GET',
          signal: AbortSignal.timeout(4500),
          headers: {
            'User-Agent': 'AgripriceBot/1.0 (+https://agriprice.com)',
            Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
          },
        });
        if (!response.ok) return [];
        const body = await response.text();
        const rssItems = parseRssItems(body, feed.name);
        if (rssItems.length) return rssItems;
        return parseHtmlNewsItems(body, feed.url, feed.name);
      })
    );

    const collected = [];
    for (const result of settled) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        collected.push(...result.value);
      }
    }

    const dedupMap = new Map();
    collected.forEach((item) => {
      const key = String(item.link || '').trim();
      if (!key) return;
      if (!dedupMap.has(key)) dedupMap.set(key, item);
    });

    const uniqueItems = Array.from(dedupMap.values()).filter((item) => isThaiGovernmentUrl(item.link));
    const agriOnly = uniqueItems.filter((item) => looksLikeThaiAgriNews(item.title, item.summary));
    const finalItems = (agriOnly.length ? agriOnly : uniqueItems)
      .sort((a, b) => {
        const ta = Date.parse(a.publishedAt || '') || 0;
        const tb = Date.parse(b.publishedAt || '') || 0;
        return tb - ta;
      })
      .slice(0, 30)
      .map((item) => ({
        title: item.title,
        link: item.link,
        source: item.source,
        published_at: item.publishedAt,
      }));

    thaiAnnouncementCache = {
      items: finalItems,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    res.json({
      success: true,
      data: finalItems.slice(0, limit),
      message: 'ok',
    });
  } catch (error) {
    console.error('announcements error:', error);
    res.status(500).json(response.error('โหลดข่าวประชาสัมพันธ์ไม่สำเร็จ'));
  }
});

app.get('/api/public-config', (_req, res) => {
  res.json({
    success: true,
    data: {
      firebase: {
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || '',
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
      },
    },
  });
});

async function ensureNotificationSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS public.notification_settings (
      user_id UUID PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'guest',
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notification_settings_updated_at
      ON public.notification_settings(updated_at DESC);
  `);
}

// ============================================================
// ROUTES — OTP + AUTH
// ============================================================

// Rate limit OTP send: 5 requests per 10 min per IP
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { error: 'ขอ OTP ได้สูงสุด 5 ครั้งใน 10 นาที กรุณารอ' },
});

/**
 * POST /api/auth/otp/send
 * { phone }
 */
app.post('/api/auth/otp/send', otpLimiter, async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json(response.error('กรุณาระบุเบอร์โทรศัพท์'));
    phone = toE164(phone);

    if (OTP_MOCK) {
      otpStore.set(phone, { code: '123456', expiresAt: Date.now() + 5 * 60 * 1000, used: false });
      console.log(`[OTP MOCK] ${phone} → 123456`);
      // ไม่ส่ง debug_code ใน response
      return res.json(response.success('ส่ง OTP แล้ว'));
    }

    // Production: Supabase phone OTP
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return res.status(400).json(response.error(error.message));
    res.json(response.success('ส่ง OTP แล้ว'));
  } catch (e) {
    res.status(500).json(response.error('ส่ง OTP ไม่สำเร็จ'));
  }
});

/**
 * POST /api/auth/otp/verify
 * { phone, otp }
 * → { verified: true, temp_token, isNewUser }
 */
app.post('/api/auth/otp/verify', async (req, res) => {
  try {
    let { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json(response.error('กรุณาระบุ phone และ otp'));
    phone = toE164(phone);

    if (OTP_MOCK) {
      const r = otpStore.get(phone);
      if (!r)                     return res.status(400).json(response.error('OTP หมดอายุ กรุณาขอใหม่'));
      if (r.used)                 return res.status(400).json(response.error('OTP ถูกใช้งานแล้ว'));
      if (Date.now() > r.expiresAt) return res.status(400).json(response.error('OTP หมดอายุ'));
      if (String(r.code) !== String(otp)) return res.status(400).json(response.error('OTP ไม่ถูกต้อง'));
      r.used = true;
      // cleanup memory หลังใช้งานแล้ว
      setTimeout(() => otpStore.delete(phone), 60000);
    } else {
      // Production: ตรวจ OTP กับ Supabase
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (error) return res.status(400).json(response.error(error.message));
    }

    // เช็คว่ามี account แล้วหรือยัง
    const { data: existing, error: profileErr } = await supabaseAdmin
      .from('profiles').select('profile_id, first_name, role').eq('phone', phone).maybeSingle();

    console.log('[OTP verify] phone:', phone, '| existing:', JSON.stringify(existing), '| error:', profileErr?.message);
    const isNewUser = !existing;
    const temp_token = signTempToken(phone);

    res.json({
      success: true, message: 'OTP ยืนยันสำเร็จ',
      verified: true, temp_token, isNewUser, user: existing || null,
      data: { verified: true, temp_token, isNewUser, user: existing || null },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json(response.error('ยืนยัน OTP ไม่สำเร็จ'));
  }
});

/**
 * POST /api/auth/firebase/verify-phone
 * { idToken, phone }
 * → { verified: true, temp_token, isNewUser }
 */
app.post('/api/auth/firebase/verify-phone', async (req, res) => {
  try {
    const { idToken, phone } = req.body || {};
    if (!idToken) return res.status(400).json(response.error('กรุณาระบุ idToken'));
    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json(response.error('ยังไม่ได้ตั้งค่า FIREBASE_WEB_API_KEY ใน .env'));
    }

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    const verifyJson = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      const msg = verifyJson?.error?.message || 'ตรวจสอบ Firebase token ไม่สำเร็จ';
      return res.status(401).json(response.error(msg));
    }

    const tokenPhone = verifyJson?.users?.[0]?.phoneNumber;
    if (!tokenPhone) {
      return res.status(401).json(response.error('Firebase token ไม่มีเบอร์โทรศัพท์'));
    }

    const normalizedTokenPhone = toE164(tokenPhone);
    if (phone && toE164(phone) !== normalizedTokenPhone) {
      return res.status(401).json(response.error('เบอร์โทรไม่ตรงกับผู้ที่ยืนยัน OTP'));
    }

    const { data: existing, error: profileErr } = await supabaseAdmin
      .from('profiles').select('profile_id, first_name, role').eq('phone', normalizedTokenPhone).maybeSingle();

    if (profileErr) {
      return res.status(500).json(response.error('ตรวจสอบบัญชีไม่สำเร็จ', profileErr.message));
    }

    const isNewUser = !existing;
    const temp_token = signTempToken(normalizedTokenPhone);

    return res.json({
      success: true,
      message: 'OTP ยืนยันสำเร็จ',
      verified: true,
      temp_token,
      isNewUser,
      user: existing || null,
      data: { verified: true, temp_token, isNewUser, user: existing || null },
    });
  } catch (e) {
    return res.status(500).json(response.error('ยืนยัน OTP ไม่สำเร็จ', e.message));
  }
});

/**
 * POST /api/auth/register/finish
 * { temp_token, role, profile: { firstName, lastName }, password }
 * → { token, user }
 */
app.post('/api/auth/register/finish', async (req, res) => {
  try {
    // ตรวจสอบ input ด้วย registerSchema (validators/register.js)
    const { error: schemaErr, value: validBody } = registerSchema.validate(req.body, { abortEarly: true });
    if (schemaErr) {
      return res.status(400).json(response.error(schemaErr.details[0].message));
    }
    const { temp_token, role, profile, password } = validBody;
    let payload;
    try {
      payload = jwt.verify(temp_token, JWT_SECRET);
    } catch (_) {
      return res.status(401).json(response.error('OTP token หมดอายุ กรุณายืนยัน OTP ใหม่'));
    }
    if (!payload.otp_verified) return res.status(401).json(response.error('Token ไม่ถูกต้อง'));
    const phone = payload.phone;
    const { firstName, lastName } = profile;
    if (!firstName || !lastName) return res.status(400).json(response.error('กรุณากรอกชื่อและนามสกุล'));
    if (!password || password.length < 8) return res.status(400).json(response.error('รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'));
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const existingRes = await client.query('SELECT profile_id FROM profiles WHERE phone = $1', [phone]);
      if (existingRes.rows.length > 0) throw new Error('เบอร์โทรนี้มีบัญชีอยู่แล้ว กรุณา Login');
      const password_hash = await bcrypt.hash(password, 10);
      // สร้าง user ใน Supabase Auth (เพื่อให้มี auth.users row สำหรับ RLS)
      const fakeEmail = `${phone.replace('+', '')}@agriprice.app`;
      // NOTE: Supabase Auth admin createUser ยังต้องใช้ supabaseAdmin, ไม่ใช่ pg client
      let authData = null;
      let authErr = null;

      try {
        const existingAuthUser = await findAuthUserByEmail(fakeEmail);
        if (existingAuthUser?.id) {
          authData = { user: existingAuthUser };
        }
      } catch (_) {}

      if (!authData?.user?.id) {
      try {
        ({ data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        phone: phone,
        phone_confirm: true,
        password,
        }));
      } catch (createErr) {
        authErr = createErr;
      }
      }

      if (authErr || !authData?.user?.id) {
        const authMsg = authErr?.message || 'ไม่ทราบสาเหตุ';
        const duplicateAuth = /already exists|already been registered|duplicate|unique|exists/i.test(authMsg);
        if (!duplicateAuth) {
          throw new Error('สร้างบัญชีไม่สำเร็จ: ' + authMsg);
        }

        try {
          const existingAuthUser = await findAuthUserByEmail(fakeEmail);
          if (existingAuthUser?.id) {
            authData = { user: existingAuthUser };
          }
        } catch (_) {}

        if (!authData?.user?.id) {
          throw new Error('สร้างบัญชีไม่สำเร็จ: ' + authMsg);
        }
      }

      const userId = authData.user.id;
      createdAuthUserId = userId;
      const defaultAvatar = getDefaultAvatarByRole(role);
      await client.query(
        'INSERT INTO profiles (profile_id, phone, first_name, last_name, role, password_hash, avatar) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [userId, phone, firstName, lastName, role, password_hash, defaultAvatar]
      );
      await client.query('COMMIT');
      client.release();
      const token = signToken({ id: userId, phone, role });
      // ส่ง token ตรงๆ (ไม่ wrap ใน data) เพื่อให้ frontend อ่านได้ทั้ง json.token และ json.data.token
      res.status(201).json({
        success: true,
        message: 'สมัครสมาชิกสำเร็จ',
        token,
        user: { id: userId, phone, role, name: `${firstName} ${lastName}`, avatar: defaultAvatar },
        data: { token, user: { id: userId, phone, role, name: `${firstName} ${lastName}`, avatar: defaultAvatar } },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      if (createdAuthUserId) {
        try { await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId); } catch (_) {}
      }
      console.error('[register.finish] failed:', err?.message || err);
      res.status(500).json(response.error(err.message));
    }
  } catch (e) {
    console.error(e);
    res.status(500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + e.message));
  }
});

/**
 * POST /api/auth/login
 * { phone, password }
 * → { token, user }
 */
app.post('/api/auth/login', async (req, res) => {
  // สร้าง loginSchema
  const loginSchema = Joi.object({
    phone: Joi.string().min(8).max(20),
    email: Joi.string().email(),
    password: Joi.string().min(8).max(100).required(),
  }).or('phone','email');
  const { error: schemaErr } = loginSchema.validate(req.body);
  if (schemaErr) return res.status(400).json(response.error('ข้อมูลไม่ถูกต้อง: ' + schemaErr.details[0].message));
  try {
    let { phone, email, password } = req.body;
    const identifier = phone || email;
    if (!identifier || !password) return res.status(400).json(response.error('กรุณากรอกเบอร์โทรและรหัสผ่าน'));

    // Try phone lookup first
    const searchPhone = toE164(identifier);
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, first_name, last_name, role, password_hash, email')
      .eq('phone', searchPhone)
      .maybeSingle();

    // If not found by phone, try email lookup (user may have typed email instead)
    if (!profile) {
      const emailTrimmed = String(identifier).trim().toLowerCase();
      if (emailTrimmed.includes('@')) {
        const { data: byEmail } = await supabaseAdmin
          .from('profiles')
          .select('profile_id, phone, first_name, last_name, role, password_hash, email')
          .ilike('email', emailTrimmed)
          .maybeSingle();
        if (byEmail) profile = byEmail;
      }
    }

    if (!profile || !profile.password_hash)
      return res.status(401).json(response.error('ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน'));
    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) return res.status(401).json(response.error('เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง'));
    const token = signToken({ id: profile.profile_id, phone: profile.phone, role: profile.role });
    const loginUser = { id: profile.profile_id, phone: profile.phone, role: profile.role, name: `${profile.first_name} ${profile.last_name}` };

    // ส่ง response ก่อน แล้วค่อย record session ทีหลัง (non-blocking)
    // เพื่อไม่ให้ device_sessions error ทำให้ login fail
    res.json({
      success: true, message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: loginUser,
      data: { token, user: loginUser },
    });

    // fire-and-forget: ไม่ await เพื่อไม่ให้ error นี้ทำให้ login response เป็น 500
    if (typeof recordDeviceSession === 'function') {
      recordDeviceSession(supabaseAdmin, profile.profile_id, req).catch(err =>
        console.warn('[login] recordDeviceSession failed (non-fatal):', err?.message)
      );
    }

  } catch (e) {
    console.error(e);
    res.status(500).json(response.error(e.message));
  }
});

// ============================================================
// ROUTES — CHANGE PASSWORD
// ============================================================

/**
 * POST /api/auth/change-password
 * { current_password, new_password }
 */
app.post('/api/auth/change-password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json(response.error('กรุณากรอกรหัสผ่านให้ครบ'));
    if (new_password.length < 8)
      return res.status(400).json(response.error('รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร'));

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('password_hash').eq('profile_id', req.user.id).single();
    if (!profile || !profile.password_hash)
      return res.status(404).json(response.error('ไม่พบบัญชี'));

    const valid = await bcrypt.compare(current_password, profile.password_hash);
    if (!valid) return res.status(401).json(response.error('รหัสผ่านปัจจุบันไม่ถูกต้อง'));

    const new_hash = await bcrypt.hash(new_password, 10);
    const { error } = await supabaseAdmin
      .from('profiles').update({ password_hash: new_hash }).eq('profile_id', req.user.id);
    if (error) return res.status(500).json(response.error('เปลี่ยนรหัสผ่านไม่สำเร็จ'));

    res.json(response.success('เปลี่ยนรหัสผ่านสำเร็จ'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

// ============================================================
// ROUTES — PROFILE
// ============================================================

app.get('/api/profile', auth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles').select('profile_id,phone,first_name,last_name,role,avatar,tagline,about,address_line1,address_line2,map_link,links,hero_image,followers_count,following_count,created_at,email,birth_date,account_status')
    .eq('profile_id', req.user.id).single();
  if (error) return res.status(404).json({ message: 'ไม่พบโปรไฟล์' });
  res.json(data);
});

app.patch('/api/profile', auth, upload.single('avatar'), async (req, res) => {
  try {
    const fields = ['first_name','last_name','tagline','about','address_line1','address_line2','map_link','links','email','birth_date','account_status'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (req.body.phone) {
      // MOCK OTP: ให้รหัส 123456 ผ่านเสมอ
      const otpCode = req.body.otp_code || req.headers['x-otp-code'] || null;
      if (otpCode === '123456') {
        updates.phone = toE164(req.body.phone);
      } else {
        // ตรวจสอบ otp_token (header หรือ body)
        const otpToken = req.headers['x-otp-token'] || req.body.otp_token || null;
        if (!otpToken) {
          return res.status(403).json({ message: 'ต้องยืนยัน OTP ก่อนเปลี่ยนเบอร์โทร' });
        }
        let payload;
        try {
          payload = jwt.verify(otpToken, JWT_SECRET);
        } catch (_) {
          return res.status(401).json({ message: 'OTP token หมดอายุ กรุณายืนยัน OTP ใหม่' });
        }
        if (!payload.otp_verified) {
          return res.status(401).json({ message: 'Token ไม่ถูกต้อง' });
        }
        updates.phone = toE164(req.body.phone);
      }
    }
    if (req.file) updates.avatar = await saveFile(req.file, 'avatars');
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
    if (error) return res.status(500).json({ message: 'อัปเดตไม่สำเร็จ' });
    res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/profile', auth, async (req, res) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    const { error: deleteProfileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('profile_id', req.user.id);

    if (deleteProfileError) {
      return res.status(500).json({ message: 'ลบบัญชีไม่สำเร็จ: ' + deleteProfileError.message });
    }

    try {
      await supabaseAdmin.auth.admin.deleteUser(req.user.id);
    } catch (authDeleteError) {
      console.warn('[profile delete] auth user delete skipped/failed:', authDeleteError.message);
    }

    if (reason) {
      console.log(`[profile delete] user=${req.user.id} reason=${reason}`);
    }

    res.json({ message: 'ลบบัญชีสำเร็จ' });
  } catch (error) {
    console.error('[profile delete] failed:', error);
    res.status(500).json({ message: 'ลบบัญชีไม่สำเร็จ' });
  }
});

app.get('/api/profiles/:userId', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('profile_id,first_name,last_name,role,avatar,tagline,about,address_line1,address_line2,map_link,links,hero_image,followers_count,created_at')
    .eq('profile_id', req.params.userId).single();
  if (error) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });

  res.json(data);
});

// ============================================================
// ROUTES — PRODUCTS
// ============================================================

app.get('/api/products', async (req, res) => {
  try {
    const { q, user_id, category, grade, page = 1, limit = 20, head } = req.query;
    const from = (Number(page)-1)*Number(limit), to = from+Number(limit)-1;
    const currentUser = getOptionalAuthUser(req);
    // [DENORMALIZED] ใช้ grade/price จาก products โดยตรง
    let query = supabaseAdmin
      .from('products')
      .select(
        'product_id,name,variety,grade,price,category,unit,image,is_active,created_at,user_id,' +
        'profiles!user_id(first_name,last_name,phone,avatar)',
        { count: 'exact' }
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (user_id)  query = query.eq('user_id', user_id);
    if (category) query = query.eq('category', category);
    if (q)        query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`); // [NORMALIZED] ลบ variety.ilike ออก (column ถูก drop แล้ว)

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ message: error.message });

    let result = data || [];
    if (grade) result = result.filter(p => p.grade === grade);

    let favoriteSellerIds = new Set();
    if (currentUser?.id && result.length) {
      const sellerIds = Array.from(new Set(result.map(p => String(p.user_id || '')).filter(Boolean)));
      if (sellerIds.length) {
        const { data: favRows, error: favErr } = await supabaseAdmin
          .from('user_relations')
          .select('target_user_id')
          .eq('relation_type', 'favorite')
          .eq('user_id', currentUser.id)
          .in('target_user_id', sellerIds);

        if (!favErr) {
          favoriteSellerIds = new Set((favRows || []).map(r => String(r.target_user_id || '')).filter(Boolean));
        }
      }
    }

    result = result.map(p => ({
      ...p,
      price: Number(p.price) || 0,
      is_favorited: favoriteSellerIds.has(String(p.user_id || '')),
      varieties: p.variety ? { variety: p.variety, product_name: p.name } : null,
    }));

    if (head === 'true') {
      return res.json({ total: grade ? result.length : (count || 0), page: Number(page), limit: Number(limit) });
    }
    res.json({ data: result, page: Number(page), limit: Number(limit), total: grade ? result.length : (count || 0) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*, profiles!user_id(first_name,last_name,phone,avatar)')
    .eq('product_id', req.params.id)
    .single();
  if (error) return res.status(404).json({ message: 'ไม่พบสินค้า' });

  res.json({
    ...data,
    price: Number(data.price) || 0,
    varieties: data.variety ? { variety: data.variety, product_name: data.name } : null,
  });
});

app.post('/api/products', auth, upload.single('image'), async (req, res) => {
    // [DENORMALIZED] เก็บ grade/price ไว้ใน products โดยตรง
    const productSchema = Joi.object({
      name:        Joi.string().min(2).max(100).required(),
      description: Joi.string().allow('').max(500),
      unit:        Joi.string().min(1).max(20).required(),
      quantity:    Joi.number().min(1).required(),
      category:    Joi.string().min(1).max(50).required(),
      variety:     Joi.string().allow('', null).max(100),
      grade:       Joi.string().allow('', null).max(50),
      price:       Joi.number().min(0),
      // backward-compat: frontend เก่าอาจยังส่ง variety_id มา
      variety_id:  Joi.alternatives().try(Joi.number().integer(), Joi.string().allow('')).optional(),
      grades:      Joi.any(),
    });
    const { error: schemaErr } = productSchema.validate(req.body);
    if (schemaErr) return res.status(400).json(response.error('ข้อมูลสินค้าไม่ถูกต้อง: ' + schemaErr.details[0].message));
  try {
    const { name, description, unit, quantity, category, variety, variety_id, grade, price, grades } = req.body;
    if (!name) return res.status(400).json(response.error('กรุณากรอกชื่อสินค้า'));
    if (!req.user || !req.user.id) {
      return res.status(401).json(response.error('ไม่พบข้อมูลผู้ใช้ในโทเค็น กรุณาเข้าสู่ระบบใหม่'));
    }
    let gradesArr = [];
    try {
      gradesArr = Array.isArray(grades) ? grades : (grades ? JSON.parse(grades) : []);
    } catch (_) {}
    let finalGrade = grade || null;
    let finalPrice = Number(price);
    if (gradesArr.length > 0) {
      finalGrade = String(gradesArr[0]?.grade || finalGrade || '').trim() || null;
      finalPrice = Math.min(...gradesArr.map(g => Number(g.price) || 0));
    }
    if (!(Number.isFinite(finalPrice) && finalPrice >= 0)) {
      return res.status(400).json(response.error('กรุณาระบุราคาสินค้าให้ถูกต้อง'));
    }
    // varieties table ถูก merge แล้ว: เก็บ variety เป็น TEXT ใน products
    const varietyName = (typeof variety === 'string' && variety.trim())
      ? variety.trim()
      : (typeof variety_id === 'string' && variety_id.trim() ? variety_id.trim() : null);
    const image = req.file ? await saveFile(req.file, 'products') : null;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      // [MERGED] INSERT พร้อม variety TEXT
      const productRes = await client.query(
        'INSERT INTO products (user_id, name, description, unit, quantity, image, category, variety, grade, price, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',
        [
          req.user.id,
          name,
          description || null,
          unit || 'กก.',
          quantity,
          image,
          category,
          varietyName,
          finalGrade,
          finalPrice,
          true
        ]
      );
      const product = productRes.rows[0];
      const newProductId = product.product_id ?? product.id;
      console.log('[DEBUG] product row keys:', Object.keys(product), '→ newProductId:', newProductId);
      if (!newProductId) throw new Error('ไม่สามารถดึง product_id หลัง INSERT ได้');
      await client.query('COMMIT');
      client.release();
      res.status(201).json(response.success('เพิ่มสินค้าสำเร็จ', { id: newProductId, data: product }));
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      res.status(500).json(response.error(err.message));
    }
  } catch (e) {
    console.error('Product creation error:', e);
    res.status(500).json(response.error(e.message));
  }
});

app.patch('/api/products/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { data: ex } = await supabaseAdmin.from('products').select('user_id').eq('product_id', req.params.id).single();
    if (!ex) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    if (ex.user_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });

    const productId = Number(req.params.id);

    // [NORMALIZED] อัปเดต fields ของ products (ไม่มี grade/price อีกแล้ว)
    const fields = ['name','description','unit','quantity','category','variety','is_active'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (updates.variety !== undefined && typeof updates.variety === 'string') {
      updates.variety = updates.variety.trim() || null;
    }
    if (req.file) updates.image = await saveFile(req.file, 'products');

    // รองรับทั้ง payload ใหม่ (grade/price) และ payload เก่า (grades[])
    let gradesArr = [];
    try {
      const raw = req.body.grades;
      gradesArr = Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : []);
    } catch (_) {}
    if (gradesArr.length > 0) {
      updates.grade = String(gradesArr[0]?.grade || '').trim() || null;
      updates.price = Math.min(...gradesArr.map(g => Number(g.price) || 0));
    } else {
      if (req.body.grade !== undefined) updates.grade = String(req.body.grade || '').trim() || null;
      if (req.body.price !== undefined) updates.price = Number(req.body.price);
    }

    if (updates.price !== undefined && !(Number.isFinite(updates.price) && updates.price >= 0)) {
      return res.status(400).json({ message: 'ราคาต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0' });
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from('products').update(updates).eq('product_id', productId);
      if (updateErr) return res.status(500).json({ message: updateErr.message });
    }

    res.json({ message: 'อัปเดตสำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/products/:id', auth, async (req, res) => {
  await supabaseAdmin.from('products').update({ is_active: false })
    .eq('product_id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'ลบสินค้าสำเร็จ' });
});

// ============================================================
// ROUTES — VARIETIES
// ============================================================

// ============================================================
// ROUTES — PRODUCT TYPES (ชื่อผลผลิตหลัก เช่น ทุเรียน มังคุด)
// ============================================================

app.get('/api/product-types', async (req, res) => {
  const { q = '' } = req.query;
  let query = supabaseAdmin.from('gov_prices')
    .select('commodity')
    .order('commodity');
  if (q) query = query.ilike('commodity', `%${q}%`);
  const { data } = await query.limit(100);
  // distinct commodity
  const seen = new Set();
  const result = (data || []).filter(r => {
    if (seen.has(r.commodity)) return false;
    seen.add(r.commodity); return true;
  });
  res.json({ data: result.map(r => ({ id: r.commodity, name: r.commodity })) });
});

app.get('/api/varieties', async (req, res) => {
  const { productName = '', q = '' } = req.query;
  let query = supabaseAdmin.from('gov_prices').select('commodity,variety').order('variety');
  if (productName) query = query.ilike('commodity', `%${productName}%`);
  if (q)           query = query.ilike('variety', `%${q}%`);
  const { data } = await query.limit(50);
  // distinct by commodity+variety
  const seen = new Set();
  const rows = [];
  for (const r of (data || [])) {
    const key = `${r.commodity || ''}::${r.variety || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      // backward-compat: frontend เก่าที่ส่ง variety_id จะยังใช้ค่าได้ (เป็น string)
      id: r.variety,
      variety_id: r.variety,
      name: r.variety,
      variety: r.variety,
      product_name: r.commodity,
    });
  }
  res.json({ data: rows });
});

// ============================================================
// ROUTES — USERS SEARCH
// ============================================================

app.get('/api/users/search', async (req, res) => {
  try {
    const { q = '', role = '', page = 1, limit = 50 } = req.query;
    const from = (Number(page)-1)*Number(limit), to = from+Number(limit)-1;
    let query = supabaseAdmin
      .from('profiles')
      .select('profile_id,phone,first_name,last_name,role,avatar,tagline,followers_count,created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(from, to);
    if (role) query = query.eq('role', role);
    if (q)    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data, error, count } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json({ data: data||[], page: Number(page), limit: Number(limit), total: count || 0 });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ============================================================
// ROUTES — PRODUCT SLOTS
// ============================================================

app.get('/api/products/:productId/slots', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = supabaseAdmin.from('product_slots')
      .select('*')
      .eq('product_id', req.params.productId)
      .eq('is_active', true)
      .order('start_date', { ascending: true })
      .order('time_start', { ascending: true });
    
    if (start_date) query = query.gte('start_date', start_date);
    if (end_date) query = query.lte('end_date', end_date);
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json({ data: data || [] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/product-slots', async (req, res) => {
  try {
    const { product_id, farmer_id, start_date, end_date, date } = req.query;
    // ?date=YYYY-MM-DD → slot ที่ครอบคลุมวันนั้น (start_date <= date <= end_date)
    const filterDate = date || null;

    let query = supabaseAdmin.from('product_slots')
      .select('*, product:products!product_id(product_id,name,variety,grade,price,user_id,unit,profiles!user_id(profile_id,first_name,last_name,avatar,address_line1))')
      .eq('is_active', true)
      .order('start_date', { ascending: true })
      .order('time_start', { ascending: true });

    if (product_id) query = query.eq('product_id', product_id);
    if (filterDate) {
      // slot ที่รองรับวันที่ที่เลือก
      query = query.lte('start_date', filterDate).gte('end_date', filterDate);
    } else {
      if (start_date) query = query.gte('start_date', start_date);
      if (end_date)   query = query.lte('end_date',   end_date);
    }

    // filter by farmer_id ใน DB level (เร็วกว่า JS filter)
    if (farmer_id) {
      const { data: farmerProducts } = await supabaseAdmin
        .from('products').select('product_id').eq('user_id', farmer_id).eq('is_active', true);
      const pids = (farmerProducts || []).map(p => p.product_id);
      if (pids.length) query = query.in('product_id', pids);
      else return res.json({ data: [] });
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    res.json({ data: data || [] });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/products/:productId/slots', auth, async (req, res) => {
  try {
    // verify ownership
    const { data: product } = await supabaseAdmin.from('products')
      .select('user_id').eq('product_id', req.params.productId).single();
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    if (product.user_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    
    const { slot_name, start_date, end_date, time_start, time_end, capacity } = req.body;
    if (!slot_name || !start_date || !end_date || !time_start || !time_end || !capacity) {
      return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    
    const { data, error } = await supabaseAdmin.from('product_slots').insert({
      product_id: req.params.productId,
      slot_name, start_date, end_date, time_start, time_end,
      capacity: Number(capacity),
      booked_count: 0,
    }).select().single();
    
    if (error) return res.status(500).json({ message: error.message });
    res.status(201).json({ message: 'เพิ่มรอบคิวสำเร็จ', data });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/product-slots/batch', auth, async (req, res) => {
  try {
    const { product_id, start_date, end_date, rounds } = req.body;
    if (!product_id || !start_date || !end_date || !rounds || !Array.isArray(rounds)) {
      return res.status(400).json({ message: 'ข้อมูลไม่ครบถ้วน' });
    }
    
    // verify ownership
    const { data: product } = await supabaseAdmin.from('products')
      .select('user_id').eq('product_id', product_id).single();
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    if (product.user_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    
    const slots = rounds.filter(r => r.enabled === true).map(r => ({
      product_id,
      slot_name: r.name || 'รอบคิว',
      start_date,
      end_date,
      time_start: r.start || r.timeStart,
      time_end: r.end || r.timeEnd,
      capacity: Number(r.capacity),
      booked_count: 0,
    }));
    
    if (!slots.length) return res.status(400).json({ message: 'ไม่มีรอบคิวที่เปิดใช้งาน' });
    
    const { data, error } = await supabaseAdmin.from('product_slots').insert(slots).select();
    if (error) return res.status(500).json({ message: error.message });
    
    res.status(201).json({ message: `เพิ่ม ${slots.length} รอบคิวสำเร็จ`, data });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.patch('/api/product-slots/:id', auth, async (req, res) => {
  try {
    const { data: slot } = await supabaseAdmin.from('product_slots')
      .select('product_id').eq('slot_id', req.params.id).single();
    if (!slot) return res.status(404).json({ message: 'ไม่พบรอบคิว' });
    
    const { data: product } = await supabaseAdmin.from('products')
      .select('user_id').eq('product_id', slot.product_id).single();
    if (!product || product.user_id !== req.user.id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    }
    
    const fields = ['slot_name','start_date','end_date','time_start','time_end','capacity','is_active'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    
    const { error } = await supabaseAdmin.from('product_slots').update(updates).eq('slot_id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'อัปเดตรอบคิวสำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.delete('/api/product-slots/:id', auth, async (req, res) => {
  try {
    const { data: slot } = await supabaseAdmin.from('product_slots')
      .select('product_id').eq('slot_id', req.params.id).single();
    if (!slot) return res.status(404).json({ message: 'ไม่พบรอบคิว' });
    
    const { data: product } = await supabaseAdmin.from('products')
      .select('user_id').eq('product_id', slot.product_id).single();
    if (!product || product.user_id !== req.user.id) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    }
    
    await supabaseAdmin.from('product_slots').update({ is_active: false }).eq('slot_id', req.params.id);
    res.json({ message: 'ลบรอบคิวสำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ============================================================
// ROUTES — BOOKINGS
// ============================================================

function normalizeVehicles(rawVehicles) {
  if (!Array.isArray(rawVehicles)) return [];
  return rawVehicles
    .map((v) => ({
      type: v?.type || v?.typeName || '',
      typeName: v?.typeName || v?.type || '',
      plate: String(v?.plate || '').trim().toUpperCase(),
      weight: v?.weight || '',
    }))
    .filter(v => v.plate || v.type);
}

function extractVehiclesFromBookingRow(row) {
  if (Array.isArray(row?.vehicle_plates) && row.vehicle_plates.length > 0) {
    return normalizeVehicles(row.vehicle_plates);
  }
  try {
    const parsed = JSON.parse(row?.note || '{}');
    return normalizeVehicles(parsed?.vehicles || []);
  } catch (_) {
    return [];
  }
}

async function findBookingByParam(idParam, selectClause) {
  const trimmed = String(idParam || '').trim();
  if (!trimmed) return null;

  // Try booking_no first (supports legacy and new short booking IDs)
  const byNo = await supabaseAdmin
    .from('bookings')
    .select(selectClause)
    .eq('booking_no', trimmed)
    .maybeSingle();
  if (byNo?.data) return byNo.data;

  // Fallback to numeric booking_id
  const numericId = Number(trimmed);
  if (Number.isFinite(numericId)) {
    const byId = await supabaseAdmin
      .from('bookings')
      .select(selectClause)
      .eq('booking_id', numericId)
      .maybeSingle();
    if (byId?.data) return byId.data;
  }

  return null;
}

function parseQueueSequence(queueNo) {
  const str = String(queueNo || '').trim();
  if (!str) return null;
  const m = str.match(/-(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

app.get('/api/bookings', auth, async (req, res) => {
  try {
    // Fallback: keep statuses fresh on read in case background interval is not active.
    await autoCompleteDueBookings();
    const { status } = req.query;
    const uid  = req.user.id;
    const role = req.user.role;
    let query = supabaseAdmin.from('bookings')
      .select('*, buyer:profiles!buyer_id(first_name,last_name,phone,avatar), farmer:profiles!farmer_id(first_name,last_name,phone,avatar), product:products(name,variety,grade,price,image,unit), slot:product_slots(slot_name,start_date,time_start,time_end)')
      .order('created_at', { ascending: false });
    // filter เฉพาะ booking ของ user ที่ login อยู่
    if (role === 'buyer') {
      query = query.eq('buyer_id', uid);
    } else {
      query = query.eq('farmer_id', uid);
    }
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return res.status(500).json(response.error(error.message));
    const mapped = (data || []).map(b => ({ ...b, vehicles: extractVehiclesFromBookingRow(b) }));
    // ส่ง array ตรงๆ ไม่ซ้อน
    res.json({ success: true, message: 'สำเร็จ', data: mapped });
  } catch (e) { res.status(500).json(response.error(e.message)); }
});

app.get('/api/bookings/:id', auth, async (req, res) => {
  await autoCompleteDueBookings();
  const data = await findBookingByParam(
    req.params.id,
    '*, buyer:profiles!buyer_id(*), farmer:profiles!farmer_id(*), product:products(*), slot:product_slots(*)'
  );
  if (!data) return res.status(404).json(response.error('ไม่พบการจอง'));
  if (data.buyer_id !== req.user.id && data.farmer_id !== req.user.id)
    return res.status(403).json(response.error('ไม่มีสิทธิ์'));
  const vehicles = extractVehiclesFromBookingRow(data);
  const out = { ...data, vehicles };
  res.json({ success: true, message: 'สำเร็จ', data: out, ...out });
});

app.get('/api/bookings/:id/queue-status', auth, async (req, res) => {
  try {
    await autoCompleteDueBookings();
    const bk = await findBookingByParam(
      req.params.id,
      'booking_id,booking_no,buyer_id,farmer_id,slot_id,queue_no,status,created_at,scheduled_time'
    );
    if (!bk) return res.status(404).json(response.error('ไม่พบการจอง'));
    if (bk.buyer_id !== req.user.id && bk.farmer_id !== req.user.id) {
      return res.status(403).json(response.error('ไม่มีสิทธิ์'));
    }

    if (!bk.slot_id) {
      return res.json({
        success: true,
        message: 'สำเร็จ',
        data: {
          slot_id: null,
          myQueue: bk.queue_no || '-',
          currentQueue: bk.queue_no || '-',
          waitingAhead: 0,
          totalWaiting: 0,
          estimatedMinutes: 0,
          averageTimePerQueue: 30,
          isMyTurn: false,
          status: bk.status || 'waiting',
          nextBookingId: null,
          nextBookingNo: null,
        },
      });
    }

    const { data: waitingRows, error: waitingErr } = await supabaseAdmin
      .from('bookings')
      .select('booking_id,booking_no,queue_no,created_at,status')
      .eq('slot_id', bk.slot_id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (waitingErr) return res.status(500).json(response.error(waitingErr.message));

    const waiting = Array.isArray(waitingRows) ? waitingRows : [];
    const myIndex = waiting.findIndex((w) => Number(w.booking_id) === Number(bk.booking_id));
    const next = waiting[0] || null;

    const mySeq = parseQueueSequence(bk.queue_no);
    const currentSeq = parseQueueSequence(next?.queue_no);
    const waitingAhead = (Number.isFinite(mySeq) && Number.isFinite(currentSeq))
      ? Math.max(0, mySeq - currentSeq)
      : (myIndex > 0 ? myIndex : 0);

    return res.json({
      success: true,
      message: 'สำเร็จ',
      data: {
        slot_id: bk.slot_id,
        myQueue: bk.queue_no || '-',
        currentQueue: next?.queue_no || '-',
        waitingAhead,
        totalWaiting: waiting.length,
        estimatedMinutes: waitingAhead * 30,
        averageTimePerQueue: 30,
        isMyTurn: myIndex === 0 && bk.status === 'waiting',
        status: bk.status || 'waiting',
        nextBookingId: next?.booking_id || null,
        nextBookingNo: next?.booking_no || null,
      },
    });
  } catch (e) {
    return res.status(500).json(response.error(e.message));
  }
});

app.post('/api/bookings', auth, async (req, res) => {
  try {
    // ตรวจสอบ input ด้วย bookingSchema (validators/booking.js)
    const { error: schemaErr } = bookingSchema.validate(req.body, { allowUnknown: true });
    if (schemaErr) return res.status(400).json(response.error(schemaErr.details[0].message));
    const { buyer_id, farmer_id, product_id, slot_id, scheduled_time, note, address, contact_name, contact_phone, product_amount } = req.body;
    if (!scheduled_time) return res.status(400).json(response.error('กรุณาระบุวันเวลา'));
    let vehicles = [];
    let vehicle_count = 1;
    try {
      const rawVehicles = req.body.vehicle_plates || req.body.vehicles || [];
      vehicles = normalizeVehicles(Array.isArray(rawVehicles) ? rawVehicles : JSON.parse(rawVehicles));
      if (vehicles.length > 0) vehicle_count = vehicles.length;
    } catch (_) {}
    if (!Array.isArray(vehicles)) vehicles = [];
    const normalizedProductAmount = Number(product_amount) && Number(product_amount) > 0 ? Number(product_amount) : null;
    const normalizedContactName = String(contact_name || address || '').trim() || null;
    const normalizedContactPhone = String(contact_phone || '').trim() || null;
    const normalizedNote = typeof note === 'string' ? note.trim() || null : null;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      let slot;
      if (slot_id) {
        const slotRes = await client.query('SELECT capacity, booked_count FROM product_slots WHERE slot_id = $1 FOR UPDATE', [slot_id]);
        slot = slotRes.rows[0];
        if (!slot) throw new Error('ไม่พบรอบคิว');
        if (slot.booked_count + vehicle_count > slot.capacity) throw new Error(`รอบคิวไม่พอ (เหลือ ${slot.capacity - slot.booked_count} คิว)`);
        await client.query('UPDATE product_slots SET booked_count = $1 WHERE slot_id = $2', [slot.booked_count + vehicle_count, slot_id]);
      }
      const queueSequence = slot ? (Number(slot.booked_count || 0) + 1) : null;
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const queue_no = queueSequence
        ? letters[(queueSequence - 1) % letters.length] + '-' + String(queueSequence).padStart(3,'0')
        : 'BK-' + uuidv4().slice(0, 8).toUpperCase();
      const booking_no = makeBookingNo();
      let bookingRes;
      const insertParams = [
        booking_no,
        buyer_id || (req.user.role==='buyer' ? req.user.id : null),
        farmer_id || (req.user.role==='farmer' ? req.user.id : null),
        product_id || null,
        slot_id || null,
        queue_no,
        scheduled_time,
        vehicle_count,
        normalizedNote,
        address || null,
        JSON.stringify(vehicles || []),
        normalizedContactName,
        normalizedContactPhone,
        normalizedProductAmount,
      ];
      await client.query('SAVEPOINT booking_insert_sp');
      try {
        bookingRes = await client.query(
          'INSERT INTO bookings (booking_no, buyer_id, farmer_id, product_id, slot_id, queue_no, scheduled_time, vehicle_count, note, address, vehicle_plates, contact_name, contact_phone, product_amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14) RETURNING *',
          insertParams
        );
        await client.query('RELEASE SAVEPOINT booking_insert_sp');
      } catch (insertErr) {
        // Backward compatibility: บาง DB ยังไม่มีคอลัมน์ใหม่ใน bookings
        if (insertErr && insertErr.code === '42703') {
          await client.query('ROLLBACK TO SAVEPOINT booking_insert_sp');
          bookingRes = await client.query(
            'INSERT INTO bookings (booking_no, buyer_id, farmer_id, product_id, slot_id, queue_no, scheduled_time, vehicle_count, note, address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
            [
              booking_no,
              insertParams[1],
              insertParams[2],
              insertParams[3],
              insertParams[4],
              insertParams[5],
              insertParams[6],
              insertParams[7],
              insertParams[8],
              insertParams[9],
            ]
          );
          await client.query('RELEASE SAVEPOINT booking_insert_sp');
        } else {
          throw insertErr;
        }
      }
      const booking = { ...bookingRes.rows[0], vehicles };
      const notifyId = req.user.role==='buyer' ? farmer_id : buyer_id;
      if (notifyId) {
        await client.query(
          'INSERT INTO notifications (user_id, type, title, description) VALUES ($1,$2,$3,$4)',
          [
            notifyId,
            'booking',
            'มีการจองใหม่',
            `คิว ${queue_no} — ${new Date(scheduled_time).toLocaleDateString('th-TH')}`
          ]
        );
      }
      await client.query('COMMIT');
      client.release();
      res.status(201).json({
        success: true, message: 'จองสำเร็จ',
        booking,
        queue_no,
        booking_no: booking.booking_no,
        booking_id: booking.booking_id,
        data: { booking, queue_no },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      res.status(500).json(response.error(err.message));
    }
  } catch (e) { res.status(500).json(response.error(e.message)); }
});

app.patch('/api/bookings/:id', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['waiting','success','cancel'].includes(status))
      return res.status(400).json({ message: 'status ไม่ถูกต้อง' });

    // BUG FIX: ดึง bk ก่อนแล้วค่อยตรวจสิทธิ์
    const bk = await findBookingByParam(
      req.params.id,
      'booking_id,buyer_id,farmer_id,slot_id,status,vehicle_count'
    );
    if (!bk) return res.status(404).json({ message: 'ไม่พบการจอง' });
    if (bk.buyer_id !== req.user.id && bk.farmer_id !== req.user.id)
      return res.status(403).json({ message: 'ไม่มีสิทธิ์' });

    // จำกัดสิทธิ์ buyer
    if (bk.buyer_id === req.user.id) {
      if (status !== 'cancel') {
        return res.status(403).json({ message: 'buyer สามารถ cancel เท่านั้น' });
      }
    }
    // จำกัดสิทธิ์ farmer
    if (bk.farmer_id === req.user.id) {
      if (!['success','cancel'].includes(status)) {
        return res.status(403).json({ message: 'farmer สามารถ success หรือ cancel เท่านั้น' });
      }
    }
    
    // ถ้ายกเลิก และมี slot_id ให้ลด booked_count ตามจำนวนรถจริง
    if (status === 'cancel' && bk.slot_id && bk.status !== 'cancel') {
      const { data: slot } = await supabaseAdmin.from('product_slots')
        .select('booked_count').eq('slot_id', bk.slot_id).single();
      if (slot && slot.booked_count > 0) {
        const vc = bk.vehicle_count || 1;
        const newCount = Math.max(0, slot.booked_count - vc);
        await supabaseAdmin.from('product_slots')
          .update({ booked_count: newCount }).eq('slot_id', bk.slot_id);
      }
    }
    
    await supabaseAdmin.from('bookings').update({ status }).eq('booking_id', bk.booking_id);

    try {
      await db.query(
        'INSERT INTO booking_status_logs (booking_id, old_status, new_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)',
        [bk.booking_id, bk.status || null, status, req.user.id || null, null]
      );
    } catch (_) {
      // ตาราง log อาจยังไม่ถูก migrate ในบาง environment
    }

    res.json({ message: 'อัปเดตสำเร็จ' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ============================================================
// ROUTES — CHAT
// ============================================================

app.get('/api/chats', auth, async (req, res) => {
  try {
    // Fetch rooms with user info
    const { data: rooms, error } = await supabaseAdmin.from('chat_rooms')
      .select('room_id, user1:profiles!user1_id(profile_id,first_name,last_name,avatar,phone), user2:profiles!user2_id(profile_id,first_name,last_name,avatar,phone)')
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });

    // Fetch last messages for all rooms (limit 1 per room)
    const roomIds = (rooms||[]).map(r => r.room_id).slice(0, 50); // limit 50 ห้อง
    let lastMsgMap = {};
    for (const roomId of roomIds) {
      const { data: msgs } = await supabaseAdmin.from('chat_messages')
        .select('room_id,message,created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (msgs && msgs.length > 0) lastMsgMap[roomId] = msgs[0];
    }

    // Fetch unread counts for all rooms
    const { data: unreadMsgs } = await supabaseAdmin.from('chat_messages')
      .select('room_id,sender_id,is_read')
      .in('room_id', roomIds)
      .eq('is_read', false)
      .neq('sender_id', req.user.id);

    // Map unread count
    const unreadCountMap = {};
    for (const msg of unreadMsgs) {
      unreadCountMap[msg.room_id] = (unreadCountMap[msg.room_id] || 0) + 1;
    }

    const result = (rooms||[]).map(room => {
      const other = room.user1?.profile_id === req.user.id ? room.user2 : room.user1;
      const last = lastMsgMap[room.room_id] || {};
      return {
        chatId: room.room_id,
        other_id: other?.profile_id,
        first_name: other?.first_name,
        last_name: other?.last_name,
        avatar: other?.avatar,
        phone: other?.phone || '',
        lastMessage: last.message || '',
        lastTime: last.created_at || null,
        unread: unreadCountMap[room.room_id] || 0,
      };
    });
    res.json({ data: result });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/chats/start', auth, async (req, res) => {
  try {
    const { other_id } = req.body;
    if (!other_id) return res.status(400).json({ message: 'กรุณาระบุ other_id' });
    const [u1, u2] = [req.user.id, other_id].sort();
    const { data: ex } = await supabaseAdmin.from('chat_rooms').select('room_id').eq('user1_id', u1).eq('user2_id', u2).maybeSingle();
    if (ex) return res.json({ chatId: ex.room_id });
    const { data, error } = await supabaseAdmin.from('chat_rooms').insert({ user1_id: u1, user2_id: u2 }).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.status(201).json({ chatId: data.room_id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/chats/:chatId/messages', auth, async (req, res) => {
  try {
    const { data: room } = await supabaseAdmin.from('chat_rooms').select('user1_id,user2_id').eq('room_id', req.params.chatId).single();
    if (!room) return res.status(404).json({ message: 'ไม่พบห้องสนทนา' });
    if (room.user1_id !== req.user.id && room.user2_id !== req.user.id) return res.status(403).json({ message: 'ไม่มีสิทธิ์' });
    // Pagination
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const from = (page-1)*limit;
    const to = from+limit-1;
    const { data } = await supabaseAdmin.from('chat_messages')
      .select('*')
      .eq('room_id', req.params.chatId)
      .order('created_at', { ascending: true })
      .range(from, to);
    await supabaseAdmin.from('chat_messages').update({ is_read: true }).eq('room_id', req.params.chatId).neq('sender_id', req.user.id);
    res.json({ data: data||[], page, limit });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/chats/:chatId/messages', auth, upload.single('image'), async (req, res) => {
  try {
    const { message } = req.body;
    const image_url = req.file ? await saveFile(req.file, 'chat') : null;
    if (!message && !image_url) return res.status(400).json({ message: 'กรุณาส่งข้อความหรือรูปภาพ' });
    const { data, error } = await supabaseAdmin.from('chat_messages').insert({
      room_id: req.params.chatId, sender_id: req.user.id, message: message||null, image_url,
    }).select().single();
    if (error) return res.status(500).json({ message: error.message });

    // แจ้งเตือนอีกฝ่าย
    try {
      const { data: room } = await supabaseAdmin.from('chat_rooms')
        .select('user1_id,user2_id').eq('room_id', req.params.chatId).single();
      const recipientId = room.user1_id === req.user.id ? room.user2_id : room.user1_id;
      const { data: sender } = await supabaseAdmin.from('profiles')
        .select('first_name,last_name').eq('profile_id', req.user.id).single();
      const senderName = sender ? `${sender.first_name||''} ${sender.last_name||''}`.trim() : 'ผู้ใช้';
      await supabaseAdmin.from('notifications').insert({
        user_id: recipientId, type: 'chat', title: `ข้อความจาก ${senderName}`,
        description: image_url ? '[รูปภาพ]' : (message || '').slice(0, 80),
      });
    } catch (_) {}

    res.status(201).json({ data });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ============================================================
// ROUTES — NOTIFICATIONS
// ============================================================

app.get('/api/notifications', auth, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const from = (page-1)*limit;
  const to = from+limit-1;
  const { data } = await supabaseAdmin.from('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(from, to);
  res.json({ data: data||[], page, limit });
});

app.patch('/api/notifications/read-all', auth, async (req, res) => {
  await supabaseAdmin.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
  res.json({ message: 'อ่านทั้งหมดแล้ว' });
});

app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  await supabaseAdmin.from('notifications').update({ is_read: true }).eq('notification_id', req.params.id).eq('user_id', req.user.id);
  res.json({ message: 'อ่านแล้ว' });
});

// ============================================================
// ROUTES — NOTIFICATION SETTINGS
// ============================================================

app.get('/api/notification-settings', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT user_id, role, settings, updated_at FROM public.notification_settings WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const row = rows[0] || null;
    res.json({
      data: {
        user_id: req.user.id,
        role: row?.role || req.user.role || 'guest',
        settings: row?.settings || {},
        updated_at: row?.updated_at || null,
      },
    });
  } catch (error) {
    console.error('[notification-settings] GET failed:', error);
    res.status(500).json({ message: 'โหลดการตั้งค่าการแจ้งเตือนไม่สำเร็จ' });
  }
});

app.patch('/api/notification-settings', auth, async (req, res) => {
  try {
    const settings = req.body && typeof req.body.settings === 'object' ? req.body.settings : req.body;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({ message: 'ข้อมูลการตั้งค่าไม่ถูกต้อง' });
    }

    const role = String(req.body?.role || req.user.role || 'guest').toLowerCase();
    const { rows } = await db.query(
      `
        INSERT INTO public.notification_settings (user_id, role, settings, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          role = EXCLUDED.role,
          settings = EXCLUDED.settings,
          updated_at = NOW()
        RETURNING user_id, role, settings, updated_at
      `,
      [req.user.id, role, JSON.stringify(settings)]
    );

    res.json({
      message: 'บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อย',
      data: rows[0] || { user_id: req.user.id, role, settings },
    });
  } catch (error) {
    console.error('[notification-settings] PATCH failed:', error);
    res.status(500).json({ message: 'บันทึกการตั้งค่าการแจ้งเตือนไม่สำเร็จ' });
  }
});

// ============================================================
// ROUTES — REVIEWS
// ============================================================

app.get('/api/reviews', async (req, res) => {
  const { user_id } = req.query;
  let q = supabaseAdmin.from('reviews').select('*, reviewer:profiles!reviewer_id(first_name,last_name,avatar)').order('created_at', { ascending: false });
  if (user_id) q = q.eq('user_id', user_id);
  const { data } = await q.limit(50);
  res.json({ data: data||[] });
});
app.post('/api/reviews', auth, async (req, res) => {
  try {
    const reviewSchema = Joi.object({
      user_id: Joi.string().required(),
      rating: Joi.number().min(1).max(5).required(),
      comment: Joi.string().allow('').max(500),
    });
    const { error: schemaErr } = reviewSchema.validate(req.body);
    if (schemaErr) return res.status(400).json(response.error('ข้อมูลรีวิวไม่ถูกต้อง: ' + schemaErr.details[0].message));
    const { user_id, rating, comment } = req.body;
    // ป้องกัน self-review
    if (user_id === req.user.id) {
      return res.status(400).json(response.error('ไม่สามารถรีวิวตัวเองได้'));
    }
    // ป้องกันรีวิวซ้ำ (upsert)
    const { data: existing } = await supabaseAdmin.from('reviews')
      .select('review_id').eq('user_id', user_id).eq('reviewer_id', req.user.id).maybeSingle();
    let data, error;
    if (existing) {
      // update
      ({ data, error } = await supabaseAdmin.from('reviews')
        .update({ rating, comment }).eq('review_id', existing.review_id).select().single());
    } else {
      // insert
      ({ data, error } = await supabaseAdmin.from('reviews')
        .insert({ user_id, reviewer_id: req.user.id, rating, comment }).select().single());
    }
    if (error) return res.status(500).json(response.error(error.message));
    res.status(201).json(response.success('รีวิวสำเร็จ', { id: data.review_id }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

// ============================================================
// ROUTES — SEARCH & DASHBOARD
// ============================================================
// ROUTES — FAVORITES (รายการโปรด)
// ============================================================

// ดึงรายการ saved farmers ของตัวเอง
app.get('/api/favorites', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .select('relation_id, target_user_id, created_at, profiles!target_user_id(profile_id,first_name,last_name,tagline,avatar,role)')
      .eq('relation_type', 'favorite')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    const result = (data || []).map(fav => ({
      id: fav.relation_id,
      user_id: fav.target_user_id,
      first_name: fav.profiles?.first_name || '',
      last_name:  fav.profiles?.last_name  || '',
      tagline:    fav.profiles?.tagline    || '',
      avatar:     fav.profiles?.avatar     || '',
      role:       fav.profiles?.role       || '',
      created_at: fav.created_at,
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// เพิ่ม saved farmer
app.post('/api/favorites', auth, async (req, res) => {
  try {
    const { user_id: target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json({ message: 'กรุณาระบุ user_id' });
    if (target_user_id === req.user.id) return res.status(400).json({ message: 'ไม่สามารถเพิ่มตัวเองได้' });

    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .upsert(
        { relation_type: 'favorite', user_id: req.user.id, target_user_id },
        { onConflict: 'relation_type,user_id,target_user_id' }
      )
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    res.status(201).json(data);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ลบ saved farmer
app.delete('/api/favorites/:targetUserId', auth, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('user_relations')
      .delete()
      .eq('relation_type', 'favorite')
      .eq('user_id', req.user.id)
      .eq('target_user_id', req.params.targetUserId);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});


// ============================================================
// ROUTES — FOLLOWS (ติดตาม)
// ============================================================

// POST /api/follow/:userId — ติดตาม
app.post('/api/follow/:userId', auth, async (req, res) => {
  try {
    const followerId  = req.user.id;
    const followingId = req.params.userId;
    if (followerId === followingId)
      return res.status(400).json({ message: 'ไม่สามารถติดตามตัวเองได้' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // insert follows (ignore ถ้ามีอยู่แล้ว)
      await client.query(
        `INSERT INTO user_relations (relation_type, user_id, target_user_id)
         VALUES ('follow', $1, $2)
         ON CONFLICT (relation_type, user_id, target_user_id) DO NOTHING`,
        [followerId, followingId]
      );

      // เพิ่ม followers_count ให้คนที่ถูกติดตาม
      await client.query(
        'UPDATE profiles SET followers_count = followers_count + 1 WHERE profile_id = $1',
        [followingId]
      );

      // เพิ่ม following_count ให้คนที่กดติดตาม
      await client.query(
        'UPDATE profiles SET following_count = following_count + 1 WHERE profile_id = $1',
        [followerId]
      );

      // แจ้งเตือนคนที่ถูกติดตาม
      const { data: followerProfile } = await supabaseAdmin
        .from('profiles').select('first_name, last_name').eq('profile_id', followerId).single();
      const followerName = followerProfile
        ? `${followerProfile.first_name} ${followerProfile.last_name}`.trim()
        : 'มีผู้ใช้';
      await client.query(
        'INSERT INTO notifications (user_id, type, title, description) VALUES ($1,$2,$3,$4)',
        [followingId, 'follow', 'มีผู้ติดตามใหม่', `${followerName} เริ่มติดตามคุณแล้ว`]
      );

      await client.query('COMMIT');
      client.release();

      // ดึง followers_count ล่าสุด
      const { data: updated } = await supabaseAdmin
        .from('profiles').select('followers_count, following_count').eq('profile_id', followingId).single();

      res.json({ success: true, following: true, followers_count: updated?.followers_count || 0 });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      res.status(500).json({ message: err.message });
    }
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/follow/:userId — เลิกติดตาม
app.delete('/api/follow/:userId', auth, async (req, res) => {
  try {
    const followerId  = req.user.id;
    const followingId = req.params.userId;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM user_relations
         WHERE relation_type = 'follow' AND user_id = $1 AND target_user_id = $2`,
        [followerId, followingId]
      );

      // ลด count เฉพาะกรณีที่มี row จริง
      if (result.rowCount > 0) {
        await client.query(
          'UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE profile_id = $1',
          [followingId]
        );
        await client.query(
          'UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE profile_id = $1',
          [followerId]
        );
      }

      await client.query('COMMIT');
      client.release();

      const { data: updated } = await supabaseAdmin
        .from('profiles').select('followers_count').eq('profile_id', followingId).single();

      res.json({ success: true, following: false, followers_count: updated?.followers_count || 0 });
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      res.status(500).json({ message: err.message });
    }
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/follow/:userId/status — เช็คว่าติดตามอยู่ไหม
app.get('/api/follow/:userId/status', auth, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('user_relations')
      .select('relation_id')
      .eq('relation_type', 'follow')
      .eq('user_id', req.user.id)
      .eq('target_user_id', req.params.userId)
      .maybeSingle();
    res.json({ following: !!data });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/follow/:userId/followers — รายชื่อคนที่ติดตาม user นี้
app.get('/api/follow/:userId/followers', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .select('follower:profiles!user_id(profile_id, first_name, last_name, avatar, role, tagline)')
      .eq('relation_type', 'follow')
      .eq('target_user_id', req.params.userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    const result = (data || []).map(r => ({
      profile_id: r.follower.profile_id,
      first_name: r.follower.first_name,
      last_name:  r.follower.last_name,
      avatar:     r.follower.avatar,
      role:       r.follower.role,
      tagline:    r.follower.tagline,
    }));
    res.json({ data: result });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/follow/:userId/following — รายชื่อที่ user นี้ติดตาม
app.get('/api/follow/:userId/following', auth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_relations')
      .select('following:profiles!target_user_id(profile_id, first_name, last_name, avatar, role, tagline)')
      .eq('relation_type', 'follow')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    const result = (data || []).map(r => ({
      profile_id: r.following.profile_id,
      first_name: r.following.first_name,
      last_name:  r.following.last_name,
      avatar:     r.following.avatar,
      role:       r.following.role,
      tagline:    r.following.tagline,
    }));
    res.json({ data: result });
  } catch (e) { res.status(500).json({ message: e.message }); }
});


// ============================================================
// ROUTES — ONLINE PRESENCE
// ============================================================

// POST /api/presence/ping — อัปเดต last_seen (เรียกทุก 30 วิ จาก frontend)
app.post('/api/presence/ping', auth, async (req, res) => {
  try {
    await supabaseAdmin
      .from('profiles')
      .update({ last_seen: new Date().toISOString() })
      .eq('profile_id', req.user.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/presence/:userId — เช็คว่า user ออนไลน์ไหม (last_seen < 2 นาที = ออนไลน์)
app.get('/api/presence/:userId', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('last_seen')
      .eq('profile_id', req.params.userId)
      .single();
    const isOnline = data?.last_seen
      ? (Date.now() - new Date(data.last_seen).getTime()) < 2 * 60 * 1000
      : false;
    res.json({ online: isOnline, last_seen: data?.last_seen || null });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// GET /api/chats/unread — จำนวน unread ทั้งหมด (สำหรับ badge บน nav)
app.get('/api/chats/unread', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { data: rooms, error: roomsErr } = await supabaseAdmin
      .from('chat_rooms')
      .select('room_id')
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);
    if (roomsErr) return res.status(500).json({ message: roomsErr.message });

    const roomIds = (rooms || []).map((r) => r.room_id).filter(Boolean);
    if (roomIds.length === 0) {
      return res.json({ unread_count: 0, total_messages: 0 });
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('is_read', false)
      .neq('sender_id', uid);
    if (error) return res.status(500).json({ message: error.message });

    // นับ room ที่มี unread (ไม่ซ้ำ)
    const uniqueRooms = new Set((data || []).map(m => m.room_id));
    res.json({ unread_count: uniqueRooms.size, total_messages: (data || []).length });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ============================================================

app.get('/api/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const [sellers, prods] = await Promise.all([
      supabaseAdmin.from('profiles').select('profile_id,first_name,last_name,role,avatar,tagline').or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).limit(10),
      supabaseAdmin.from('products').select('product_id,name,variety,grade,price,unit,image,user_id,profiles!user_id(first_name,last_name)').ilike('name', `%${q}%`).eq('is_active', true).limit(20),
    ]);
    const products = (prods.data||[]).map(p => ({ ...p, price: Number(p.price) || 0 }));
    res.json({ sellers: sellers.data||[], products });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const uid = req.user.id;
    const isBuyer = req.user.role === 'buyer';

    const toNumber = (value) => Number(value) || 0;
    const toQty = (booking) => toNumber(booking?.vehicle_count) || toNumber(booking?.quantity) || 1;
    const getUnitPrice = (product) => toNumber(product?.price);
    const getAmount = (booking) => getUnitPrice(booking?.product) * toQty(booking);
    const getName = (profile) => `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'ไม่ทราบ';

    function buildTrendData(bookings, period) {
      const now = new Date();
      const trend = { labels: [], data: [] };

      if (period === 7) {
        for (let i = 6; i >= 0; i--) {
          const day = new Date(now);
          day.setDate(now.getDate() - i);
          const dayKey = day.toISOString().slice(0, 10);
          trend.labels.push(day.toLocaleDateString('th-TH', { weekday: 'short' }));
          trend.data.push(bookings.filter((booking) => booking.created_at && booking.created_at.slice(0, 10) === dayKey)
            .reduce((sum, booking) => sum + getAmount(booking), 0));
        }
        return trend;
      }

      if (period === 365) {
        const monthLabels = [];
        const monthLookup = new Map();
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
          monthLabels.push(monthDate.toLocaleDateString('th-TH', { month: 'short' }));
          monthLookup.set(key, monthLabels.length - 1);
        }
        trend.labels = monthLabels;
        trend.data = Array.from({ length: monthLabels.length }, () => 0);
        for (const booking of bookings) {
          if (!booking.created_at) continue;
          const created = new Date(booking.created_at);
          const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
          if (!monthLookup.has(key)) continue;
          trend.data[monthLookup.get(key)] += getAmount(booking);
        }
        return trend;
      }

      const bucketCount = period === 90 ? 3 : 4;
      const bucketSize = period / bucketCount;
      trend.labels = period === 90
        ? ['เดือน 1', 'เดือน 2', 'เดือน 3']
        : ['สัปดาห์ 1', 'สัปดาห์ 2', 'สัปดาห์ 3', 'สัปดาห์ 4'];
      trend.data = Array.from({ length: bucketCount }, () => 0);

      for (const booking of bookings) {
        if (!booking.created_at) continue;
        const created = new Date(booking.created_at);
        const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays >= period) continue;
        const bucketIndex = Math.min(bucketCount - 1, Math.floor(diffDays / bucketSize));
        trend.data[bucketIndex] += getAmount(booking);
      }

      return trend;
    }

    // Batch queries for dashboard
    const [bk, pr, rv] = await Promise.all([
      supabaseAdmin.from('bookings').select('booking_id', { count: 'exact' })
        .eq(isBuyer ? 'buyer_id' : 'farmer_id', uid),
      supabaseAdmin.from('products').select('product_id', { count: 'exact' })
        .eq('user_id', uid).eq('is_active', true),
      supabaseAdmin.from('reviews').select('rating').eq('user_id', uid),
    ]);

    const bookingsResult = await supabaseAdmin.from('bookings')
      .select('booking_id,created_at,status,buyer_id,farmer_id,product_id,vehicle_count,quantity,product:products!product_id(product_id,name,image,grade,price,user_id)')
      .eq(isBuyer ? 'buyer_id' : 'farmer_id', uid)
      .order('created_at', { ascending: false });

    const bookings = bookingsResult.data || [];
    const successBookings = bookings.filter((booking) => booking.status === 'success');
    const bookingStats = bookings.reduce((acc, booking) => {
      if (booking.status === 'waiting') acc.waiting += 1;
      else if (booking.status === 'success') acc.success += 1;
      else if (booking.status === 'cancel') acc.cancel += 1;
      return acc;
    }, { waiting: 0, success: 0, cancel: 0 });

    // aggregate by product_id
    const prodMap = {};
    for (const booking of successBookings) {
      if (!booking.product_id) continue;
      const qty = toQty(booking);
      const unitPrice = getUnitPrice(booking.product);
      if (!prodMap[booking.product_id]) {
        prodMap[booking.product_id] = { id: booking.product_id, qty: 0, name: booking.product?.name || 'ไม่ทราบ', image: booking.product?.image || '', spent: 0 };
      }
      prodMap[booking.product_id].qty += qty;
      prodMap[booking.product_id].spent += unitPrice * qty;
    }
    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Top sellers (for farmer: top buyers by booking count)
    let topSellersOut = [];
    if (isBuyer) {
      const sellerIds = [...new Set(successBookings.map((booking) => booking.product?.user_id).filter(Boolean))];
      const sellerProfileMap = {};
      if (sellerIds.length > 0) {
        const { data: sellerProfiles } = await supabaseAdmin.from('profiles')
          .select('profile_id,first_name,last_name,avatar')
          .in('profile_id', sellerIds);
        for (const profile of sellerProfiles || []) {
          sellerProfileMap[profile.profile_id] = profile;
        }
      }

      const sellerMap = {};
      for (const booking of successBookings) {
        const sellerId = booking.product?.user_id;
        if (!sellerId) continue;
        if (!sellerMap[sellerId]) {
          const sellerProfile = sellerProfileMap[sellerId] || {};
          sellerMap[sellerId] = {
            id: sellerId,
            qty: 0,
            name: getName(sellerProfile),
            avatar: sellerProfile.avatar || '',
          };
        }
        sellerMap[sellerId].qty += toQty(booking);
      }
      topSellersOut = Object.values(sellerMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
    } else {
      const { data: buyerBookings } = await supabaseAdmin.from('bookings')
        .select('buyer_id, vehicle_count, quantity, buyer:profiles!buyer_id(first_name, last_name, avatar, phone)')
        .eq('farmer_id', uid)
        .eq('status', 'success');
      const buyerMap = {};
      for (const b of (buyerBookings || [])) {
        if (!b.buyer_id) continue;
        const qty = toQty(b);
        if (!buyerMap[b.buyer_id]) {
          buyerMap[b.buyer_id] = { id: b.buyer_id, qty: 0, name: `${b.buyer?.first_name || ''} ${b.buyer?.last_name || ''}`.trim(), avatar: b.buyer?.avatar || '', phone: b.buyer?.phone || '' };
        }
        buyerMap[b.buyer_id].qty += qty;
      }
      topSellersOut = Object.values(buyerMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
    }

    const avg = rv.data?.length ? rv.data.reduce((s,r)=>s+r.rating,0)/rv.data.length : 0;

    const purchaseTrend = {
      "7": buildTrendData(successBookings, 7),
      "30": buildTrendData(successBookings, 30),
      "90": buildTrendData(successBookings, 90),
      "365": buildTrendData(successBookings, 365),
    };

    const avgPrice = successBookings.length
      ? successBookings.reduce((sum, booking) => sum + getUnitPrice(booking.product), 0) / successBookings.length
      : 0;
    const totalSpent = successBookings.reduce((sum, booking) => sum + getAmount(booking), 0);
    const uniquePurchasedProducts = new Set(successBookings.map((booking) => booking.product_id).filter(Boolean));
    const recentActivities = bookings.slice(0, 5).map((booking) => {
      const statusLabel = booking.status === 'success' ? 'สำเร็จ' : booking.status === 'waiting' ? 'รอดำเนินการ' : booking.status === 'cancel' ? 'ยกเลิก' : booking.status;
      const statusIcon = booking.status === 'success' ? 'task_alt' : booking.status === 'waiting' ? 'hourglass_top' : booking.status === 'cancel' ? 'cancel' : 'receipt_long';
      return {
        icon: statusIcon,
        title: booking.product?.name || 'รายการจอง',
        desc: `สถานะ ${statusLabel} · ${formatCurrency(getAmount(booking))}`,
        time: booking.created_at ? new Date(booking.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      };
    });

    res.json({
      bookings_total:  bk.count   || 0,
      products_total:  isBuyer ? uniquePurchasedProducts.size : (pr.count || 0),
      reviews_total:   rv.data?.length || 0,
      avg_rating:      Math.round(avg * 10) / 10,
      top_products:    topProducts,
      top_sellers:     topSellersOut,
      purchaseTrend,
      booking_stats: bookingStats,
      recent_activities: recentActivities,
      avg_price: Math.round(avgPrice),
      total_spent: Math.round(totalSpent),
      avgPrice: Math.round(avgPrice),
      totalSpent: Math.round(totalSpent),
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

const govPricesRouter = require('./routes/govPrices');
const { syncDITPrices } = require('./services/ditScraper');

// ทดสอบ scraper ด้วยมือ (ลบทิ้งได้หลังทดสอบ)
app.get('/api/gov-prices/sync-now', async (_req, res) => {
  const result = await syncDITPrices();
  res.json(result);
});

app.use('/api/gov-prices', govPricesRouter);

// ============================================================
// HEALTH
// ============================================================

app.get('/api/health', async (_req, res) => {
  const { error } = await supabaseAdmin.from('profiles').select('profile_id').limit(1);
  res.json({ status: error ? 'error' : 'ok', db: error ? 'disconnected' : 'connected', time: new Date().toISOString() });
});

// ============================================================
// SERVE FRONTEND (optional)
// ============================================================

const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '../frontend');
const frontendPath = path.resolve(FRONTEND_DIR);
console.log('✅ FRONTEND_DIR:', frontendPath);

// ไม่ serve static file จาก root server (เช่น seed.js, delete-profile.js)
// ให้ย้ายไฟล์เหล่านี้ไป server/scripts หรือโฟลเดอร์ที่ไม่ถูก expose

if (fs.existsSync(frontendPath)) {
  // Serve static files
  app.use(express.static(frontendPath));

  // SPA fallback: ทุก path ที่ไม่ใช่ /api/* ให้ serve ไฟล์ตรงๆ หรือ index.html
  app.get(/^\/(?!api\/).*$/, (req, res, next) => {
    if (path.extname(req.path)) {
      const filePath = path.join(frontendPath, req.path);
      return fs.existsSync(filePath) ? res.sendFile(filePath) : next();
    }
    const indexFile = path.join(frontendPath, 'index.html');
    return fs.existsSync(indexFile) ? res.sendFile(indexFile) : next();
  });

  console.log(`    Frontend: ${frontendPath}`);
} else {
  console.warn(`    ⚠️  Frontend dir not found: ${frontendPath}`);
  console.warn(`       วางโฟลเดอร์ frontend/ ไว้ข้างๆ server.js หรือตั้งค่า FRONTEND_DIR ใน .env`);
}

// ============================================================
// ROUTES — CATEGORIES
// ============================================================

const MOCK_CATEGORIES = [
  {
    id: 1,
    code: 'fruit',
    name: 'ผลไม้',
    description: 'ผลไม้สดใหม่จากสวนเกษตร',
    icon: 'durian.png',
    image: '/assets/images/durian.png',
    color: '#FF6B6B',
  },
  {
    id: 2,
    code: 'vegetable',
    name: 'ผัก',
    description: 'ผักสดใจ จากไร่เกษตร',
    icon: 'leaf',
    image: '/assets/images/vegetable.png',
    color: '#51CF66',
  },
  {
    id: 3,
    code: 'oil',
    name: 'น้ำมัน',
    description: 'น้ำมันจากพืชการเกษตร',
    icon: 'opacity',
    image: '/assets/images/oil.png',
    color: '#FFD43B',
  },
  {
    id: 4,
    code: 'retail-rice',
    name: 'ข้าว',
    description: 'ข้าวสายพันธุ์ไทย หิมพานต์ แสบปลา',
    icon: 'rice_bowl',
    image: '/assets/images/rice.png',
    color: '#9775FA',
  },
  {
    id: 5,
    code: 'organic',
    name: 'อินทรีย์',
    description: 'ผลิตภัณฑ์อินทรีย์ที่ปลอดสารพิษ',
    icon: 'eco',
    image: '/assets/images/organic.png',
    color: '#22B14C',
  },
  {
    id: 6,
    code: 'seedlings',
    name: 'พืชพันธุ์',
    description: 'เมล็ดพันธุ์และตัวอ่อนพืช',
    icon: 'sprout',
    image: '/assets/images/seedlings.png',
    color: '#A9E242',
  }
];

const USE_MOCK = process.env.USE_MOCK === 'true';

app.get('/api/categories', (req, res) => {
  res.json({ data: MOCK_CATEGORIES });
});

app.get('/api/categories/:code', (req, res) => {
  const category = MOCK_CATEGORIES.find(c => c.code === req.params.code);
  if (!category) return res.status(404).json({ message: 'ไม่พบหมวดหมู่' });
  res.json({ data: category });
});

// ============================================================
// ROUTES — GOVERNMENT PRICES (Mock Data)
// ============================================================

const MOCK_FRUITS = [
  { fruit_id: 'P14001', name: 'กล้วยหอม' },
  { fruit_id: 'P14002', name: 'กล้วยน้ำว้า' },
  { fruit_id: 'P14010', name: 'มะม่วงน้ำดอกไม้' },
  { fruit_id: 'P14011', name: 'มะม่วงอกร่อง' },
  { fruit_id: 'P14020', name: 'ทุเรียน หมอนทอง' },
  { fruit_id: 'P14021', name: 'ลองกอง' },
  { fruit_id: 'P14022', name: 'มังคุด' },
  { fruit_id: 'P14023', name: 'เงาะโรงเรียน' },
  { fruit_id: 'P14030', name: 'ส้มเขียวหวาน' },
  { fruit_id: 'P14031', name: 'ส้มโอ' },
  { fruit_id: 'P14040', name: 'แตงโม' },
  { fruit_id: 'P14041', name: 'สับปะรด' },
];

const MOCK_VARIETIES = {
  'P14001': [
    { variety_id: 'V14001-1', name: 'กล้วยหอมทั่วไป' },
    { variety_id: 'V14001-2', name: 'กล้วยหอมน้ำหนักดี' },
  ],
  'P14010': [
    { variety_id: 'V14010-1', name: 'มะม่วงน้ำดอกไม้ ลำลูก' },
    { variety_id: 'V14010-2', name: 'มะม่วงน้ำดอกไม้ ลำพูน' },
  ],
  'P14020': [
    { variety_id: 'V14020-1', name: 'ทุเรียนหมอนทอง คุณภาพดี' },
    { variety_id: 'V14020-2', name: 'ทุเรียนหมอนทอง คุณภาพปกติ' },
  ],
  'P14030': [
    { variety_id: 'V14030-1', name: 'ส้มเขียวหวาน สตม.' },
    { variety_id: 'V14030-2', name: 'ส้มเขียวหวาน อื่นๆ' },
  ],
};

console.log('\n✅ MOCK DATA INITIALIZED:');
console.log('   - MOCK_CATEGORIES:', MOCK_CATEGORIES.length, 'categories');
console.log('   - MOCK_FRUITS:', MOCK_FRUITS.length, 'fruits');
console.log('   - MOCK_VARIETIES: keys =', Object.keys(MOCK_VARIETIES).length);
console.log('   + Endpoints: /api/categories, /api/fruits, /api/fruit-varieties, /api/gov-prices\n');

function generateMockPrices(fruitId, fromDate, toDate) {
  console.log('[generateMockPrices] generating for:', { fruitId, fromDate, toDate });
  // Parse dates
  const from = new Date(fromDate);
  const to = new Date(toDate);
  console.log('[generateMockPrices] date range:', from, 'to', to);
  
  // Generate data for each day in range
  const prices = [];
  const current = new Date(from);
  
  while (current <= to) {
    const dateStr = current.toISOString().slice(0, 10);
    // Thai date format DD/MM/YYYY (BE)
    const thaiDate = `${String(current.getDate()).padStart(2,'0')}/${String(current.getMonth()+1).padStart(2,'0')}/${current.getFullYear() + 543}`;
    
    // Generate mock prices based on fruit type
    let basePrice = 0;
    if (fruitId === 'P14001' || fruitId === 'P14002') basePrice = 25; // กล้วย
    else if (fruitId.startsWith('P1401')) basePrice = 60; // มะม่วง
    else if (fruitId === 'P14020') basePrice = 400; // ทุเรียน
    else if (fruitId === 'P14030') basePrice = 40; // ส้มเขียว
    else basePrice = 50;
    
    // Add daily variation
    const variation = Math.sin(current.getDate() / 7) * 10 + (Math.random() - 0.5) * 20;
    const minPrice = Math.round(basePrice - 5);
    const maxPrice = Math.round(basePrice + 10 + variation);
    const avgPrice = Math.round((minPrice + maxPrice) / 2);
    
    prices.push({
      date: thaiDate,
      product_id: fruitId,
      min_price: minPrice,
      max_price: maxPrice,
      avg_price: avgPrice,
      unit: 'บาท/กก.'
    });
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log('[generateMockPrices] generated', prices.length, 'price points');
  return prices;
}

app.get('/api/fruits', (req, res) => {
  console.log('[/api/fruits] called');
  console.log('[/api/fruits] returning', MOCK_FRUITS.length, 'fruits');
  res.json({ success: true, data: MOCK_FRUITS });
});

app.get('/api/fruit-varieties', (req, res) => {
  const { fruit_id } = req.query;
  console.log('[/api/fruit-varieties] called with fruit_id:', fruit_id);
  if (!fruit_id) {
    console.log('[/api/fruit-varieties] no fruit_id provided');
    return res.json({ success: true, data: [] });
  }
  
  const varieties = MOCK_VARIETIES[fruit_id];
  if (!varieties) {
    console.log('[/api/fruit-varieties] no exact varieties found, returning defaults');
    // Default varieties for any fruit
    return res.json({ success: true, data: [
      { variety_id: `${fruit_id}-1`, name: 'สายพันธุ์ทั่วไป' },
      { variety_id: `${fruit_id}-2`, name: 'สายพันธุ์อื่นๆ' }
    ]});
  }
  
  console.log('[/api/fruit-varieties] found', varieties.length, 'varieties');
  res.json({ success: true, data: varieties });
});

app.get('/api/gov-prices', (req, res) => {
  const { product_id, from_date, to_date } = req.query;
  console.log('[/api/gov-prices] called with:', { product_id, from_date, to_date });
  
  if (!product_id || !from_date || !to_date) {
    console.log('[/api/gov-prices] missing parameters');
    return res.status(400).json({ success: false, error: 'Missing parameters' });
  }
  
  const prices = generateMockPrices(product_id, from_date, to_date);
  console.log('[/api/gov-prices] generated', prices.length, 'prices');
  res.json({ success: true, data: prices });
});

// Override products endpoint to use mock data if needed
const originalGetProducts = app._router.stack.find(r => r.route && r.route.path === '/api/products' && r.route.methods.get);
if (USE_MOCK || process.env.NODE_ENV === 'development') {
  app.get('/api/products-mock', (req, res) => {
    const { q, category, page = 1, limit = 20 } = req.query;
    let results = [...MOCK_PRODUCTS];

    if (category) {
      results = results.filter(p => p.category === category);
    }
    if (q) {
      const query = q.toLowerCase();
      results = results.filter(p => p.name.toLowerCase().includes(query) || p.variety.toLowerCase().includes(query));
    }

    const total = results.length;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit);
    const paginatedResults = results.slice(from, to);

    const data = paginatedResults.map(p => {
      const seller = MOCK_SELLERS.find(s => s.id === p.user_id) || MOCK_SELLERS[0];
      return {
        ...p,
        price: Number(p.price),
        profiles: {
          first_name: seller.first_name,
          last_name: seller.last_name,
          phone: seller.phone,
          avatar: seller.avatar
        },
        varieties: p.variety ? { variety: p.variety, product_name: p.name } : null,
        is_favorited: false,
      };
    });

    res.json({
      data,
      page: Number(page),
      limit: Number(limit),
      total
    });
  });
}

// ============================================================
// START
// ============================================================

// ── Error logging middleware (ต้องอยู่หลัง routes ทั้งหมด) ──
app.use(logErrorMiddleware);

app.listen(PORT, async () => {
  console.log(`\n✅  AgriPrice Server: http://localhost:${PORT}`);
  console.log(`    OTP: ${OTP_MOCK ? 'MOCK (รหัส 123456)' : 'REAL SMS'}`);
  console.log(`    Upload: ${UPLOAD_MODE}`);
  console.log(`    Health: http://localhost:${PORT}/api/health\n`);

  // Auto-migrate: เติมคอลัมน์ที่จำเป็น
  try {
    await ensureNotificationSettingsTable();
    await supabaseAdmin.rpc('exec_sql', { sql: `
      ALTER TABLE public.products ADD COLUMN IF NOT EXISTS grade TEXT;
      ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) DEFAULT 0;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_count INTEGER DEFAULT 1;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vehicle_plates JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_name TEXT;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_phone TEXT;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS product_amount NUMERIC;
      ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS form_payload JSONB DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS public.booking_status_logs (
        id BIGSERIAL PRIMARY KEY,
        booking_id BIGINT NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by UUID REFERENCES public.profiles(profile_id) ON DELETE SET NULL,
        changed_at TIMESTAMPTZ DEFAULT NOW(),
        note TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_booking_status_logs_booking
        ON public.booking_status_logs(booking_id, changed_at DESC);
    `}).then(() => console.log('    ✅ Migration: products + bookings full-capture + booking_status_logs OK'))
      .catch(async () => {
        const { error: e1 } = await supabaseAdmin.from('products').select('product_id,grade,price').limit(1);
        if (e1) console.warn('    ⚠️  ตรวจ schema products ไม่ผ่าน — กรุณา run migration SQL ใน Supabase SQL Editor');
        else console.log('    ✅ products.grade/price: OK');
      });
  } catch (_) {
    console.log('    ℹ️  Auto-migrate skipped (run schema.sql manually if needed)');
  }

  // Auto-complete booking queue status: waiting -> success after scheduled time + delay
  autoCompleteDueBookings();
  setInterval(autoCompleteDueBookings, AUTO_SUCCESS_SCAN_MS);
  console.log(`    ✅ Auto queue success: waiting -> success after ${AUTO_SUCCESS_DELAY_MIN} min (every ${Math.round(AUTO_SUCCESS_SCAN_MS / 1000)}s)`);
});