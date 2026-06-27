(function() {
// import ui-common.js เพื่อใช้งาน showLoading

function t(key, fallback) {
  if (window.i18nT) return window.i18nT(key, fallback);
  return fallback || key;
}

function currentLocale() {
  const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
  if (lang === 'en') return 'en-US';
  if (lang === 'zh') return 'zh-CN';
  return 'th-TH';
}

// ===== API Data Fetching =====
async function fetchBookings() {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
  if (!window.api) return [];

  try {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const json = await window.api.getBookings();
    const data = Array.isArray(json) ? json : (json.data || []);
    
    if (DEBUG_BOOKING) console.log('[fetchBookings] API response:', data);

    return data.map(b => ({
      id:          String(b.booking_id || b.id),
      bookingId:   b.booking_no || String(b.booking_id || b.id),
      buyerName:   b.buyer ? `${b.buyer.first_name} ${b.buyer.last_name}`.trim() : t('booking_unknown_name', 'ไม่ทราบชื่อ'),
      shopName:    b.buyer ? `${b.buyer.first_name} ${b.buyer.last_name}`.trim() : t('booking_unknown_name', 'ไม่ทราบชื่อ'),
      phone:       b.buyer?.phone || '',
      productName: b.product?.name || '',
      quantityKg:  b.quantity || b.product_amount || 0,
      queueNo:     b.queue_no || '',
      time:        b.scheduled_time ? new Date(b.scheduled_time).toLocaleTimeString(currentLocale(), { hour:'2-digit', minute:'2-digit' }) : '',
      createdAt:   b.created_at ? new Date(b.created_at).toLocaleDateString(currentLocale()) : '',
      status:      b.status || 'waiting',
      address:     b.address || '',
      vehicles:    (() => {
        try {
          if (b.vehicle_info) return typeof b.vehicle_info === 'string' ? JSON.parse(b.vehicle_info) : b.vehicle_info;
          const n = JSON.parse(b.note || '{}');
          return Array.isArray(n.vehicles) ? n.vehicles : [];
        } catch (_) { return []; }
      })(),
    }));
  } catch (e) {
    console.error('[Booking] fetch error:', e);
    if (window.showAlert) {
      window.showAlert(t('booking_load_error', 'เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง'), 'error');
    }
    return [];
  }
}

function mapStatusText(status) {
  if (status === "waiting") return t('waiting', 'รอคิว');
  if (status === "success") return t('success', 'สำเร็จ');
  if (status === "cancel") return t('cancel', 'ยกเลิก');
  return t('booking_unknown_status', 'ไม่ทราบสถานะ');
}

function renderCard(b) {
  const badgeClass = b.status;
  const statusText = mapStatusText(b.status);
  const esc = window.escapeHtml || ((s) => s);
    if (window.AGRIPRICE_DEBUG) console.log('[renderCard] booking:', b);
  return `
    <article class="booking-card" data-id="${esc(b.bookingId)}">
      <div class="row">
        <div class="shop">${esc(b.shopName)}</div>
        <div class="badge ${esc(badgeClass)}">${esc(statusText)}</div>
      </div>

      <div class="meta">
        ${esc(t('booking_number', 'เลขที่การจอง'))}: <b>${esc(b.bookingId)}</b><br/>
        ${esc(t('queue_time', 'เวลานัดคิว'))}: <b>${esc(b.time)} ${esc(t('time_unit', 'น.'))}</b>
      </div>

      <div class="queueBox">
        <div>
          <div class="queueLabel">${esc(t('your_queue_number', 'หมายเลขคิวของคุณ'))}</div>
          <div class="queueNo">${esc(b.queueNo)}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">${esc(t('transaction_date', 'วันที่ทำรายการ'))}</div>
          <div><b>${esc(b.createdAt)}</b></div>
        </div>
      </div>

      <div class="cta">
        <button class="btn" type="button" data-open>
          ${esc(t('view_details', 'ดูรายละเอียด'))}
        </button>
      </div>
    </article>
  `;
}

function init() {
  if (window.setActiveBottomNav) window.setActiveBottomNav("booking");

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  if (!listEl) return;

  let all = [];
  const urlParams = new URLSearchParams(window.location.search);
  let filter = urlParams.get("filter") || "all";
  
  if (filter) {
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === filter);
    });
  }
  let keyword = "";

  function apply() {
    const k = keyword.trim().toLowerCase();
    const filtered = all.filter((b) => {
      const passFilter = filter === "all" ? true : b.status === filter;
      const passSearch =
        !k ||
        b.bookingId.toLowerCase().includes(k) ||
        b.shopName.toLowerCase().includes(k) ||
        b.queueNo.toLowerCase().includes(k);
      return passFilter && passSearch;
    });

    if (!filtered.length) {
      listEl.innerHTML = "";
    } else {
      listEl.innerHTML = filtered.map(renderCard).join("");
    }
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;

    listEl.onclick = function (e) {
      const open = e.target.closest("[data-open]");
      if (!open) return;

      const card = e.target.closest(".booking-card");
      if (!card) return;

      const id = card.dataset.id;
      if (!id) return;

      try {
        const item = all.find((b) => b.bookingId === id);
        if (item) {
          const copy = { ...item, fromList: true };
          localStorage.setItem("confirmedBooking", JSON.stringify(copy));
          if (copy.slotId) localStorage.setItem("bookingSlotId", copy.slotId);
          if (copy.timeSlot) localStorage.setItem("bookingTimeSlot", JSON.stringify(copy.timeSlot));
        }
      } catch (_){ }

      sessionStorage.setItem("bookingReferrer", window.location.href);
      sessionStorage.setItem("bookingReferrerTs", Date.now().toString());

      if (window.navigateWithTransition) window.navigateWithTransition(`booking-step4.html?bid=${encodeURIComponent(id)}`); else window.location.href = `booking-step4.html?bid=${encodeURIComponent(id)}`;
    };
  }

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter;
      apply();
    });
  });

  if (searchEl) {
    searchEl.addEventListener("input", () => {
      keyword = searchEl.value;
      apply();
    });
  }

  const handleRefresh = async () => {
    const data = await fetchBookings();
    all = Array.isArray(data) ? data.slice() : [];
    apply();
  };

  if (window.initPullToRefresh) window.initPullToRefresh(handleRefresh);

  fetchBookings().then((data) => {
    all = Array.isArray(data) ? data.slice() : [];
    apply();
  });
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
