(function() {
/**
 * booking.js (REAL API VERSION)
 * - โหลดรายการจองจาก API จริง
 * - รองรับ Native QR Scanner (ML Kit)
 */

/* =========================
   Helpers
 ========================= */
const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner || window.Capacitor?.Plugins?.BarcodeScanning;

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
  if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
  const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const token = localStorage.getItem(TOKEN_KEY) || '';

  if (currentBase && token) {
    try {
      if (window.showLoading) window.showLoading(true);
      const res = await fetch(currentBase + '/api/bookings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (window.showLoading) window.showLoading(false);
      
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      console.log('[DEBUG] Bookings API Response:', json);
      return (Array.isArray(json.data) ? json.data : []).map(b => ({
        id: String(b.booking_id),
        bookingId: b.booking_no || String(b.booking_id),
        farmerName: b.farmer ? `${b.farmer.first_name} ${b.farmer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        shopName: b.farmer ? `${b.farmer.first_name} ${b.farmer.last_name}`.trim() : (window.i18nT ? window.i18nT('booking_unknown_name', 'ไม่ทราบชื่อ') : 'ไม่ทราบชื่อ'),
        phone: b.farmer?.phone || '',
        productName: b.product?.name || '',
        quantityKg: b.product_amount || 0,
        queueNo: b.queue_no || '',
        time: b.scheduled_time ? new Date(b.scheduled_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '',
        createdAt: b.created_at ? new Date(b.created_at).toLocaleDateString('th-TH') : '',
        status: b.status || 'waiting',
        address: b.address || '',
        vehicles: Array.isArray(b.vehicles) && b.vehicles.length > 0
          ? b.vehicles
          : (b.vehicle_plates
            ? String(b.vehicle_plates).split(',').map(p => p.trim()).filter(Boolean).map(plate => ({ plate, type: 'รถบรรทุก' }))
            : []),
      }));
    } catch (e) {
      if (window.showLoading) window.showLoading(false);
      if (window.showAlert) window.showAlert('เกิดข้อผิดพลาดขณะโหลดข้อมูลการจอง', 'error');
      return [];
    }
  }
  return [];
}

let BOOKINGS = [];

/* =========================
   Render booking card
 ========================= */
function renderCard(b) {
  const badgeClass = b.status || "unknown";
  const statusText = mapStatusText(b.status);
  const esc = window.escapeHtml || ((s) => s);

  const phoneLine = b.phone
    ? `<div class="meta">${esc(window.i18nT ? window.i18nT('phone_label', 'โทร') : 'โทร')}: <b>${esc(b.phone)}</b></div>`
    : "";

  const productLine = b.productName
    ? `<div class="meta">${esc(b.productName)} - <b>${Number(
      b.quantityKg || 0
    ).toLocaleString()} ${esc(window.i18nT ? window.i18nT('kg_unit', 'กก.') : 'กก.')}</b></div>`
    : "";

  const vehiclesInfo = b.vehicles && Array.isArray(b.vehicles) && b.vehicles.length > 0
    ? `<div class="vehicleInfo">
        <div class="vehicleHeader"> ${esc(window.i18nT ? window.i18nT('vehicle_label', 'รถ') : 'รถ')} (${b.vehicles.length} ${esc(window.i18nT ? window.i18nT('unit_count', 'คัน') : 'คัน')})</div>
        <div class="vehicleList">
          ${b.vehicles.map((v) => `
            <div class="vehicleItem">
              <div class="vehiclePlate">${esc(v.plate || "-")}</div>
              <div class="vehicleType">${esc(v.type || "-")}</div>
            </div>
          `).join("")}
        </div>
      </div>`
    : "";

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

      ${phoneLine}
      ${productLine}

      <div class="queueBox">
        <div>
          <div class="queueLabel">${esc(window.i18nT ? window.i18nT('queue_number', 'หมายเลขคิว') : 'หมายเลขคิว')}</div>
          <div class="queueNo">${esc(b.queueNo)}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">${esc(window.i18nT ? window.i18nT('transaction_date', 'วันที่ทำรายการ') : 'วันที่ทำรายการ')}</div>
          <div><b>${esc(b.createdAt)}</b></div>
        </div>
      </div>

      ${vehiclesInfo}

      <div class="cta">
            <button class="btn" type="button" data-open>
              <span class="material-icons-outlined">visibility</span>
              ${window.i18nT('view_details', 'ดูรายละเอียด')}
            </button>
      </div>
    </article>
  `;
}

/* =========================
   UI Logic
 ========================= */
function init() {
  if (window.setActiveBottomNav) window.setActiveBottomNav("booking");

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  if (!listEl) return;

  function apply() {
    const k = safeLower(searchEl?.value || "");
    const activeFilter = document.querySelector(".seg-btn.active")?.dataset?.filter || "all";

    const filtered = BOOKINGS.filter((b) => {
      const passFilter = activeFilter === "all" ? true : b.status === activeFilter;
      const passSearch = !k ||
        safeLower(b.bookingId).includes(k) ||
        safeLower(b.shopName).includes(k) ||
        safeLower(b.queueNo).includes(k);
      return passFilter && passSearch;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = "";
    } else {
      listEl.innerHTML = filtered.map(renderCard).join("");
    }
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;

    // Delegate detail view click
    listEl.onclick = (e) => {
      const openBtn = e.target.closest("[data-open]");
      if (!openBtn) return;
      const card = openBtn.closest(".booking-card");
      if (!card) return;
      const id = card.dataset.id;
      if (!id) return;

      const item = BOOKINGS.find((b) => b.bookingId === id);
      if (item) {
        localStorage.setItem("confirmedBooking", JSON.stringify({ ...item, fromList: true }));
      }
      
      console.log('[DEBUG] Navigating to detail for ID:', id);
      
      // Store referrer and navigate
      sessionStorage.setItem("bookingReferrer", window.location.href);
      sessionStorage.setItem("bookingReferrerTs", Date.now().toString());
      const detailUrl = `booking-information.html?bid=${encodeURIComponent(id)}`;
      console.log('[DEBUG] Detail URL (Information):', detailUrl);
      if (window.navigateWithTransition) window.navigateWithTransition(detailUrl); else window.location.href = detailUrl;
    };
  }

  // Filter buttons
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      apply();
    };
  });

  // Search input
  if (searchEl) {
    searchEl.oninput = () => apply();
  }

  // Refresh handler
  const handleRefresh = async () => {
    const data = await fetchBookings();
    BOOKINGS = Array.isArray(data) ? data : [];
    apply();
  };
  if (window.initPullToRefresh) window.initPullToRefresh(handleRefresh);

  // Initial load
  fetchBookings().then((data) => {
    console.log('[DEBUG] Initial Bookings Loaded:', data);
    BOOKINGS = Array.isArray(data) ? data : [];
    apply();
  });
}

/* =========================
   QR Scanner Integration
 ========================= */
const scanBtn = document.getElementById('scanBtn');
const scanModal = document.getElementById('scanModal');
const closeScanBtn = document.getElementById('closeScanBtn');
const torchBtn = document.getElementById('torchBtn');
const scanManualBtn = document.getElementById('scanManualBtn');
const scanManualInput = document.getElementById('scanManualInput');

let isScanning = false;
let isTorchOn = false;

const getScanner = () => BarcodeScanner;

async function startScanner() {
  if (isScanning) return;
  
  if (!window.Capacitor) {
    if (window.appNotify) window.appNotify('Native Scanner ใช้งานได้บนแอปมือถือเท่านั้น', 'warning');
    return;
  }

  const scanner = getScanner();
  if (!scanner) {
    if (window.appNotify) window.appNotify('ไม่พบ Plugin สแกนเนอร์', 'error');
    return;
  }

  try {
    const status = await scanner.checkPermissions();
    if (status.camera !== 'granted') {
      const req = await scanner.requestPermissions();
      if (req.camera !== 'granted') {
        if (window.appNotify) window.appNotify('ต้องการสิทธิ์การเข้าถึงกล้อง', 'error');
        return;
      }
    }

    isScanning = true;
    scanModal.classList.add('show');
    document.documentElement.classList.add('scanner-active');
    document.body.classList.add('scanner-active');
    
    if (scanner.hideBackground) await scanner.hideBackground();

    // ML Kit requires a listener to capture barcodes
    await scanner.removeAllListeners();
    await scanner.addListener('barcodeScanned', async (event) => {
      if (event && event.barcode) {
        // Remove listener to prevent multiple triggers
        await scanner.removeAllListeners();
        const code = event.barcode.displayValue || event.barcode.rawValue;
        handleDetected(code);
      }
    });

    // Start background scan (opens camera)
    await scanner.startScan({
      formats: ['QR_CODE']
    });

  } catch (err) {
    console.error('[NativeScanner] Error:', err);
    stopScanner();
    if (window.appNotify) window.appNotify('เกิดข้อผิดพลาดในการสแกน', 'error');
  }
}

async function stopScanner() {
  const scanner = getScanner();
  if (scanner) {
    try {
      if (scanner.stopScan) await scanner.stopScan();
      if (scanner.showBackground) await scanner.showBackground();
      if (scanner.removeAllListeners) await scanner.removeAllListeners();
    } catch (e) {}
  }

  document.documentElement.classList.remove('scanner-active');
  document.body.classList.remove('scanner-active');
  scanModal.classList.remove('show');
  isScanning = false;
  isTorchOn = false;
  const icon = torchBtn?.querySelector('.material-icons-outlined');
  if (icon) icon.textContent = 'flashlight_on';
}

async function toggleTorch() {
  const scanner = getScanner();
  if (!scanner) return;
  try {
    if (scanner.toggleTorch) {
      await scanner.toggleTorch();
      isTorchOn = !isTorchOn;
    } else if (scanner.setTorchEnabled) {
      isTorchOn = !isTorchOn;
      await scanner.setTorchEnabled({ enabled: isTorchOn });
    }
    const icon = torchBtn?.querySelector('.material-icons-outlined');
    if (icon) icon.textContent = isTorchOn ? 'flashlight_off' : 'flashlight_on';
  } catch (e) {
    console.error('[NativeScanner] Torch error:', e);
  }
}

async function handleDetected(code) {
  if (!code) return;
  if (window.Capacitor?.Plugins?.Haptics) {
    try { await window.Capacitor.Plugins.Haptics.impact({ style: 'heavy' }); } catch(e){}
  }
  await stopScanner();
  
  // [SMART DETECT] If it's a check-in URL, navigate locally to avoid browser pop-out
  if (code.includes('scan-checkin.html')) {
    try {
      // Parse the URL to get the booking ID (bid)
      const urlObj = new URL(code);
      const bid = urlObj.searchParams.get('bid');
      
      if (bid) {
        if (window.appNotify) window.appNotify('กำลังดำเนินการเช็คอิน...', 'success');
        setTimeout(() => {
          // Navigate LOCALLY within the app
          const localPath = `../../scan-checkin.html?bid=${encodeURIComponent(bid)}`;
          if (window.navigateWithTransition) window.navigateWithTransition(localPath);
          else window.location.href = localPath;
        }, 500);
        return;
      }
    } catch (e) {
      // Fallback if URL parsing fails
      console.warn("URL Parse failed:", e);
    }
  }

  // Otherwise, put it in the search box
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = code;
    searchInput.dispatchEvent(new Event('input'));
  }
  if (window.appNotify) window.appNotify('สแกนสำเร็จ: ' + code, 'success');
}

// Bind scan UI events
if (scanBtn) scanBtn.onclick = () => startScanner();
if (closeScanBtn) closeScanBtn.onclick = () => stopScanner();
if (torchBtn) torchBtn.onclick = () => toggleTorch();

if (scanManualBtn) {
  scanManualBtn.onclick = () => {
    const code = scanManualInput?.value;
    if (code) handleDetected(code);
  };
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
