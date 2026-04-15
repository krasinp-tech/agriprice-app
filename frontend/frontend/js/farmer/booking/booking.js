// import ui-common.js เพื่อใช้งาน showLoading
// ===== API Data Fetching =====
async function fetchBookings() {
  const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const token     = localStorage.getItem(TOKEN_KEY) || '';
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

  if (API_BASE && token) {
    try {
      showLoading(true);
      const res = await fetch(API_BASE + '/api/bookings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      showLoading(false);
      if (!res.ok) throw new Error(res.status);
        const json = await res.json();
        if (DEBUG_BOOKING) console.log('[fetchBookings] API response:', json);
      return (Array.isArray(json.data) ? json.data : []).map(b => ({
        id:          String(b.booking_id),
        bookingId:   b.booking_no || String(b.booking_id),
        buyerName:   b.buyer ? `${b.buyer.first_name} ${b.buyer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        shopName:    b.buyer ? `${b.buyer.first_name} ${b.buyer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        phone:       b.buyer?.phone || '',
        productName: b.product?.name || '',
        quantityKg:  0,
        queueNo:     b.queue_no || '',
        time:        b.scheduled_time ? new Date(b.scheduled_time).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '',
        createdAt:   b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : '',
        status:      b.status || 'waiting',
        address:     b.address || '',
        vehicles:    (() => {
          try { const n=JSON.parse(b.note||'{}'); return Array.isArray(n.vehicles)?n.vehicles:[]; }
          catch(_){return [];} })(),
      }));
    } catch (e) {
      showLoading(false);
      showAlert('เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง', 'error');
      return [];
    }
  }
  return [];
}

function mapStatusText(status) {
  if (status === "waiting") return window.i18nT ? window.i18nT('waiting', 'รอคิว') : 'รอคิว';
  if (status === "success") return window.i18nT ? window.i18nT('success', 'สำเร็จ') : 'สำเร็จ';
  if (status === "cancel") return window.i18nT ? window.i18nT('cancel', 'ยกเลิก') : 'ยกเลิก';
  return window.i18nT ? window.i18nT('booking_unknown_status', 'ไม่ทราบสถานะ') : 'ไม่ทราบสถานะ';
}

// escapeHtml utility is now loaded via script tag in booking.html

function renderCard(b) {
  const badgeClass = b.status;
  const statusText = mapStatusText(b.status);
  const esc = window.escapeHtml;
    if (window.AGRIPRICE_DEBUG) console.log('[renderCard] booking:', b);
  return `
    <article class="booking-card" data-id="${esc(b.bookingId)}">
      <div class="row">
        <div class="shop">${esc(b.shopName)}</div>
        <div class="badge ${esc(badgeClass)}">${esc(statusText)}</div>
      </div>

      <div class="meta">
        ${esc(window.i18nT ? window.i18nT('booking_number', 'เลขที่การจอง') : 'เลขที่การจอง')}: <b>${esc(b.bookingId)}</b><br/>
        ${esc(window.i18nT ? window.i18nT('queue_time', 'เวลานัดคิว') : 'เวลานัดคิว')}: <b>${esc(b.time)} ${esc(window.i18nT ? window.i18nT('minute_short', 'น.') : 'น.')}</b>
      </div>

      <div class="queueBox">
        <div>
          <div class="queueLabel">${esc(window.i18nT ? window.i18nT('your_queue_number', 'หมายเลขคิวของคุณ') : 'หมายเลขคิวของคุณ')}</div>
          <div class="queueNo">${esc(b.queueNo)}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">${esc(window.i18nT ? window.i18nT('transaction_date', 'วันที่ทำรายการ') : 'วันที่ทำรายการ')}</div>
          <div><b>${esc(b.createdAt)}</b></div>
        </div>
      </div>

      <div class="cta">
        <button class="btn" type="button" data-open>
          ${esc(window.i18nT ? window.i18nT('view_details', 'ดูรายละเอียด') : 'ดูรายละเอียด')}
        </button>
      </div>
    </article>
  `;
}

(function init() {
  // ไม่ใช้ topbar แล้ว
  
  setActiveBottomNav("booking");

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  let all = [];
  // อ่าน filter เริ่มต้นจาก query string เพื่อรองรับ redirect หลังยกเลิก
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
      hideEmptyState(listEl);
    } else {
      hideEmptyState(listEl);
      listEl.innerHTML = filtered.map(renderCard).join("");
    }
    emptyEl.hidden = filtered.length !== 0;

    // Delegated click handler: ไปหน้า detail เฉพาะเมื่อกดปุ่ม [data-open]
    // ใช้ assignment เพื่อหลีกเลี่ยงการผูก listener ซ้ำเวลาเรียก apply() หลายครั้ง
    listEl.onclick = function (e) {
      const open = e.target.closest("[data-open]");
      if (!open) return; // ไม่ต้องทำอะไรถ้าไม่ได้กดปุ่มดูรายละเอียด

      const card = e.target.closest(".booking-card");
      if (!card) return;

      const id = card.dataset.id;
      if (!id) return;

      // บันทึกข้อมูลการจองปัจจุบันไว้เพื่อให้ step4 โหลดได้
      try {
        const item = all.find((b) => b.bookingId === id);
        if (item) {
          const copy = { ...item, fromList: true };
          localStorage.setItem("confirmedBooking", JSON.stringify(copy));
          // เก็บ slot/time/อื่น ๆ ในกรณีของฟอร์มจองด้วย
          if (copy.slotId) localStorage.setItem("bookingSlotId", copy.slotId);
          if (copy.timeSlot) localStorage.setItem("bookingTimeSlot", JSON.stringify(copy.timeSlot));
        }
      } catch (_){ }

      // บันทึก referrer เพื่อให้ step4 รู้ว่ากลับมาจากไหน
      localStorage.setItem("bookingReferrer", window.location.href);

      // ไปหน้ารายละเอียดการจอง (step4)
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

  searchEl.addEventListener("input", () => {
    keyword = searchEl.value;
    apply();
  });

  fetchBookings().then((data) => {
    if (window.AGRIPRICE_DEBUG) console.log('Booking data:', data);
    all = Array.isArray(data) ? data.slice() : [];
    apply();
  });
})();
