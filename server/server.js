/**
 * ============================================================
 * AGRIPRICE BACKEND — Modular Server v3
 * Refactored for professional standard & mobile experience
 * ============================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const response = require('./response');
const logger = require('./utils/logger');
const { supabaseAdmin } = require('./utils/supabase');
const { logRequestMiddleware, logErrorMiddleware } = require('./middlewares/log');
const { autoCompleteDueBookings, autoCloseStaleProductsAndSlots, AUTO_SUCCESS_SCAN_MS } = require('./services/automationService');
require('./services/ditScraper'); // Start DIT cron job

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS Configuration ---
app.use(cors({
  origin: true, // Always allow any origin (for dev/mobile simplicity)
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logRequestMiddleware);

// --- Static Files ---
if ((process.env.UPLOAD_MODE || 'supabase-storage') === 'local') {
  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOAD_DIR));
}

// --- Routes Registration ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/profiles', require('./routes/profile'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/gov-prices', require('./routes/govPrices'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/categories'));
app.use('/api/presence', require('./routes/presence'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/product-slots', require('./routes/product-slots'));
app.use('/api/search', require('./routes/search'));
app.use('/api/users', require('./routes/users'));
app.use('/api/follow', require('./routes/follow'));
app.use('/api/notification-settings', require('./routes/notificationSettings'));
app.use('/api/public-config', require('./routes/publicConfig'));

app.use('/api/device-sessions', require('./middlewares/auth'), require('./routes/deviceSessions').router);

// --- Public / Help Endpoints ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.get('/api/public-config', (req, res) => {
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
      },
    },
  });
});

// --- Start Server ---
app.use(logErrorMiddleware);

app.listen(PORT, async () => {
  logger.info(`✅ AgriPrice Server running on http://localhost:${PORT}`);
  
  // Background Tasks
  autoCompleteDueBookings();
  setInterval(autoCompleteDueBookings, AUTO_SUCCESS_SCAN_MS);
  
  autoCloseStaleProductsAndSlots();
  setInterval(autoCloseStaleProductsAndSlots, Math.max(60000, AUTO_SUCCESS_SCAN_MS));

  logger.info('🚀 Automation services active');
});