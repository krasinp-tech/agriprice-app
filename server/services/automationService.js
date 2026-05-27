const logger = require('../utils/logger');
const db = require('../db');
const { supabaseAdmin } = require('../utils/supabase');

const AUTO_SUCCESS_DELAY_MIN = Number(process.env.BOOKING_AUTO_SUCCESS_DELAY_MIN || 5);
const AUTO_SUCCESS_DEBUG = String(process.env.BOOKING_AUTO_SUCCESS_DEBUG || 'true').toLowerCase() === 'true';

function formatThaiDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function buildCancelNotification(booking, recipientRole) {
  const scheduleText = booking.scheduled_time ? formatThaiDateTime(booking.scheduled_time) : '-';
  const queueText = booking.queue_no ? `คิว ${booking.queue_no}` : 'คิวของคุณ';

  if (recipientRole === 'buyer') {
    return {
      title: 'คิวถูกยกเลิกอัตโนมัติ',
      description: `${queueText} ถูกยกเลิกอัตโนมัติ เนื่องจากเกษตรกรไม่ได้เช็คอินตามเวลานัด ${scheduleText}`,
    };
  }

  return {
    title: 'คุณถูกยกเลิกคิวอัตโนมัติ',
    description: `${queueText} ถูกยกเลิกอัตโนมัติ เนื่องจากเลยเวลานัด ${scheduleText} กรุณาตรวจสอบและจองคิวใหม่`,
  };
}

async function sendCancellationNotification(booking) {
  const recipients = [
    { userId: booking.farmer_id, role: 'farmer' },
    { userId: booking.buyer_id, role: 'buyer' },
  ].filter(item => !!item.userId);

  if (!recipients.length) return;

  const payloads = recipients.map(({ userId, role }) => {
    const message = buildCancelNotification(booking, role);
    return {
      user_id: userId,
      type: 'booking',
      title: message.title,
      description: message.description,
      is_read: false,
    };
  });

  const { error } = await supabaseAdmin
    .from('notifications')
    .insert(payloads);

  if (error) {
    throw error;
  }
}

/**
 * [Background Service] หุ่นยนต์ทำงานเบื้องหลังอัตโนมัติ (Cron Job)
 * ฟังก์ชัน 1: ตรวจสอบคิวที่ "เลยเวลา" และเปลี่ยนสถานะเป็น "ยกเลิก (cancel)" อัตโนมัติ
 * เพื่อป้องกันปัญหา Farmer จองแล้วไม่มาตามนัด ทำให้คิวค้าง
 */
async function autoCompleteDueBookings() {
  try {
    const cutoff = new Date(Date.now() - AUTO_SUCCESS_DELAY_MIN * 60 * 1000).toISOString();
    
    if (AUTO_SUCCESS_DEBUG) {
      logger.info(`[automation] scan started cutoff=${cutoff}`);
    }

    const { data: dueRows, error: dueErr } = await supabaseAdmin
      .from('bookings')
      .select('booking_id, booking_no, queue_no, scheduled_time, farmer_id, buyer_id')
      .eq('status', 'waiting')
      .lte('scheduled_time', cutoff)
      .limit(300);

    if (dueErr) throw dueErr;
    if (!dueRows || dueRows.length === 0) return;

    // Filter to only bookings that are scheduled for *today* in Asia/Bangkok timezone.
    // This prevents auto-cancelling bookings that are scheduled for future dates (e.g. tomorrow).
    const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowBkk = new Date(Date.now() + BKK_OFFSET_MS);
    const todayBkkYMD = nowBkk.toISOString().slice(0, 10); // YYYY-MM-DD
    const filteredDueRows = (dueRows || []).filter(r => {
      try {
        if (!r || !r.scheduled_time) return false;
        const sch = new Date(r.scheduled_time);
        const schBkk = new Date(sch.getTime() + BKK_OFFSET_MS);
        const schYMD = schBkk.toISOString().slice(0, 10);
        return schYMD === todayBkkYMD;
      } catch (e) {
        return false;
      }
    });

    if (!filteredDueRows || filteredDueRows.length === 0) {
      if (AUTO_SUCCESS_DEBUG) {
        logger.info('[automation] no due bookings in Bangkok today; skipping');
      }
      return;
    }

    const ids = filteredDueRows.map(r => r.booking_id);
    const { data: updatedRows, error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancel' })
      .in('booking_id', ids)
      .select('booking_id, booking_no, queue_no, scheduled_time, farmer_id, buyer_id');

    if (updErr) throw updErr;

    for (const booking of updatedRows || []) {
      await sendCancellationNotification(booking).catch(err => {
        logger.warn('[automation] notification create failed: ' + err.message);
      });
    }

    logger.info(`[automation] marked ${(updatedRows || []).length} bookings as missed`);
  } catch (err) {
    logger.warn('[automation] autoCompleteDueBookings failed: ' + err.message);
  }
}

/**
 * [Background Service] หุ่นยนต์ทำงานเบื้องหลังอัตโนมัติ (Cron Job)
 * ฟังก์ชัน 2: ตรวจสอบ "รอบเวลารับซื้อ" (Slot) และ "ประกาศรับซื้อ" (Product) ที่หมดอายุ
 * ถ้าหมดเวลาแล้ว จะถูกปิดการมองเห็นอัตโนมัติ (is_active = false)
 */
async function autoCloseStaleProductsAndSlots() {
  try {
    // 1. Deactivate stale slots
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        UPDATE public.product_slots
        SET is_active = false
        WHERE is_active = true
        AND (end_date || ' ' || COALESCE(time_end, '23:59:59'))::timestamp < (NOW() AT TIME ZONE 'UTC' + INTERVAL '7 hours' - INTERVAL '1 hour');
      `
    });

    // 2. Deactivate products with no active slots
    await supabaseAdmin.rpc('exec_sql', {
      sql: `
        UPDATE public.products p
        SET is_active = false
        WHERE p.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM public.product_slots s
          WHERE s.product_id = p.product_id AND s.is_active = true
        );
      `
    });
  } catch (err) {
    logger.error('[automation] autoCloseStaleProductsAndSlots failed: ' + err.message);
  }
}

module.exports = {
  autoCompleteDueBookings,
  autoCloseStaleProductsAndSlots,
  AUTO_SUCCESS_SCAN_MS: Math.max(15, Number(process.env.BOOKING_AUTO_SUCCESS_SCAN_SEC || 60)) * 1000
};
