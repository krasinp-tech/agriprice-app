/* components/pricegovernment/government-price-card.js */
(function () {
  // ── Config ─────────────────────────────────────────────────
  // เปลี่ยน BASE_URL ให้ตรงกับ server ของคุณ
  const BASE_URL = window.__API_BASE__ || 'http://localhost:5000';

  // ── Query param ────────────────────────────────────────────
  function getQuery(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  const commodityParam = getQuery('commodity') || 'ทุเรียน';
  const commodity = commodityParam.replace(/\s+\d+$/, '');

  // ── DOM refs ───────────────────────────────────────────────
  const backBtn      = document.getElementById('backBtn');
  const commodityTag = document.getElementById('commodityTag');
  const dateTag      = document.getElementById('dateTag');
  const stateEl      = document.getElementById('state');
  const tableWrap    = document.getElementById('tableWrap');

  if (backBtn) backBtn.addEventListener('click', () => window.history.back());
  if (commodityTag) commodityTag.textContent = commodity;

  // ── State helpers ──────────────────────────────────────────
  function setLoading(text) {
    if (stateEl) stateEl.innerHTML = `<div class="loading">${text || 'กำลังโหลด...'}</div>`;
  }
  function setError(text) {
    if (stateEl) stateEl.innerHTML = `<div class="error">${text || 'โหลดข้อมูลไม่สำเร็จ'}</div>`;
  }
  function clearState() {
    if (stateEl) stateEl.innerHTML = '';
  }

  // ── Render table ───────────────────────────────────────────
  function renderTable(data) {
    if (!tableWrap) return;
    const unit = data.unit || '-';
    tableWrap.innerHTML = `
      <table class="price-table" aria-label="Government price table">
        <thead>
          <tr>
            <th style="width:40%">สายพันธุ์</th>
            <th>ต่ำสุด (${unit})</th>
            <th>สูงสุด (${unit})</th>
            <th>เฉลี่ย (${unit})</th>
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `
            <tr>
              <td>${r.variety || '-'}</td>
              <td>${r.min  ?? '-'}</td>
              <td>${r.max  ?? '-'}</td>
              <td>${r.avg  ?? '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Fetch จาก API จริง ─────────────────────────────────────
  async function fetchFromAPI() {
    const url = `${BASE_URL}/api/gov-prices/${encodeURIComponent(commodity)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (!json || !json.success) return null;
    return {
      date: json.date,
      unit: json.unit,
      rows: json.rows || [],
    };
  }

  // ── Main load ──────────────────────────────────────────────
  async function load() {
    setLoading('กำลังโหลดราคากลาง...');

    let data = null;
    let source = '';

    // ดึงจาก API จริงเท่านั้น
    try {
      data   = await fetchFromAPI();
      source = 'api';
    } catch (e) {
      console.warn('[gov-price-card] API fetch ล้มเหลว:', e.message);
    }

    // ไม่มีข้อมูล
    if (!data) {
      clearState();
      if (dateTag) dateTag.textContent = '';
      setError(`ยังไม่มีข้อมูลราคาของ "${commodity}"`);
      if (tableWrap) tableWrap.innerHTML = '';
      return;
    }

    clearState();
    if (dateTag) {
      dateTag.textContent = `อัปเดต: ${data.date || '-'}`;
    }
    renderTable(data);
  }

  load();
})();
