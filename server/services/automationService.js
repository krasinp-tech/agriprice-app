const logger = require('../utils/logger');
const db = require('../db');
const { supabaseAdmin } = require('../utils/supabase');

const AUTO_SUCCESS_DELAY_MIN = Number(process.env.BOOKING_AUTO_SUCCESS_DELAY_MIN || 5);
const AUTO_SUCCESS_DEBUG = String(process.env.BOOKING_AUTO_SUCCESS_DEBUG || 'true').toLowerCase() === 'true';

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
      .select('booking_id')
      .eq('status', 'waiting')
      .lte('scheduled_time', cutoff)
      .limit(300);

    if (dueErr) throw dueErr;
    if (!dueRows || dueRows.length === 0) return;

    const ids = dueRows.map(r => r.booking_id);
    const { data: updatedRows, error: updErr } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancel' })
      .in('booking_id', ids)
      .select('booking_id');

    if (updErr) throw updErr;

    for (const row of (updatedRows || [])) {
      await db.query(
        'INSERT INTO booking_status_logs (booking_id, old_status, new_status, note) VALUES ($1,$2,$3,$4)',
        [row.booking_id, 'waiting', 'cancel', 'auto-expire (no-show) after delay']
      ).catch(() => {});
    }

    logger.info(`[automation] marked ${updatedRows.length} bookings as missed`);
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
