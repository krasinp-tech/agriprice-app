/* components/pricegovernment/mock-prices.js
   ข้อมูลจำลอง (แทน Supabase/API ตอนนี้)
*/
(function () {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0,10);

  // ข้อมูลราคาผลไม้ทั้งหมด
  const DB = {
    "ทุเรียน": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "หมอนทอง", min: 150, max: 190, avg: 170 },
        { variety: "ชะนี", min: 120, max: 160, avg: 140 },
        { variety: "กระดุม", min: 80,  max: 120, avg: 100 },
      ]
    },
    "ลองกอง": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "ลองกอง (คละ)", min: 40, max: 65, avg: 52 },
      ]
    },
    "มังคุด": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "มังคุด (คละ)", min: 55, max: 85, avg: 70 },
      ]
    },
    "เงาะ": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "โรงเรียน", min: 28, max: 45, avg: 36 },
        { variety: "สีทอง", min: 22, max: 38, avg: 30 },
      ]
    },
    "ปาล์ม": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "ปาล์มน้อย (คละ)", min: 2.5, max: 3.5, avg: 3.0 },
        { variety: "ปาล์มใหญ่ (คละ)", min: 1.8, max: 2.5, avg: 2.1 },
      ]
    },
    "ยางพารา": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "แผ่นสด (คละ)", min: 45, max: 65, avg: 55 },
        { variety: "หนึ่งน้อย (คละ)", min: 50, max: 70, avg: 60 },
      ]
    },
    "ผักสด": {
      date: fmt(today),
      unit: "กก.",
      rows: [
        { variety: "กะหล่ำปลี", min: 8, max: 15, avg: 11 },
        { variety: "แตงสด", min: 6, max: 12, avg: 9 },
        { variety: "มะเขือเทศ", min: 12, max: 20, avg: 16 },
      ]
    },
    "เมล็ดพันธุ์": {
      date: fmt(today),
      unit: "ถุง",
      rows: [
        { variety: "ข้าวโพด", min: 180, max: 220, avg: 200 },
        { variety: "สุข (คละ)", min: 220, max: 280, avg: 250 },
      ]
    },
    "ไม้ประดับ": {
      date: fmt(today),
      unit: "กระถาง",
      rows: [
        { variety: "กุหลาบสามารถ", min: 80, max: 120, avg: 100 },
        { variety: "ฟลอก์ซ์", min: 40, max: 70, avg: 55 },
      ]
    },
  };

  // expose ให้ไฟล์อื่นเรียก
  window.__GOV_MOCK_DB__ = DB;
})();
