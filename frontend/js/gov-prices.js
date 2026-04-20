/* js/gov-prices.js - Government Price Display Handler */
(function govPricesInit() {
  const API_BASE = (window.API_BASE_URL || 'https://agriprice-app.onrender.com').replace(/\/$/, '');
  const DEBUG_GOV_PRICES = !!window.AGRIPRICE_DEBUG;

  const commodityMap = {
    'ทุเรียน': 'durian',
    'ลองกอง': 'longkong',
    'มังคุด': 'mangosteen',
    'เงาะ': 'rambutan',
    'ปาล์ม': 'palm',
    'ยางพารา': 'rubber',
    'ผักสด': 'vegetable',
    'เมล็ดพันธุ์': 'seed',
    'ไม้ประดับ': 'ornamental',
    'สมุนไพร': 'herb',
  };

  function getStaleDays(dateStr) {
    if (!dateStr) return null;
    const d = new Date(String(dateStr) + 'T00:00:00Z');
    if (Number.isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  function initPriceModal() {
    let modal = document.getElementById('govPriceModal');
    if (!modal) {
      const newModal = document.createElement('div');
      newModal.id = 'govPriceModal';
      newModal.className = 'gov-price-modal';
      newModal.innerHTML = `
        <div class="gov-price-overlay"></div>
        <div class="gov-price-panel">
          <div class="gov-price-header">
            <h3 id="govPriceTitle">ราคากลาง</h3>
            <button class="gov-price-close" aria-label="ปิด">&times;</button>
          </div>
          <div class="gov-price-content">
            <div id="govPriceLoader" class="gov-price-loader">
              <span class="loading-spinner"></span>
              <p>กำลังโหลด...</p>
            </div>
            <div id="govPriceData" class="gov-price-data" style="display: none;">
              <div id="govPriceDate" class="gov-price-date"></div>
              <table class="gov-price-table">
                <thead>
                  <tr>
                    <th>ชั้นพืช</th>
                    <th>ราคาต่ำสุด</th>
                    <th>ราคาสูงสุด</th>
                    <th>ราคาเฉลี่ย</th>
                  </tr>
                </thead>
                <tbody id="govPriceRows"></tbody>
              </table>
              <p id="govPriceSource" class="gov-price-source"></p>
            </div>
            <div id="govPriceError" class="gov-price-error" style="display: none;"></div>
          </div>
        </div>
      `;
      document.body.appendChild(newModal);
      modal = newModal;

      const closeBtn = modal.querySelector('.gov-price-close');
      if (closeBtn) closeBtn.addEventListener('click', closeModal);

      const overlay = modal.querySelector('.gov-price-overlay');
      if (overlay) overlay.addEventListener('click', closeModal);
    }
    return modal;
  }

  async function fetchGovPrice(commodityDisplay) {
    const modal = initPriceModal();
    const commodity = commodityMap[commodityDisplay] || commodityDisplay;
    modal.dataset.currentCommodityDisplay = commodityDisplay;

    document.getElementById('govPriceLoader').style.display = 'flex';
    document.getElementById('govPriceData').style.display = 'none';
    document.getElementById('govPriceError').style.display = 'none';
    document.getElementById('govPriceTitle').textContent = `ราคากลาง - ${commodityDisplay}`;
    modal.style.display = 'flex';

    try {
      const requestUrl = `${API_BASE}/api/gov-prices/${encodeURIComponent(commodity)}`;

      if (DEBUG_GOV_PRICES) {
        console.log('[gov-prices-check] request', {
          commodityDisplay,
          commodity,
          requestUrl,
        });
      }

      const res = await fetch(requestUrl);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.message || 'ไม่พบข้อมูล');
      }

      document.getElementById('govPriceLoader').style.display = 'none';
      document.getElementById('govPriceData').style.display = 'block';

      const effectiveDate = json.date || null;

      if (DEBUG_GOV_PRICES) {
        console.log('[gov-prices-check] response', {
          commodity,
          responseDate: json.date || null,
          effectiveDate,
          rows: Array.isArray(json.rows) ? json.rows.length : 0,
          updatedAt: json.updated_at || null,
          source: json.source || null,
        });
      }

      const dateStr = effectiveDate
        ? new Date(effectiveDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'ไม่ระบุ';
      document.getElementById('govPriceDate').textContent = `วันที่ล่าสุดของ ${commodityDisplay}: ${dateStr}`;

      const tbody = document.getElementById('govPriceRows');
      tbody.innerHTML = '';

      if (json.rows && json.rows.length > 0) {
        json.rows.forEach((row) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${row.variety || `${commodity} (คละ)`}</td>
            <td>${row.min ? row.min.toFixed(2) : '-'} ${json.unit}</td>
            <td>${row.max ? row.max.toFixed(2) : '-'} ${json.unit}</td>
            <td><strong>${row.avg ? row.avg.toFixed(2) : '-'}</strong> ${json.unit}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="4">ไม่พบข้อมูลราคา</td></tr>';
      }

      const staleDays = getStaleDays(effectiveDate);
      const staleNote = staleDays !== null && staleDays > 7
        ? ` (ข้อมูลล่าสุดเมื่อ ${staleDays} วันก่อน)`
        : '';

      let updatedTimeNote = '';
      if (json.updated_at) {
        const t = new Date(json.updated_at);
        if (!Number.isNaN(t.getTime())) {
          updatedTimeNote = ` | เวลาอัปเดต: ${t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
        }
      }

      document.getElementById('govPriceSource').textContent = `ที่มา: ${json.source || 'dit.go.th'}${updatedTimeNote}${staleNote}`;
    } catch (err) {
      console.error('[govPrices] Error:', err);
      document.getElementById('govPriceLoader').style.display = 'none';
      document.getElementById('govPriceError').style.display = 'block';
      document.getElementById('govPriceError').textContent = `เกิดข้อผิดพลาด: ${err.message}`;
    }
  }

  function closeModal() {
    const modal = document.getElementById('govPriceModal');
    if (modal) modal.style.display = 'none';
  }

  function attachClickHandlers() {
    const carousel = document.getElementById('productTabsCarousel');
    if (!carousel || window.govPricesCarouselListenerAttached) return;

    function resolveClickedItem(e) {
      if (e.target && typeof e.target.closest === 'function') {
        const direct = e.target.closest('.product-item, .gov-price-card');
        if (direct && carousel.contains(direct)) return direct;
      }

      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      for (const node of path) {
        if (!node || !node.classList) continue;
        if (
          (node.classList.contains('product-item') || node.classList.contains('gov-price-card')) &&
          carousel.contains(node)
        ) {
          return node;
        }
      }

      if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        const hit = document.elementFromPoint(e.clientX, e.clientY);
        if (hit && typeof hit.closest === 'function') {
          const byPoint = hit.closest('.product-item, .gov-price-card');
          if (byPoint && carousel.contains(byPoint)) return byPoint;
        }
      }

      return null;
    }

    carousel.addEventListener(
      'click',
      function (e) {
        const target = resolveClickedItem(e);
        if (!target) return;

        const fromDataset = (target.dataset && target.dataset.name ? target.dataset.name : '').trim();
        const fromSpan = target.querySelector('span') ? target.querySelector('span').textContent.trim() : '';
        const commodityDisplay = fromDataset || fromSpan || (target.textContent || '').trim();
        const cleanCommodity = commodityDisplay.replace(/ \d+$/, '');

        if (cleanCommodity && commodityMap[cleanCommodity]) {
          e.preventDefault();
          e.stopPropagation();
          fetchGovPrice(cleanCommodity);
        }
      },
      true
    );

    window.govPricesCarouselListenerAttached = true;
  }

  function init() {
    initPriceModal();
    attachClickHandlers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
