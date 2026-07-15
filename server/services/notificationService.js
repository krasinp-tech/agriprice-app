const { supabaseAdmin } = require('../utils/supabase');
const { sendPushNotification } = require('./fcmService');

async function getNotificationSettings(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return {};
    return data?.settings || {};
  } catch (_) {
    return {};
  }
}

function isPushEnabled(settings, type) {
  const normalizedType = String(type || 'system').toLowerCase();
  const settingKeyByType = {
    booking: 'booking',
    chat: 'chat',
    message: 'chat',
    system: 'system',
    general: 'system',
    price: 'system'
  };
  const settingKey = settingKeyByType[normalizedType] || 'system';
  const pushKey = `push_${settingKey}`;

  if (Object.prototype.hasOwnProperty.call(settings, pushKey)) return settings[pushKey] !== false;
  if (Object.prototype.hasOwnProperty.call(settings, settingKey)) return settings[settingKey] !== false;
  return true;
}

function resolveNotificationLink(type, link, data = {}) {
  if (link && /^\/pages\/[a-z0-9_./?=&%-]+$/i.test(link)) return link;
  const id = encodeURIComponent(String(data.booking_id || data.bookingId || ''));
  if (String(type).toLowerCase() === 'booking' && id) {
    return `/pages/shared/notifications.html?booking_id=${id}`;
  }
  const chatId = encodeURIComponent(String(data.chat_id || data.chatId || ''));
  if (['chat', 'message'].includes(String(type).toLowerCase()) && chatId) {
    return `/pages/shared/chat.html?id=${chatId}`;
  }
  return '/pages/shared/notifications.html';
}

class NotificationService {
  /**
   * สร้างแจ้งเตือนและส่ง Push Notification
   * @param {string} userId - ไอดีผู้รับแจ้งเตือน (profile_id ของ farmer หรือ buyer)
   * @param {string} type - ประเภทการแจ้งเตือน (e.g. 'booking', 'chat', 'general')
   * @param {string} title - หัวข้อแจ้งเตือน
   * @param {string} description - รายละเอียดการแจ้งเตือน
   * @param {string} [link] - ลิงก์ปลายทางในหน้าแอป (e.g. '/pages/buyer/booking-detail.html?id=xxx')
   * @param {object} [data] - ข้อมูลเพิ่มเติมแบบ key-value (ทุกค่าจะถูกแปลงเป็น String เพื่อส่งผ่าน FCM)
   */
  async createNotification(userId, type, title, description, link = null, data = {}) {
    try {
      if (!userId) return null;

      link = resolveNotificationLink(type, link, data);
      // 1. บันทึกลงตาราง notifications ใน database (เพื่อใช้แสดงในหน้าเว็บ/ประวัติแจ้งเตือน)
      const { data: dbData, error: dbErr } = await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: userId,
          type: type || 'general',
          title: title,
          description: description,
          link: link,
          is_read: false
        })
        .select()
        .single();

      if (dbErr) {
        console.error('[NotificationService] Failed to save notification in database:', dbErr.message);
      }

      // 2. ส่ง Push Notification เข้ามือถือผ่าน Firebase Cloud Messaging (FCM)
      const pushData = {
        type: type || 'general',
        ...(link ? { link } : {}),
        ...data
      };

      const settings = await getNotificationSettings(userId);
      if (isPushEnabled(settings, type)) {
        await sendPushNotification(userId, title, description, pushData).catch((err) => {
          console.error('[NotificationService] Push notification failed:', err.message);
        });
      }

      return dbData;
    } catch (err) {
      console.error('[NotificationService] Error creating notification:', err.message);
      return null;
    }
  }
}

module.exports = new NotificationService();
