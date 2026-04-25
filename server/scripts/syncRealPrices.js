require('dotenv').config({ path: './server/.env' });
const { syncDITPrices } = require('../services/ditScraper');

async function main() {
  // ลองดึงข้อมูลของปี 2024 (พ.ศ. 2567) ซึ่งเป็นปีที่มีข้อมูลจริงในระบบ DIT ปัจจุบัน
  const realDate = new Date();
  realDate.setFullYear(2024); // ปรับเป็นปีปัจจุบันที่มีข้อมูลจริง
  
  console.log(`🚀 Starting REAL Price Sync from DIT for year ${realDate.getFullYear()} (พ.ศ. ${realDate.getFullYear() + 543})...`);
  
  try {
    const result = await syncDITPrices(realDate);
    console.log('\n--- Sync Result ---');
    console.log(`✅ Total rows saved: ${result.totalSaved}`);
    console.log('-------------------');
    process.exit(0);
  } catch (error) {
    console.error('❌ Sync Failed:', error.message);
    process.exit(1);
  }
}

main();
