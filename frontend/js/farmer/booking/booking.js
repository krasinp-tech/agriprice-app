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

function normalizeStatusGroup(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'success') return 'success';
  if (s === 'rejected' || s === 'cancel' || s === 'cancelled' || s === 'canceled') return 'cancel';
  return 'waiting';
}

function normalizeFilter(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'all' || raw === 'waiting' || raw === 'success' || raw === 'cancel') return raw;
  if (!raw) return 'all';
  return normalizeStatusGroup(raw);
}

function includesText(value, keyword) {
  return String(value || '').toLowerCase().includes(keyword);
}

function firstRelation(value) {
  return Array.isArray(value) ? value[0] : value;
}

function displayName(profile, fallback) {
  const name = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
    : '';
  return name || fallback;
}

function getOfferOwner(booking) {
  return firstRelation(booking.product?.profiles)
    || firstRelation(booking.products?.profiles)
    || firstRelation(booking.buy_offers?.profiles)
    || firstRelation(booking.slot?.product?.profiles)
    || null;
}

function parseVehicles(source) {
  let vehicles = [];

  if (Array.isArray(source.booking_vehicles)) {
    vehicles = source.booking_vehicles.map(v => ({
      plate: v.plate || v.plate_no || '',
      type: v.type || t('truck', 'Truck')
    }));
  } else if (Array.isArray(source.vehicle_info)) {
    vehicles = source.vehicle_info;
  } else if (typeof source.vehicle_info === 'string' && source.vehicle_info.trim()) {
    try {
      const parsed = JSON.parse(source.vehicle_info);
      vehicles = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      vehicles = source.vehicle_info.split(/[,;\n]+/).map(plate => ({ plate: plate.trim() }));
    }
  } else if (source.vehicle_plates) {
    vehicles = String(source.vehicle_plates).split(/[,;\n]+/).map(plate => ({ plate: plate.trim() }));
  } else if (source.note) {
    try {
      const note = typeof source.note === 'string' ? JSON.parse(source.note) : source.note;
      vehicles = Array.isArray(note?.vehicles) ? note.vehicles : [];
    } catch (_) {
      vehicles = [];
    }
  }

  return vehicles
    .map(v => ({
      plate: String(v.plate || v.plate_no || '').trim(),
      type: String(v.typeName || v.type || t('truck', 'Truck')).trim()
    }))
    .filter(v => v.plate);
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
      ...(() => {
        const owner = getOfferOwner(b);
        const requester = b.farmer || b.buyer || null;
        const unknownName = t('booking_unknown_name', 'Unknown');
        return {
          buyerName: displayName(requester, unknownName),
          shopName: displayName(owner, displayName(requester, unknownName)),
          phone: owner?.phone || requester?.phone || '',
          vehicles: parseVehicles(b),
        };
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
  const s = String(status || '').toLowerCase();
  if (s === "waiting") return t('waiting', 'รอคิว');
  if (s === "confirmed") return t('confirmed', 'ยืนยันแล้ว');
  if (s === "completed" || s === "success") return t('success', 'สำเร็จ');
  if (s === "rejected") return t('rejected', 'ปฏิเสธ');
  if (s === "cancel" || s === "cancelled" || s === "canceled") return t('cancel', 'ยกเลิก');
  return t('booking_unknown_status', 'ไม่ทราบสถานะ');
}

function mapStatusClass(status) {
  return normalizeStatusGroup(status);
}

function renderCard(b) {
  const badgeClass = mapStatusClass(b.status);
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
  let filter = normalizeFilter(urlParams.get("filter") || "all");
  
  if (filter) {
    document.querySelectorAll(".seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === filter);
    });
  }
  let keyword = "";

  function apply() {
    const k = keyword.trim().toLowerCase();
    const filtered = all.filter((b) => {
      const passFilter = filter === "all" ? true : normalizeStatusGroup(b.status) === filter;
      const passSearch =
        !k ||
        includesText(b.bookingId, k) ||
        includesText(b.shopName, k) ||
        includesText(b.queueNo, k) ||
        includesText(b.productName, k);
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
      filter = normalizeFilter(btn.dataset.filter);
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
