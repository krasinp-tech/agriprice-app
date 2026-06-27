/**
 * services/ditScraper.js
 * ดึงราคาสินค้าเกษตรจากเว็บ DIT (กรมการค้าภายใน) (DEACTIVATED)
 * เปลี่ยนเป็น API หลอก (Stub) เพื่อป้องกันการขูดข้อมูลและการเชื่อมต่อกับฐานข้อมูล
 */

console.log('DIT Scraper: Deactivated (Running stub version)');

async function syncDITPrices(targetDate) {
  console.log('[DIT Scraper] syncDITPrices called (stub mode). No action taken.');
  return {
    totalSaved: 0,
    errors: [],
    details: []
  };
}

// โค้ดตัวสแกนและ cron job ถูกปิดการทำงานเนื่องจากระบบเปลี่ยนไปใช้ Excel ในราคากลางแทน

module.exports = { syncDITPrices };