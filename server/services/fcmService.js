const admin = require('firebase-admin');
const logger = require('../utils/logger');
const { supabaseAdmin } = require('../utils/supabase');

let fcmInitialized = false;

try {
  let serviceAccount = null;

  // 1. Try environment variable (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      logger.info('🔑 FCM: Initializing using FIREBASE_SERVICE_ACCOUNT_JSON env variable');
    } catch (parseErr) {
      logger.error('❌ FCM: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env variable:', parseErr.message);
    }
  }

  // 2. Try local file if not loaded from env
  if (!serviceAccount) {
    const fs = require('fs');
    const path = require('path');
    const localKeyPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (fs.existsSync(localKeyPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'));
        logger.info('🔑 FCM: Initializing using firebase-service-account.json local file');
      } catch (readErr) {
        logger.error('❌ FCM: Failed to read local firebase-service-account.json file:', readErr.message);
      }
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    fcmInitialized = true;
    logger.info('🚀 FCM: Firebase Admin initialized successfully');
  } else {
    logger.warn('⚠️  FCM: Firebase Service Account Key not found. Push notifications will be mocked.');
  }
} catch (err) {
  logger.error('❌ FCM: Initialization Error:', err.message);
}

/**
 * ส่ง Push Notification ไปหาอุปกรณ์ที่ผูกกับ userId ทั้งหมด
 * @param {string} userId - ไอดีผู้รับ
 * @param {string} title - หัวข้อแจ้งเตือน
 * @param {string} body - รายละเอียด
 * @param {object} [data] - ข้อมูลเพิ่มเติมแบบ key-value (ทุกค่าข้างในต้องเป็น String)
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    if (!userId) return;

    // ดึง push token ของ user คนนี้จาก device_sessions
    const { data: sessions, error } = await supabaseAdmin
      .from('device_sessions')
      .select('push_token')
      .eq('user_id', userId)
      .not('push_token', 'is', null);

    if (error) {
      logger.error(`[FCM] Database query error fetching tokens for user ${userId}:`, error.message);
      return;
    }

    const tokens = (sessions || [])
      .map(s => s.push_token)
      .filter(Boolean)
      .filter((t, i, arr) => arr.indexOf(t) === i); // ตัดค่าซ้ำออก

    if (tokens.length === 0) {
      logger.debug(`[FCM] No push tokens registered for user ${userId}`);
      return;
    }

    // จัดระเบียบข้อมูลเพิ่มเติมให้อยู่ในรูปของ string (FCM ไม่อนุญาตค่าที่เป็น Object/Number ใน data payload)
    const normalizedData = {};
    if (data) {
      Object.entries(data).forEach(([k, v]) => {
        normalizedData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      });
    }

    if (!fcmInitialized) {
      logger.info(`[FCM] [MOCK SEND] Target User: ${userId}\n  Title: "${title}"\n  Body: "${body}"\n  Tokens (${tokens.length}): [${tokens.join(', ')}]\n  Data:`, normalizedData);
      return;
    }

    logger.info(`[FCM] Sending push notification to user ${userId} (${tokens.length} devices)...`);

    // ส่งแบบ Multicast ไปหลายเครื่องพร้อมกัน
    const message = {
      notification: {
        title,
        body
      },
      data: normalizedData,
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`[FCM] Multicast results: ${response.successCount} succeeded, ${response.failureCount} failed.`);
    
    // ตรวจสอบ tokens ที่หมดอายุ หรือไม่ได้ใช้งานแล้วเพื่อลบออกจาก DB
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });
      
      if (tokensToRemove.length > 0) {
        logger.info(`[FCM] Cleaning up ${tokensToRemove.length} inactive tokens from database...`);
        // เซ็ต push_token ของเซสชั่นที่ใช้งานไม่ได้เป็น null
        await supabaseAdmin
          .from('device_sessions')
          .update({ push_token: null })
          .in('push_token', tokensToRemove);
      }
    }

  } catch (err) {
    logger.error('[FCM] Send Error:', err.message);
  }
}

module.exports = {
  sendPushNotification,
  isFcmReady: () => fcmInitialized
};
