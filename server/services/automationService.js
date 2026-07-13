const logger = require('../utils/logger');
const { supabaseAdmin } = require('../utils/supabase');

const AUTO_SUCCESS_DELAY_MIN = Number(process.env.BOOKING_AUTO_SUCCESS_DELAY_MIN || 5);
const AUTO_SUCCESS_DEBUG = String(process.env.BOOKING_AUTO_SUCCESS_DEBUG || 'false').toLowerCase() === 'true';

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
      .select('booking_id, slot_id')
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
      .select('booking_id, slot_id');

    if (updErr) throw updErr;

    if (updatedRows && updatedRows.length > 0) {
      logger.info(`[automation] processed ${updatedRows.length} overdue bookings`);
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
    // 1. Deactivate stale slots — ใช้ Supabase filter แทน exec_sql (safer)
    const nowBangkok = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19);
    await supabaseAdmin
      .from('offer_slots')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('end_date', nowBangkok.slice(0, 10)); // end_date < today (Bangkok)

    // ดึงรายการ offer_id ที่ยังมี slot ที่ใช้งานอยู่ (active)
    const { data: activeSlotProductIds } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id')
      .eq('is_active', true);

    const activeIds = (activeSlotProductIds || []).map(r => r.offer_id).filter(Boolean);

    // ดึงรายการ offer_id ทั้งหมดที่มี slot ในระบบ (ทั้ง active และ inactive)
    const { data: allSlotProductIds } = await supabaseAdmin
      .from('offer_slots')
      .select('offer_id');

    const productsWithSlots = (allSlotProductIds || [])
      .map(r => r.offer_id)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i); // ดึงค่าที่ไม่ซ้ำ

    // ค้นหารายการประกาศรับซื้อ (Products) ที่มี slot แต่สล็อตทั้งหมดหมดอายุแล้ว (ไม่อยู่ใน activeIds)
    const expiredProductIds = productsWithSlots.filter(id => !activeIds.includes(id));

    if (expiredProductIds.length > 0) {
      const { error: deactivateErr } = await supabaseAdmin
        .from('buy_offers')
        .update({ is_active: false })
        .eq('is_active', true)
        .in('offer_id', expiredProductIds);

      if (deactivateErr) throw deactivateErr;
      logger.info(`[automation] deactivated ${expiredProductIds.length} products due to expired slots`);
    }
  } catch (err) {
    logger.error('[automation] autoCloseStaleProductsAndSlots failed: ' + err.message);
  }
}

module.exports = {
  autoCompleteDueBookings,
  autoCloseStaleProductsAndSlots,
  AUTO_SUCCESS_SCAN_MS: Math.max(15, Number(process.env.BOOKING_AUTO_SUCCESS_SCAN_SEC || 60)) * 1000
};
