/**
 * js/gov-price-search.js
 * Government Price Search Section (Home Page)
 * ดึงข้อมูลผลไม้และสายพันธุ์จาก /api/fruits และ /api/fruit-varieties
 */

(function govPriceSearch() {
  const API_BASE = (window.API_BASE_URL || 'https://agriprice-app.onrender.com').replace(/\/$/, '');

  // ดึงข้อมูลผลไม้จาก API
  async function loadGovFruits() {
    const category = document.getElementById('govCategory').value;
    const fruitSelect = document.getElementById('govFruit');
    const varietySelect = document.getElementById('govVariety');

    if (!category) {
      fruitSelect.innerHTML = '<option value="">ค้นหาผลผลิต</option>';
      fruitSelect.disabled = true;
      varietySelect.innerHTML = '<option value="">ค้นหาหรือกรอกสายพันธุ์</option>';
      varietySelect.disabled = true;
      return;
    }

    fruitSelect.innerHTML = '<option value="">กำลังโหลด...</option>';
    fruitSelect.disabled = true;

    try {
      const res = await fetch(API_BASE + '/api/fruits');
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'โหลดข้อมูลผลไม้ไม่สำเร็จ');

      fruitSelect.innerHTML = '<option value="">ค้นหาผลผลิต</option>' +
        json.data.map(f => `<option value="${f.fruit_id}">${f.name}</option>`).join('');
      fruitSelect.disabled = false;
    } catch (e) {
      console.error('[gov-price-search] loadGovFruits error:', e);
      fruitSelect.innerHTML = '<option value="">โหลดข้อมูลผลไม้ไม่สำเร็จ</option>';
      fruitSelect.disabled = true;
    }

    varietySelect.innerHTML = '<option value="">ค้นหาหรือกรอกสายพันธุ์</option>';
    varietySelect.disabled = true;
  }

  // ดึงข้อมูลสายพันธุ์จาก API
  async function loadGovVarieties() {
    const fruitId = document.getElementById('govFruit').value;
    const varietySelect = document.getElementById('govVariety');

    if (!fruitId) {
      varietySelect.innerHTML = '<option value="">ค้นหาหรือกรอกสายพันธุ์</option>';
      varietySelect.disabled = true;
      return;
    }

    varietySelect.innerHTML = '<option value="">กำลังโหลด...</option>';
    varietySelect.disabled = true;

    try {
      const res = await fetch(API_BASE + '/api/fruit-varieties?fruit_id=' + encodeURIComponent(fruitId));
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'โหลดสายพันธุ์ไม่สำเร็จ');

      varietySelect.innerHTML = '<option value="">ค้นหาหรือกรอกสายพันธุ์</option>' +
        json.data.map(v => `<option value="${v.variety_id}">${v.name}</option>`).join('');
      varietySelect.disabled = false;
    } catch (e) {
      console.error('[gov-price-search] loadGovVarieties error:', e);
      varietySelect.innerHTML = '<option value="">โหลดสายพันธุ์ไม่สำเร็จ</option>';
      varietySelect.disabled = true;
    }
  }

  // ค้นหาราคาสินค้า
  function govSearch() {
    const category = document.getElementById('govCategory').value;
    const type = document.getElementById('govType').value;
    const fruitId = document.getElementById('govFruit').value;
    const varietyId = document.getElementById('govVariety').value;

    if (!category || !fruitId) {
      alert('กรุณาเลือกหมวดหมู่สินค้าและผลผลิต');
      return;
    }

    // ไปที่หน้า gov-price-lookup เพื่อแสดงผลลัพธ์
    const params = new URLSearchParams({
      category: category,
      type: type,
      fruit_id: fruitId,
      variety_id: varietyId || '',
    });

    window.location.href = 'gov-price-lookup.html?' + params.toString();
  }

  // Export functions to global scope
  window.loadGovFruits = loadGovFruits;
  window.loadGovVarieties = loadGovVarieties;
  window.govSearch = govSearch;
})();
