/**
 * ============================================================
 * AGRIPRICE BACKEND — Modular Server v3
 * ============================================================
 * ไฟล์นี้คือจุดศูนย์กลาง (Entry Point) ของระบบหลังบ้านทั้งหมด
 * ทำหน้าที่ตั้งค่าเซิร์ฟเวอร์, เชื่อมต่อฐานข้อมูล, และกระจายเส้นทาง (Routing)
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { logRequestMiddleware, logErrorMiddleware } = require('./middlewares/log');

// [FIXED #3] Rate Limiter สำหรับ Search API ป้องกัน scraping / DoS
// ติดตั้งก่อนใช้งาน: npm install express-rate-limit
const rateLimit = require('express-rate-limit');
const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,  // window 1 นาที
  max: 30,              // สูงสุด 30 ครั้ง/นาที/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'ค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
});

// นำเข้าระบบอัตโนมัติ: ปิดคิวจองที่หมดเวลา
const { autoCompleteDueBookings, autoCloseStaleProductsAndSlots, AUTO_SUCCESS_SCAN_MS } = require('./services/automationService');

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. CORS Configuration ---
// [FIXED] ใช้ whitelist จาก CORS_ORIGIN ใน .env แทนการเปิดกว้าง origin: true
// รองรับ Capacitor (capacitor://localhost), localhost dev, และ production domain
const CORS_WHITELIST = [
  'https://agriprice-otp.web.app',
  'https://agriprice-app.onrender.com',
  ...(process.env.CORS_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
];

const ALWAYS_ALLOWED = [
  'capacitor://localhost', 
  'ionic://localhost', 
  'https://localhost',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.replace(/\/$/, '');
    if (ALWAYS_ALLOWED.includes(normalizedOrigin)) return callback(null, true);
    if (CORS_WHITELIST.includes(normalizedOrigin)) return callback(null, true);
    
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error(`CORS: origin "${origin}" ไม่ได้รับอนุญาต`));
  },
  credentials: true
}));

// --- 2. Request Parsers & Middlewares ---
// ตั้งค่าให้อ่านข้อมูลแบบ JSON และเก็บ Log ทุกครั้งที่มีคนเรียก API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logRequestMiddleware);

// --- 3. Static Files (ถ้ามีระบบอัปโหลดรูปภาพลงเซิร์ฟเวอร์โดยตรง) ---
if ((process.env.UPLOAD_MODE || 'supabase-storage') === 'local') {
  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR));
}

// --- 4. Routes Registration (การลงทะเบียนเส้นทาง API) ---
app.use('/api/auth', require('./routes/auth'));                    // ระบบสมัครสมาชิก / ล็อกอิน
app.use('/api/profile', require('./routes/profile'));              // จัดการข้อมูลส่วนตัวผู้ใช้
app.use('/api/profiles', require('./routes/profile'));
const { router: productsRouter, buyerRouter: buyerProductsRouter } = require('./routes/products');
app.use('/api/products', productsRouter);            // ลงประกาศขายผลผลิต
app.use('/api/offers', productsRouter);              // Backward-compatible alias for older frontend pages
app.use('/api/buyer/products', buyerProductsRouter); // Buyer-specific product routes
app.use('/api/bookings', require('./routes/bookings'));            // ระบบจองคิวรับซื้อ (Core Feature)
app.use('/api/announcements', require('./routes/announcements'));  // ประกาศข่าวสาร
app.use('/api/gov-prices', require('./routes/govPrices'));        // ดึงราคากลางรัฐบาล
app.use('/api/chats', require('./routes/chats'));                  // ระบบแชท 1-1
app.use('/api/favorites', require('./routes/favorites'));          // ระบบกดถูกใจ / ติดตาม
app.use('/api/notifications', require('./routes/notifications'));  // แจ้งเตือน
app.use('/api', require('./routes/categories'));                   // หมวดหมู่สินค้า
app.use('/api/presence', require('./routes/presence'));            // สถานะออนไลน์ของผู้ใช้
app.use('/api/dashboard', require('./routes/dashboard'));          // สรุปสถิติสำหรับหน้าแรก
app.use('/api/payments', require('./routes/payments'));            // จำลองการชำระเงิน
app.use('/api/product-slots', require('./routes/product-slots'));  // จัดการรอบคิว/เวลา
app.use('/api/search', searchRateLimiter, require('./routes/search')); // ค้นหา [FIXED #3: rate limited]
app.use('/api/users', require('./routes/users'));
app.use('/api/follow', require('./routes/follow'));
app.use('/api/notification-settings', require('./routes/notificationSettings'));
app.use('/api/public-config', require('./routes/publicConfig'));   // ส่งค่า Config ให้ฝั่งมือถือ
app.use('/api/addresses', require('./routes/addresses'));          // สมุดที่อยู่ผู้ใช้

app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/device-sessions', require('./middlewares/auth'), require('./routes/deviceSessions').router);

// --- 5. Serve Frontend Static Files ---
// [ADDED] ให้ Express เสิร์ฟไฟล์จากโฟลเดอร์ frontend โดยตรง
app.use(express.static(path.join(__dirname, '../frontend')));

// Handle root access -> index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// --- 5. Public / Help Endpoints ---
// เอาไว้ให้ตัว Monitor ของ Render ตรวจสอบว่าเซิร์ฟเวอร์ยังไม่ตาย
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date(),
  commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
}));


// --- 6. Start Server & Background Tasks ---
app.use(logErrorMiddleware); // ดักจับ Error ขั้นสุดท้าย

app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`✅ AgriPrice Server running on http://localhost:${PORT}`);

  // [WARN] แจ้งเตือนถ้า OTP_MOCK ยังเปิดอยู่ใน production
  if (process.env.OTP_MOCK === 'true' && process.env.NODE_ENV === 'production') {
    logger.warn('⚠️  WARNING: OTP_MOCK=true ใน production! โหมดนี้ไม่ควรถูกเปิดใช้งาน — ตั้งค่า OTP_MOCK=false ใน .env ทันที');
  }

  // สั่งรันระบบ Background Worker (ทำงานเบื้องหลังอัตโนมัติ)
  // 1. อัปเดตสถานะคิวจองที่เลยเวลาให้สำเร็จอัตโนมัติ
  autoCompleteDueBookings();
  setInterval(autoCompleteDueBookings, AUTO_SUCCESS_SCAN_MS);

  // 2. ปิดประกาศขายที่หมดอายุแล้ว
  autoCloseStaleProductsAndSlots();
  setInterval(autoCloseStaleProductsAndSlots, Math.max(60000, AUTO_SUCCESS_SCAN_MS));

  logger.info('🚀 Automation services active');
});
