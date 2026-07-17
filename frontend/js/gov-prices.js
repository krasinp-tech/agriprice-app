/* js/gov-prices.js - Government Price Display Handler */
(function govPricesInit() {
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
            <h3 id="govPriceTitle">${window.i18nT ? window.i18nT('gov_price', 'ราคากลาง') : 'ราคากลาง'}</h3>
            <button class="gov-price-close" aria-label="${window.i18nT ? window.i18nT('close', 'ปิด') : 'ปิด'}">&times;</button>
          </div>
          <div class="gov-price-content">
            <div id="govPriceLoader" class="gov-price-loader">
              <span class="loading-spinner"></span>
              <p>${window.i18nT ? window.i18nT('loading', 'กำลังโหลด...') : 'กำลังโหลด...'}</p>
            </div>
            <div id="govPriceData" class="gov-price-data" style="display: none;">
              <div id="govPriceDate" class="gov-price-date"></div>
              <table class="gov-price-table">
                <thead>
                  <tr>
                    <th style="text-align: left;">${window.i18nT ? window.i18nT('variety', 'สายพันธุ์') : 'สายพันธุ์'}</th>
                    <th style="text-align: right;">${window.i18nT ? window.i18nT('min_price', 'ราคาขั้นต่ำ') : 'ราคาขั้นต่ำ'}</th>
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
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = window.api && window.api.getBase ? window.api.getBase() : (window.API_BASE_URL || '').replace(/\/$/, '');
    
    const modal = initPriceModal();
    const commodity = commodityMap[commodityDisplay] || commodityDisplay;
    modal.dataset.currentCommodityDisplay = commodityDisplay;

    document.getElementById('govPriceLoader').style.display = 'flex';
    document.getElementById('govPriceData').style.display = 'none';
    document.getElementById('govPriceError').style.display = 'none';

    const govPriceText = window.i18nT ? window.i18nT('gov_price', 'ราคากลาง') : 'ราคากลาง';
    document.getElementById('govPriceTitle').textContent = `${govPriceText} - ${commodityDisplay}`;
    modal.style.display = 'flex';

    try {
      const requestUrl = `${currentBase}/api/gov-prices/${encodeURIComponent(commodity)}`;

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
        throw new Error(window.i18nApiMessage?.(json.message, 'no_result') || (window.i18nT ? window.i18nT('no_result', 'ไม่พบข้อมูล') : 'ไม่พบข้อมูล'));
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

      const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
      const locale = lang === 'en' ? 'en-US' : (lang === 'zh' ? 'zh-CN' : 'th-TH');

      const dateStr = effectiveDate
        ? new Date(effectiveDate).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : (window.i18nT ? window.i18nT('not_specified', 'ไม่ระบุ') : 'ไม่ระบุ');
      
      const latestOfText = window.i18nT ? window.i18nT('latest_date_of', 'วันที่ล่าสุดของ') : 'วันที่ล่าสุดของ';
      const commodityLabel = window.i18nT ? window.i18nT(commodity, commodityDisplay) : commodityDisplay;
      document.getElementById('govPriceDate').textContent = `${latestOfText} ${commodityLabel}: ${dateStr}`;

      const tbody = document.getElementById('govPriceRows');
      tbody.innerHTML = '';

      if (json.rows && json.rows.length > 0) {
        json.rows.forEach((row) => {
          const tr = document.createElement('tr');
          const mixedLabel = window.i18nT ? window.i18nT('mixed', 'คละ') : 'คละ';
          tr.innerHTML = `
            <td style="text-align: left;">${row.variety || `${commodityLabel} (${mixedLabel})`}</td>
            <td style="text-align: right;"><strong>฿${row.min ? row.min.toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '-'}</strong> / ${json.unit || 'กก.'}</td>
          `;
          tbody.appendChild(tr);
        });
      } else {
        const noDataText = window.i18nT ? window.i18nT('no_result', 'ไม่พบข้อมูลราคา') : 'ไม่พบข้อมูลราคา';
        tbody.innerHTML = `<tr><td colspan="4">${noDataText}</td></tr>`;
      }

      const rules = window.AgriPriceRules || {};
      const staleLimit = Number.isFinite(rules.STALE_DAYS) ? rules.STALE_DAYS : 7;
      const staleDays = typeof rules.getStaleDays === 'function'
        ? rules.getStaleDays(effectiveDate)
        : (() => {
            if (!effectiveDate) return null;
            const parsed = new Date(effectiveDate);
            if (Number.isNaN(parsed.getTime())) return null;
            const diffMs = Date.now() - parsed.getTime();
            return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          })();
      let staleNote = '';
      if (staleDays !== null && staleDays > staleLimit) {
        staleNote = window.i18nT 
          ? ` (${window.i18nT('last_updated_days_ago', 'ข้อมูลล่าสุดเมื่อ {n} วันก่อน').replace('{n}', staleDays)})` 
          : ` (ข้อมูลล่าสุดเมื่อ ${staleDays} วันก่อน)`;
      }

      let updatedTimeNote = '';
      if (json.updated_at) {
        const t = new Date(json.updated_at);
        if (!Number.isNaN(t.getTime())) {
          const updateTimeText = window.i18nT ? window.i18nT('update_time', 'เวลาอัปเดต') : 'เวลาอัปเดต';
          updatedTimeNote = ` | ${updateTimeText}: ${t.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
        }
      }

      const sourceText = window.i18nT ? window.i18nT('source_label', 'ที่มา') : 'ที่มา';
      document.getElementById('govPriceSource').textContent = `${sourceText}: ${json.source || 'dit.go.th'}${updatedTimeNote}${staleNote}`;
    } catch (err) {
      console.error('[govPrices] Error:', err);
      document.getElementById('govPriceLoader').style.display = 'none';
      document.getElementById('govPriceError').style.display = 'block';
      const errorText = window.i18nT ? window.i18nT('error_occurred', 'เกิดข้อผิดพลาด') : 'เกิดข้อผิดพลาด';
      document.getElementById('govPriceError').textContent = `${errorText}: ${err.message}`;
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
