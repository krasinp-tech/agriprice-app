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

const db = require('./db');
const response = require('./utils/response');
const logger = require('./utils/logger');
const { supabaseAdmin } = require('./utils/supabase');
const { logRequestMiddleware, logErrorMiddleware } = require('./middlewares/log');

// นำเข้าระบบอัตโนมัติ: ปิดคิวจองที่หมดเวลา และสแกนราคากลางจากเว็บรัฐ
const { autoCompleteDueBookings, autoCloseStaleProductsAndSlots, AUTO_SUCCESS_SCAN_MS } = require('./services/automationService');
require('./services/ditScraper'); 

const app = express();
const PORT = process.env.PORT || 5000;

// --- 1. CORS Configuration ---
// อนุญาตให้ Frontend (ไม่ว่าจะรันบนมือถือหรือเว็บ) สามารถเรียก API ได้
app.use(cors({
  origin: true,
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
// ส่วนนี้คือหัวใจสำคัญที่คอยบอกว่า URL ไหน ให้ไปทำงานที่ไฟล์ไหน
app.use('/api/auth', require('./routes/auth'));                    // ระบบสมัครสมาชิก / ล็อกอิน
app.use('/api/profile', require('./routes/profile'));              // จัดการข้อมูลส่วนตัวผู้ใช้
app.use('/api/profiles', require('./routes/profile'));
app.use('/api/products', require('./routes/products'));            // ลงประกาศขายผลผลิต
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
app.use('/api/search', require('./routes/search'));                // ค้นหา
app.use('/api/users', require('./routes/users'));
app.use('/api/follow', require('./routes/follow'));
app.use('/api/notification-settings', require('./routes/notificationSettings'));
app.use('/api/public-config', require('./routes/publicConfig'));   // ส่งค่า Config ให้ฝั่งมือถือ

app.use('/api/device-sessions', require('./middlewares/auth'), require('./routes/deviceSessions').router);

// --- 5. Public / Help Endpoints ---
// เอาไว้ให้ตัว Monitor ของ Render ตรวจสอบว่าเซิร์ฟเวอร์ยังไม่ตาย
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));


// --- 6. Start Server & Background Tasks ---
app.use(logErrorMiddleware); // ดักจับ Error ขั้นสุดท้าย

app.listen(PORT, async () => {
  logger.info(`✅ AgriPrice Server running on http://localhost:${PORT}`);
  
  // สั่งรันระบบ Background Worker (ทำงานเบื้องหลังอัตโนมัติ)
  // 1. อัปเดตสถานะคิวจองที่เลยเวลาให้สำเร็จอัตโนมัติ
  autoCompleteDueBookings();
  setInterval(autoCompleteDueBookings, AUTO_SUCCESS_SCAN_MS);
  
  // 2. ปิดประกาศขายที่หมดอายุแล้ว
  autoCloseStaleProductsAndSlots();
  setInterval(autoCloseStaleProductsAndSlots, Math.max(60000, AUTO_SUCCESS_SCAN_MS));

  logger.info('🚀 Automation services active');
});