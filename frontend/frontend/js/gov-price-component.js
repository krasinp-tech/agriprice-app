/**
 * gov-price-component.js
 * ─────────────────────────────────────────────────────────────
 * ดึงราคาสินค้าเกษตรจาก MOC Open Data API
 * endpoint: https://dataapi.moc.go.th/gis-product-price
 *
 * วิธีใช้งาน:
 *   1. ใส่ div ใน HTML:   <div id="govPriceWidget"></div>
 *   2. โหลด script นี้
 *   3. เรียก:  GovPriceWidget.init('govPriceWidget')
 *
 * ⚠️  หมายเหตุ CORS:
 *   API นี้อาจบล็อก browser-direct requests (CORS)
 *   ถ้าใช้งานจาก WebView ใน Cordova/Capacitor อาจผ่านได้
 *   แต่ถ้า dev บน desktop browser ต้องใช้ backend proxy
 *   ดูตัวอย่าง proxy ด้านล่าง
 */

window.GovPriceWidget = (function () {

  // ── API ──────────────────────────────────────────────────────
  const API_URL = 'https://dataapi.moc.go.th/gis-product-price';

  // ── Product catalog ──────────────────────────────────────────
  const PRODUCTS = {
    'เนื้อสัตว์': [
      { id: 'P11009', name: 'ไก่สดทั้งตัว (รวมเครื่องใน)' },
      { id: 'P11012', name: 'ไก่สดชำแหละ เนื้ออก (เนื้อล้วน)' },
      { id: 'P11013', name: 'ไก่สดชำแหละ น่อง สะโพก' },
      { id: 'P11025', name: 'ไข่ไก่ เบอร์ 0' },
      { id: 'P11026', name: 'ไข่ไก่ เบอร์ 1' },
      { id: 'P11027', name: 'ไข่ไก่ เบอร์ 2' },
      { id: 'P11001', name: 'สุกรชำแหละ เนื้อสัน สันใน' },
      { id: 'P11005', name: 'สุกรชำแหละ เนื้อสามชั้น' },
      { id: 'P11031', name: 'เนื้อโค สะโพก' },
      { id: 'P11032', name: 'เนื้อโค สันนอก' },
      { id: 'P11020', name: 'ไข่เป็ด ใหญ่' },
    ],
    'สัตว์น้ำ': [
      { id: 'P12001', name: 'ปลานิล (ขนาดกลาง)' },
      { id: 'P12002', name: 'ปลาดุก (ขนาดกลาง)' },
      { id: 'P12003', name: 'ปลาช่อน (ขนาดกลาง)' },
      { id: 'P12010', name: 'กุ้งขาว (ขนาดกลาง 51-60)' },
      { id: 'P12011', name: 'กุ้งขาว (ขนาดใหญ่ 31-40)' },
      { id: 'P12020', name: 'หมึกกล้วย' },
      { id: 'P12021', name: 'ปูม้า' },
    ],
    'ผักสด': [
      { id: 'P13001', name: 'ผักกาดขาว' },
      { id: 'P13002', name: 'ผักคะน้า' },
      { id: 'P13003', name: 'กวางตุ้ง' },
      { id: 'P13004', name: 'ผักบุ้งจีน' },
      { id: 'P13005', name: 'แตงกวา' },
      { id: 'P13006', name: 'มะเขือเทศ' },
      { id: 'P13007', name: 'พริกชี้ฟ้าแดง' },
      { id: 'P13008', name: 'พริกขี้หนู' },
      { id: 'P13010', name: 'หอมแดง' },
      { id: 'P13011', name: 'กระเทียม' },
    ],
    'ผลไม้': [
      { id: 'P14001', name: 'กล้วยหอม' },
      { id: 'P14002', name: 'กล้วยน้ำว้า' },
      { id: 'P14010', name: 'มะม่วงน้ำดอกไม้' },
      { id: 'P14020', name: 'ทุเรียน หมอนทอง' },
      { id: 'P14021', name: 'ลองกอง' },
      { id: 'P14022', name: 'มังคุด' },
      { id: 'P14023', name: 'เงาะโรงเรียน' },
      { id: 'P14030', name: 'ส้มเขียวหวาน' },
      { id: 'P14040', name: 'แตงโม' },
      { id: 'P14041', name: 'สับปะรด' },
    ],
    'ธัญพืช / ข้าว': [
      { id: 'P15001', name: 'ข้าวสารขาว 5% (บรรจุถุง)' },
      { id: 'P15002', name: 'ข้าวสารขาว 25% (บรรจุถุง)' },
      { id: 'P15003', name: 'ข้าวสารเหนียว' },
      { id: 'P15004', name: 'ข้าวสารหอมมะลิ' },
      { id: 'P15010', name: 'ข้าวโพดเลี้ยงสัตว์' },
    ],
    'พืชน้ำมัน': [
      { id: 'P17001', name: 'น้ำมันปาล์มบริสุทธิ์ (ขวด 1 ลิตร)' },
      { id: 'P17002', name: 'น้ำมันถั่วเหลือง (ขวด 1 ลิตร)' },
      { id: 'P17010', name: 'ปาล์มน้ำมัน (ผลสด)' },
    ],
  };

  // ── CSS (inject once) ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('_govPriceCSS')) return;
    const style = document.createElement('style');
    style.id = '_govPriceCSS';
    style.textContent = `
.gpw { font-family: 'Sarabun','Noto Sans Thai',sans-serif; color: #1a1a2e; }
.gpw-filter { background:#f8faf9; border-radius:14px; padding:14px; margin-bottom:14px; border:1px solid #e2ece6; }
.gpw-filter-title { font-size:12px; font-weight:700; color:#6c757d; text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
.gpw-filter-title::before { content:''; width:3px; height:12px; background:#0B853C; border-radius:2px; display:inline-block; }
.gpw-selwrap { position:relative; margin-bottom:8px; }
.gpw-selwrap select, .gpw-input {
  width:100%; height:44px; padding:0 36px 0 12px;
  border:1.5px solid #dee2e6; border-radius:10px;
  background:#fff; font-family:inherit; font-size:14px;
  font-weight:600; color:#1a1a2e; appearance:none;
  -webkit-appearance:none; outline:none; cursor:pointer;
  transition:border-color .2s;
}
.gpw-selwrap select:focus, .gpw-input:focus { border-color:#0B853C; }
.gpw-selwrap select:disabled { background:#f1f3f5; color:#adb5bd; cursor:not-allowed; }
.gpw-arrow { position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:#adb5bd; font-size:10px; }
.gpw-daterow { display:grid; grid-template-columns:1fr auto 1fr; gap:6px; align-items:center; margin-bottom:10px; }
.gpw-daterow input[type=date] {
  width:100%; height:44px; padding:0 10px;
  border:1.5px solid #dee2e6; border-radius:10px;
  font-family:inherit; font-size:12px; font-weight:600;
  color:#1a1a2e; outline:none; background:#fff;
  transition:border-color .2s;
}
.gpw-daterow input:focus { border-color:#0B853C; }
.gpw-sep { font-size:11px; color:#adb5bd; font-weight:700; text-align:center; }
.gpw-btn {
  width:100%; height:48px; border:none; border-radius:10px;
  background:linear-gradient(135deg,#0B853C,#00c951);
  color:#fff; font-family:inherit; font-size:15px;
  font-weight:800; cursor:pointer; display:flex;
  align-items:center; justify-content:center; gap:8px;
  transition:opacity .2s, transform .15s;
  box-shadow:0 4px 12px rgba(11,133,60,.28);
  -webkit-tap-highlight-color:transparent;
}
.gpw-btn:active { transform:scale(.97); opacity:.9; }
.gpw-btn:disabled { background:#dee2e6; color:#adb5bd; box-shadow:none; cursor:not-allowed; }
.gpw-spin {
  width:16px; height:16px; border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff; border-radius:50%;
  animation:gpwSpin .8s linear infinite; display:inline-block;
}
@keyframes gpwSpin { to { transform:rotate(360deg); } }
.gpw-loading { text-align:center; padding:32px 0; color:#adb5bd; font-size:13px; font-weight:600; }
.gpw-empty { text-align:center; padding:32px 0; }
.gpw-empty-icon { font-size:36px; margin-bottom:8px; }
.gpw-empty-title { font-size:14px; font-weight:700; color:#343a40; }
.gpw-empty-sub { font-size:12px; color:#adb5bd; margin-top:4px; }
.gpw-error { background:#fff5f5; border:1px solid #fecaca; border-radius:10px; padding:12px 14px; margin-bottom:10px; font-size:12px; color:#b91c1c; font-weight:600; line-height:1.6; }
.gpw-reshead { background:#f0faf4; border-radius:12px; padding:12px 14px; margin-bottom:10px; border:1px solid rgba(11,133,60,.12); }
.gpw-reshead-name { font-size:15px; font-weight:800; color:#0B853C; margin-bottom:2px; }
.gpw-reshead-unit { font-size:12px; color:#555; font-weight:600; }
.gpw-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
.gpw-chip { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:rgba(11,133,60,.1); color:#0B853C; }
.gpw-avg-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
.gpw-avg-card { background:#fff; border-radius:10px; border:1px solid #e9ecef; padding:12px; text-align:center; }
.gpw-avg-card-lbl { font-size:10px; font-weight:700; color:#adb5bd; text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
.gpw-avg-card-val { font-size:20px; font-weight:800; }
.gpw-avg-card-unit { font-size:10px; color:#adb5bd; font-weight:600; margin-top:2px; }
.gpw-avg-card.low .gpw-avg-card-val { color:#0ea5e9; }
.gpw-avg-card.high .gpw-avg-card-val { color:#e53935; }
.gpw-table-wrap { background:#fff; border-radius:12px; border:1px solid #e9ecef; overflow:hidden; margin-bottom:12px; }
.gpw-table-hdr { background:#f8f9fa; padding:8px 12px; display:grid; grid-template-columns:1fr 1fr 1fr; border-bottom:1px solid #e9ecef; }
.gpw-table-hdr-cell { font-size:10px; font-weight:800; color:#6c757d; text-transform:uppercase; letter-spacing:.3px; text-align:center; }
.gpw-table-hdr-cell:first-child { text-align:left; }
.gpw-table-row { display:grid; grid-template-columns:1fr 1fr 1fr; padding:9px 12px; border-bottom:1px solid #f1f3f5; align-items:center; }
.gpw-table-row:last-child { border-bottom:none; }
.gpw-row-date { font-size:11px; font-weight:700; color:#343a40; }
.gpw-row-range { font-size:11px; font-weight:600; color:#6c757d; text-align:center; }
.gpw-row-avg { font-size:12px; font-weight:800; color:#0B853C; text-align:right; }
.gpw-range-low { color:#0ea5e9; }
.gpw-range-high { color:#e53935; }
.gpw-src { text-align:center; font-size:11px; color:#adb5bd; font-weight:600; padding:4px 0 8px; }
.gpw-cors-note { background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 12px; font-size:12px; color:#92400e; font-weight:600; line-height:1.6; margin-bottom:10px; }
    `;
    document.head.appendChild(style);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(isoStr) {
    const d = new Date(isoStr);
    return d.getDate().toString().padStart(2,'0') + '/' +
      (d.getMonth()+1).toString().padStart(2,'0') + '/' +
      (d.getFullYear() + 543).toString().slice(-2);
  }

  // ── Build HTML ────────────────────────────────────────────────
  function buildWidget(container) {
    const catOptions = Object.keys(PRODUCTS)
      .map(c => `<option value="${c}">${c}</option>`)
      .join('');

    container.innerHTML = `
      <div class="gpw">
        <div class="gpw-filter">
          <div class="gpw-filter-title">ค้นหาราคาสินค้าเกษตร</div>

          <div class="gpw-selwrap">
            <select id="_gpw_cat">
              <option value="">-- เลือกหมวดสินค้า --</option>
              ${catOptions}
            </select>
            <span class="gpw-arrow">▼</span>
          </div>

          <div class="gpw-selwrap">
            <select id="_gpw_prod" disabled>
              <option value="">-- เลือกหมวดสินค้าก่อน --</option>
            </select>
            <span class="gpw-arrow">▼</span>
          </div>

          <div class="gpw-daterow">
            <input type="date" id="_gpw_from" value="${daysAgoStr(29)}" />
            <span class="gpw-sep">ถึง</span>
            <input type="date" id="_gpw_to" value="${todayStr()}" />
          </div>

          <button class="gpw-btn" id="_gpw_btn">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            ดูราคาสินค้า
          </button>
        </div>

        <div id="_gpw_results"></div>
        <div class="gpw-src">ข้อมูลจาก กรมการค้าภายใน กระทรวงพาณิชย์</div>
      </div>
    `;

    // Events
    document.getElementById('_gpw_cat').addEventListener('change', function() {
      const sel = document.getElementById('_gpw_prod');
      const items = PRODUCTS[this.value] || [];
      sel.innerHTML = items.length
        ? '<option value="">-- เลือกสินค้า --</option>' +
          items.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
        : '<option value="">-- เลือกหมวดสินค้าก่อน --</option>';
      sel.disabled = !items.length;
    });

    document.getElementById('_gpw_btn').addEventListener('click', doSearch);
  }

  // ── Fetch ─────────────────────────────────────────────────────
  async function doSearch() {
    const productId = document.getElementById('_gpw_prod').value;
    const fromDate  = document.getElementById('_gpw_from').value;
    const toDate    = document.getElementById('_gpw_to').value;
    const results   = document.getElementById('_gpw_results');
    const btn       = document.getElementById('_gpw_btn');

    if (!productId) return setRes(results, emptyHTML('กรุณาเลือกสินค้า', '📋'));
    if (!fromDate || !toDate) return setRes(results, emptyHTML('กรุณาเลือกช่วงวันที่', '📅'));

    btn.disabled = true;
    btn.innerHTML = '<span class="gpw-spin"></span> กำลังโหลด...';
    setRes(results, `<div class="gpw-loading">⏳ กำลังดึงข้อมูล...</div>`);

    try {
      const url = `${API_URL}?product_id=${productId}&from_date=${fromDate}&to_date=${toDate}`;
      const res = await fetch(url, { mode: 'cors', headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRes(results, renderData(data, productId));
    } catch (err) {
      const isCors = err.message.includes('fetch') || err.message.includes('network') || err.message.includes('CORS');
      if (isCors) {
        setRes(results, `
          <div class="gpw-cors-note">
            ⚠️ <strong>CORS Error</strong> — API บล็อกการเรียกจาก browser โดยตรง<br>
            ต้องใช้ <strong>backend proxy</strong> หรือเรียกจาก server ของคุณ<br><br>
            <strong>Endpoint:</strong><br>
            <code style="font-size:10px;word-break:break-all;">
            GET https://dataapi.moc.go.th/gis-product-price<br>
            ?product_id=${productId}&from_date=${fromDate}&to_date=${toDate}
            </code>
          </div>
        `);
      } else {
        setRes(results, `<div class="gpw-error">⚠️ เกิดข้อผิดพลาด: ${err.message}</div>`);
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> ดูราคาสินค้า`;
    }
  }

  // ── Render data ───────────────────────────────────────────────
  function renderData(data, productId) {
    let productName = productId;
    for (const items of Object.values(PRODUCTS)) {
      const found = items.find(p => p.id === productId);
      if (found) { productName = found.name; break; }
    }
    const priceList = data.price_list || [];
    const unit = data.unit || 'กก.';
    const minAvg = parseFloat(data.price_min_avg) || 0;
    const maxAvg = parseFloat(data.price_max_avg) || 0;
    const category = data.category_name || '';
    const group = data.group_name || '';

    if (!priceList.length) return emptyHTML('ไม่พบข้อมูลในช่วงวันที่ที่เลือก', '📭');

    const rows = priceList.map(item => {
      const min = parseFloat(item.price_min) || 0;
      const max = parseFloat(item.price_max) || 0;
      const avg = (min + max) / 2;
      return `
        <div class="gpw-table-row">
          <div class="gpw-row-date">${fmtDate(item.date)}</div>
          <div class="gpw-row-range">
            <span class="gpw-range-low">${min.toFixed(2)}</span>
            <span style="color:#dee2e6;margin:0 2px">-</span>
            <span class="gpw-range-high">${max.toFixed(2)}</span>
          </div>
          <div class="gpw-row-avg">${avg.toFixed(2)}</div>
        </div>`;
    }).join('');

    return `
      <div class="gpw-reshead">
        <div class="gpw-reshead-name">${productName}</div>
        <div class="gpw-reshead-unit">หน่วย: ${unit}</div>
        <div class="gpw-chips">
          ${category ? `<span class="gpw-chip">${category}</span>` : ''}
          ${group ? `<span class="gpw-chip">${group}</span>` : ''}
          <span class="gpw-chip">${priceList.length} วัน</span>
        </div>
      </div>
      <div class="gpw-avg-row">
        <div class="gpw-avg-card low">
          <div class="gpw-avg-card-lbl">ต่ำสุด (เฉลี่ย)</div>
          <div class="gpw-avg-card-val">${minAvg.toFixed(2)}</div>
          <div class="gpw-avg-card-unit">บาท/${unit}</div>
        </div>
        <div class="gpw-avg-card high">
          <div class="gpw-avg-card-lbl">สูงสุด (เฉลี่ย)</div>
          <div class="gpw-avg-card-val">${maxAvg.toFixed(2)}</div>
          <div class="gpw-avg-card-unit">บาท/${unit}</div>
        </div>
      </div>
      <div class="gpw-table-wrap">
        <div class="gpw-table-hdr">
          <div class="gpw-table-hdr-cell">วันที่</div>
          <div class="gpw-table-hdr-cell">ต่ำสุด-สูงสุด</div>
          <div class="gpw-table-hdr-cell" style="text-align:right">เฉลี่ย</div>
        </div>
        ${rows}
      </div>
    `;
  }

  function emptyHTML(msg, icon = '🔍') {
    return `<div class="gpw-empty"><div class="gpw-empty-icon">${icon}</div><div class="gpw-empty-title">${msg}</div><div class="gpw-empty-sub">ลองเลือกข้อมูลอื่น</div></div>`;
  }
  function setRes(el, html) { el.innerHTML = html; }

  // ── Public API ────────────────────────────────────────────────
  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) { console.error('[GovPriceWidget] container not found:', containerId); return; }
    injectStyles();
    buildWidget(container);
  }

  return { init };

})();

/*
─────────────────────────────────────────────────────────────────
  ⚠️  CORS NOTE — สำหรับ Production

  API: https://dataapi.moc.go.th ไม่ได้เปิด CORS ให้ browser ทุกที่
  ถ้าใช้งานใน Cordova/Capacitor บน device จริงอาจผ่านได้
  แต่ถ้า dev บน browser ต้องทำ backend proxy เช่น:

  ── Node.js (Express) proxy ──────────────────────────────────
  app.get('/api/price', async (req, res) => {
    const { product_id, from_date, to_date } = req.query;
    const url = `https://dataapi.moc.go.th/gis-product-price`
              + `?product_id=${product_id}&from_date=${from_date}&to_date=${to_date}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  });

  แล้วเปลี่ยน API_URL ใน widget เป็น '/api/price'
─────────────────────────────────────────────────────────────────
*/