/**
 * booking.js (REAL API VERSION)
 * - โหลดรายการจองจาก API จริง
 * - ไม่มี mock data
 */

/* =========================
   Helpers
========================= */
// escapeHtml utility is now loaded via script tag in booking.html

function safeLower(input) {
  return String(input ?? "").toLowerCase();
}

function mapStatusText(status) {
  if (status === "waiting") return window.i18nT ? window.i18nT('waiting', 'รอคิว') : 'รอคิว';
  if (status === "success") return window.i18nT ? window.i18nT('success', 'สำเร็จ') : 'สำเร็จ';
  if (status === "cancel") return window.i18nT ? window.i18nT('cancel', 'ยกเลิก') : 'ยกเลิก';
  return window.i18nT ? window.i18nT('booking_unknown_status', 'ไม่ทราบสถานะ') : 'ไม่ทราบสถานะ';
}

/* =========================
   Fetch bookings from API
========================= */
async function fetchBookings() {
  const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const token     = localStorage.getItem(TOKEN_KEY) || '';

  if (API_BASE && token) {
    try {
      showLoading(true);
      const res = await fetch(API_BASE + '/api/bookings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      showLoading(false);
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      return (Array.isArray(json.data) ? json.data : []).map(b => ({
        id:          String(b.booking_id),
        bookingId:   b.booking_no || String(b.booking_id),
        farmerName:  b.farmer ? `${b.farmer.first_name} ${b.farmer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        shopName:    b.farmer ? `${b.farmer.first_name} ${b.farmer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        phone:       b.farmer?.phone || '',
        productName: b.product?.name || '',
        quantityKg:  0,
        queueNo:     b.queue_no || '',
        time:        b.scheduled_time ? new Date(b.scheduled_time).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) : '',
        createdAt:   b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : '',
        status:      b.status || 'waiting',
        address:     b.address || '',
        vehicles:    [],
      }));
    } catch (e) {
      showLoading(false);
      showAlert('เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง', 'error');
      return [];
    }
  }
  return [];
}

/* =========================
   Shared bookings list
   (scanner uses this)
========================= */
let BOOKINGS = [];

/* =========================
   Render booking card
========================= */
function renderCard(b) {
  const badgeClass = b.status || "unknown";
  const statusText = mapStatusText(b.status);

  const phoneLine = b.phone
    ? `<div class="meta">โทร: <b>${escapeHtml(b.phone)}</b></div>`
    : "";

  const productLine = b.productName
    ? `<div class="meta">${escapeHtml(b.productName)} - <b>${Number(
        b.quantityKg || 0
      ).toLocaleString()} กก.</b></div>`
    : "";

  // Vehicle information
  const vehiclesInfo = b.vehicles && Array.isArray(b.vehicles) && b.vehicles.length > 0
    ? `<div class="vehicleInfo">
        <div class="vehicleHeader"> รถ (${b.vehicles.length} คัน)</div>
        <div class="vehicleList">
          ${b.vehicles.map((v) => `
            <div class="vehicleItem">
              <div class="vehiclePlate">${escapeHtml(v.plate || "-")}</div>
              <div class="vehicleType">${escapeHtml(v.type || "-")}</div>
            </div>
          `).join("")}
        </div>
      </div>`
    : "";

  return `
    <article class="booking-card" data-id="${escapeHtml(b.bookingId)}">
      <div class="row">
        <div class="shop">${escapeHtml(b.shopName || "-")}</div>
        <div class="badge ${escapeHtml(badgeClass)}">${escapeHtml(statusText)}</div>
      </div>

      <div class="meta">
        ${escapeHtml(window.i18nT ? window.i18nT('booking_number', 'เลขที่การจอง') : 'เลขที่การจอง')}: <b>${escapeHtml(b.bookingId || "-")}</b> | ${escapeHtml(window.i18nT ? window.i18nT('queue_time', 'เวลานัดคิว') : 'เวลานัดคิว')}: <b>${escapeHtml(
          b.time || "-"
        )} ${escapeHtml(window.i18nT ? window.i18nT('minute_short', 'น.') : 'น.')}</b>
      </div>

      ${phoneLine}
      ${productLine}
      ${vehiclesInfo}

      <div class="queueBox">
        <div>
          <div class="queueLabel">${escapeHtml(window.i18nT ? window.i18nT('queue_number', 'หมายเลขคิว') : 'หมายเลขคิว')}</div>
          <div class="queueNo">${escapeHtml(b.queueNo || "-")}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">${escapeHtml(window.i18nT ? window.i18nT('transaction_date', 'วันที่ทำรายการ') : 'วันที่ทำรายการ')}</div>
          <div><b>${escapeHtml(b.createdAt || "-")}</b></div>
        </div>
      </div>

      <div class="cta">
        <button class="btn" type="button" data-open>${escapeHtml(window.i18nT ? window.i18nT('view_details', 'ดูรายละเอียด') : 'ดูรายละเอียด')}</button>
      </div>
    </article>
  `;
}

/* =========================
   Main module
========================= */
(function initBookingPage() {
  // Bottom nav
  if (typeof setActiveBottomNav === "function") {
    setActiveBottomNav("booking");
  }

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  if (!listEl || !emptyEl || !searchEl) return;

  let filter = "all";
  let keyword = "";

  function apply() {
    const k = keyword.trim().toLowerCase();

    const filtered = BOOKINGS.filter((b) => {
      const passFilter = filter === "all" ? true : (b.status === filter);
      const passSearch =
        !k ||
        safeLower(b.bookingId).includes(k) ||
        safeLower(b.shopName).includes(k) ||
        safeLower(b.queueNo).includes(k);
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

    // click -> detail
    listEl.querySelectorAll(".booking-card").forEach((card) => {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        const open = e.target.closest("[data-open]");
        if (open || !e.target.closest("a")) {
          if (window.navigateWithTransition) window.navigateWithTransition(`Booking information.html?bookingId=${encodeURIComponent(id)}`); else window.location.href = `Booking information.html?bookingId=${encodeURIComponent(id)}`;
        }
      });
    });
  }

  // filter buttons
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter || "all";
      apply();
    });
  });

  // search
  searchEl.addEventListener("input", () => {
    keyword = searchEl.value || "";
    apply();
  });

  // initial load
  fetchBookings().then((data) => {
    BOOKINGS = Array.isArray(data) ? data : [];
    apply();
  });
})();

/* =========================
   QR Scanner module
========================= */
(function qrScannerModule() {
  const scanBtn = document.getElementById("scanBtn");
  const scanModal = document.getElementById("scanModal");
  const closeScanBtn = document.getElementById("closeScanBtn");
  const scanVideo = document.getElementById("scanVideo");
  const scanManualInput = document.getElementById("scanManualInput");
  const scanManualBtn = document.getElementById("scanManualBtn");

  if (!scanBtn || !scanModal || !closeScanBtn || !scanVideo || !scanManualInput || !scanManualBtn) return;

  let stream = null;
  let scanInterval = null;
  let canvas = null;
  let ctx = null;

  function openModal() {
    scanModal.classList.add("show");
    scanModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    scanModal.classList.remove("show");
    scanModal.setAttribute("aria-hidden", "true");
  }

  async function startScanner() {
    try {
      if (window.AgriPermission) {
        const perm = await window.AgriPermission.requestCamera();
        if (!perm.granted) return; // User denied or closed the bottom sheet
      }
      
      openModal();

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      scanVideo.srcObject = stream;

      // wait video ready (prevents zero width/height canvas)
      await new Promise((resolve) => {
        if (scanVideo.readyState >= 2) return resolve();
        scanVideo.onloadedmetadata = () => resolve();
      });

      if (!canvas) {
        canvas = document.createElement("canvas");
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      }

      // scanning loop using jsQR
      scanInterval = setInterval(async () => {
        if (!window.jsQR) return; // wait for script load
        try {
          const w = scanVideo.videoWidth || 0;
          const h = scanVideo.videoHeight || 0;
          if (!w || !h) return;

          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          ctx.drawImage(scanVideo, 0, 0, w, h);
          const imageData = ctx.getImageData(0, 0, w, h);
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleDetected(code.data);
          }
        } catch {
          // ignore per-frame errors
        }
      }, 350);
    } catch (err) {
      stopScanner();
      window.appNotify((window.i18nT ? window.i18nT('cannot_open_camera', 'ไม่สามารถเปิดกล้องได้') : 'ไม่สามารถเปิดกล้องได้') + ": " + (err && err.message ? err.message : "unknown"), 'error');
    }
  }

  function stopScanner() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    try {
      scanVideo.srcObject = null;
    } catch {}
    closeModal();
  }

  function handleDetected(value) {
    const searchVal = String(value || "").trim();
    if (!searchVal) return;

    // Check if it's a URL (like from our QR codes)
    try {
      const url = new URL(searchVal);
      const bid = url.searchParams.get("bid") || url.searchParams.get("bookingId");
      if (bid) {
         stopScanner();
         window.location.href = searchVal;
         return;
      }
    } catch(e) {
      // not a valid URL, fallback to manual search
    }

    const found = BOOKINGS.find((b) => {
      const id = String(b.bookingId || "");
      const shop = String(b.shopName || "");
      return id === searchVal || id.includes(searchVal) || shop.includes(searchVal);
    });

    if (found) {
      stopScanner();
      
      const basePath = (window.location.pathname || "").split("/pages/")[0] + "/pages/";
      window.location.href = basePath + "scan-checkin.html?bid=" + encodeURIComponent(found.bookingId);
    } else {
      window.appNotify((window.i18nT ? window.i18nT('booking_not_found_with', 'ไม่พบการจองที่ตรงกับ') : 'ไม่พบการจองที่ตรงกับ') + ": " + searchVal, 'error');
    }
  }

  // events
  scanBtn.addEventListener("click", () => startScanner());
  closeScanBtn.addEventListener("click", () => stopScanner());

  scanManualBtn.addEventListener("click", () => {
    const v = (scanManualInput.value || "").trim();
    if (!v) return window.appNotify(window.i18nT ? window.i18nT('please_enter_booking_number', 'กรุณากรอกหมายเลขการจอง') : 'กรุณากรอกหมายเลขการจอง', 'error');
    handleDetected(v);
  });

  scanModal.addEventListener("click", (e) => {
    if (e.target === scanModal) stopScanner();
  });
})();
