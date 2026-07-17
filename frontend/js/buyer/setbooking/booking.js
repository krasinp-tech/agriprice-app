/**
 * booking.js (upgraded)
 * - Map to backend DB bookings using window.api.getBookings()
 * - Full filter, search, and native QR scanning for Buyer Check-in
 */

(function () {
  "use strict";

  const api = window.api || {};
  let BOOKINGS = [];
  let FILTER = "all";
  let KEYWORD = "";

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }
  const currentLocale = () => ({ en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[localStorage.getItem('lang')] || 'th-TH');

  function esc(input) {
    if (window.AgriPriceUI) return window.AgriPriceUI.escapeHtml(input);
    return String(input ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function normalizeStatusGroup(status) {
    const s = String(status || '').toLowerCase();
    if (s === "completed" || s === "success") return "success";
    if (s === "rejected" || s === "cancel" || s === "cancelled" || s === "canceled") return "cancel";
    return "waiting";
  }

  function normalizeFilter(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === "all" || raw === "waiting" || raw === "success" || raw === "cancel") return raw;
    if (!raw) return "all";
    return normalizeStatusGroup(raw);
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

  function parseVehicles(source) {
    let vehicles = [];

    if (Array.isArray(source.booking_vehicles)) {
      vehicles = source.booking_vehicles.map(v => ({
        plate: v.plate || v.plate_no || '',
        type: v.type || t('truck', 'รถบรรทุก')
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
    }

    return vehicles
      .map(v => ({
        plate: String(v.plate || v.plate_no || '').trim(),
        type: String(v.typeName || v.type || t('truck', 'รถบรรทุก')).trim()
      }))
      .filter(v => v.plate);
  }

  function includesText(value, keyword) {
    return String(value || '').toLowerCase().includes(keyword);
  }

  /* =========================
     Data Mapping
  ========================= */
  const mapApiItemToUi = (b) => {
    const dbId = b.booking_id || b.id || null;
    const publicId = b.booking_no || (dbId ? String(dbId) : "");
    const shopName = b.farmer
      ? `${b.farmer.first_name || ''} ${b.farmer.last_name || ''}`.trim()
      : t('booking_unknown_name', 'เกษตรกรทั่วไป');
    
    let createdAt = "-";
    if (b.created_at) {
      const d = new Date(b.created_at);
      const lang = localStorage.getItem('lang') || 'th';
      const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';
      createdAt = !isNaN(d.getTime()) 
        ? d.toLocaleDateString(locale) + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        : b.created_at;
    }

    let timeStr = "-";
    if (b.slot && b.slot.time_start) {
      timeStr = b.slot.time_start;
    } else if (b.scheduled_time) {
      const d = new Date(b.scheduled_time);
      timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
        : b.scheduled_time;
    }

    const vehicles = parseVehicles(b);
    const productName = b.offer?.title || b.product?.name || b.product?.variety || b.product?.description || "";

    return {
      id: dbId,
      bookingId: publicId,
      status: b.status || "waiting",
      shopName: shopName,
      phone: b.farmer?.phone || "",
      address: b.farmer ? [b.farmer.address_line1, b.farmer.address_line2].filter(Boolean).join(' ') : "",
      queueNo: b.queue_no || "-",
      time: timeStr,
      createdAt: createdAt,
      productName,
      quantityKg: b.expected_qty || b.product_amount || b.quantity || 0,
      vehicles: vehicles,
      notes: b.note || ""
    };
  };

  /* =========================
     Core Logic
   ========================= */
  async function loadData() {
    const listEl = document.getElementById("bookingList");
    if (!listEl) return;

    // Show shimmers
    listEl.innerHTML = `
      <div class="shimmer" style="height: 140px; border-radius: 20px; margin-bottom: 12px;"></div>
      <div class="shimmer" style="height: 140px; border-radius: 20px; margin-bottom: 12px;"></div>
    `;

    try {
      if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
      const res = await api.getBookings();
      const list = Array.isArray(res) ? res : (res?.data || []);
      BOOKINGS = list.map(mapApiItemToUi);
      applyFilters();
    } catch (err) {
      console.error("[Booking] Load error:", err);
      listEl.innerHTML = `<p style="text-align:center; padding:40px; color:#ef4444;">${t('error_loading', 'เกิดข้อผิดพลาดในการโหลดข้อมูล')}</p>`;
    }
  }

  function applyFilters() {
    const listEl = document.getElementById("bookingList");
    const emptyEl = document.getElementById("emptyState");
    if (!listEl) return;

    const k = KEYWORD.trim().toLowerCase();
    const filtered = BOOKINGS.filter(b => {
      const passFilter = FILTER === "all" ? true : (normalizeStatusGroup(b.status) === FILTER);
      const passSearch = !k || 
        includesText(b.bookingId, k) ||
        includesText(b.shopName, k) ||
        includesText(b.queueNo, k) ||
        includesText(b.productName, k);
      return passFilter && passSearch;
    });

    renderList(filtered, listEl);
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;
  }

  function renderList(list, container) {
    container.innerHTML = list.map(b => `
      <article class="booking-card" data-id="${esc(b.bookingId)}" data-dbid="${esc(b.id || '')}">
        <div class="row">
          <div class="shop">${esc(b.shopName)}</div>
          <div class="badge ${mapStatusClass(b.status)}">${mapStatusText(b.status)}</div>
        </div>

        <div class="meta">
          ${t('booking_id', 'เลขที่การจอง')}: <b>${esc(b.bookingId)}</b> • ${t('scheduled_time', 'เวลานัดคิว')}: <b>${esc(b.time)} น.</b>
        </div>

        ${b.productName ? `<div class="meta">${esc(b.productName)} — <b>${Number(b.quantityKg).toLocaleString()} ${esc(t('unit_kg', 'กก.'))}</b></div>` : ''}

        ${b.vehicles.length > 0 ? `
          <div class="vehicleInfo">
            <div class="vehicleHeader">${t('vehicles', 'รถ')} (${b.vehicles.length} ${t('unit_car', 'คัน')})</div>
            <div class="vehicleList">
              ${b.vehicles.map(v => `
                <div class="vehicleItem">
                  <div class="vehiclePlate">${esc(v.plate)}</div>
                  <div class="vehicleType">${esc(v.type)}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="queueBox">
          <div>
            <div class="queueLabel">${t('queue_no', 'หมายเลขคิว')}</div>
            <div class="queueNo">${esc(b.queueNo)}</div>
          </div>
          <div class="meta" style="text-align:right;">
            <div style="opacity:.7;font-size:12px;">${t('created_at', 'วันที่ทำรายการ')}</div>
            <div><b>${esc(b.createdAt)}</b></div>
          </div>
        </div>

        <div class="cta">
          <button class="btn" type="button" data-open>${t('view_details', 'ดูรายละเอียด')}</button>
        </div>
      </article>
    `).join("");

    // Click events
    container.querySelectorAll(".booking-card").forEach(card => {
      card.onclick = (e) => {
        const id = card.dataset.dbid || card.dataset.id;
        if (!id || id === "undefined") return;
        window.location.href = `booking-information.html?bookingId=${encodeURIComponent(id)}`;
      };
    });
  }

  /* =========================
     QR Scanner (Hybrid)
   ========================= */
  const qrScanner = (function() {
    const modal = document.getElementById("scanModal");
    const scanBtn = document.getElementById("scanBtn");
    const closeBtn = document.getElementById("closeScanBtn");
    const torchBtn = document.getElementById("torchBtn");
    const manualInput = document.getElementById("scanManualInput");
    const manualBtn = document.getElementById("scanManualBtn");

    let stream = null;
    let scanInterval = null;
    let nativeListeners = [];
    let torchActive = false;

    const isNative = () => {
      const cap = window.Capacitor;
      if (!cap) return false;
      if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
      const platform = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
      return platform === "android" || platform === "ios" || !!cap.isNative;
    };

    function setScannerUiActive(active) {
      document.documentElement.classList.toggle("scanner-active", active);
      document.body.classList.toggle("scanner-active", active);
    }

    function removeNativeListeners() {
      nativeListeners.forEach(listener => listener?.remove?.());
      nativeListeners = [];
    }

    async function start() {
      if (isNative()) {
        await startNativeScanner();
        return;
      }

      if (window.AgriPermission && window.AgriPermission.requestCamera) {
        const p = await window.AgriPermission.requestCamera();
        if (!p.granted) return;
      }
      await startWebScanner();
    }

    async function startNativeScanner() {
      try {
        const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;
        if (!BarcodeScanner) throw new Error("Scanner plugin not found");

        if (BarcodeScanner.isSupported) {
          const support = await BarcodeScanner.isSupported();
          if (support?.supported === false) throw new Error("Scanner is not supported on this device");
        }

        // Request camera permission directly via the BarcodeScanner plugin to bypass localStorage lockout
        const check = await BarcodeScanner.checkPermissions();
        let granted = check.camera === 'granted';
        if (!granted) {
          const req = await BarcodeScanner.requestPermissions();
          granted = req.camera === 'granted';
        }
        if (!granted) {
          window.showAlert?.(t('error_permission_camera', 'กรุณาอนุญาตสิทธิ์การเข้าถึงกล้องเพื่อทำการสแกน'), 'warning');
          return;
        }

        await BarcodeScanner.stopScan().catch(() => {});
        removeNativeListeners();

        setScannerUiActive(true);
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        nativeListeners.push(await BarcodeScanner.addListener("barcodesScanned", (event) => {
          const barcode = event?.barcodes?.[0];
          const value = barcode?.rawValue || barcode?.displayValue;
          if (value) handleDetected(value);
        }));
        nativeListeners.push(await BarcodeScanner.addListener("scanError", (event) => {
          console.error("[Native Scan] Scan error:", event?.message || event);
          stop();
        }));

        await BarcodeScanner.startScan({ formats: ["QR_CODE"], lensFacing: "BACK" });
      } catch (err) {
        console.error("[Native Scan] Error:", err);
        stop();
        window.showAlert?.(t('error_camera', 'ไม่สามารถเริ่มสแกนเนอร์ได้'), 'error');
      }
    }

    async function startWebScanner() {
      try {
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        const video = document.createElement("video");
        video.id = "scanVideo";
        // Keep the preview above the viewfinder background. A negative z-index
        // puts it behind the black container while BarcodeDetector can still
        // read the stream, resulting in a black/covered preview that still scans.
        video.style.cssText = "width:100%; height:100%; object-fit:cover; position:absolute; inset:0; z-index:0;";
        video.setAttribute("autoplay", "true");
        video.setAttribute("muted", "true");
        video.setAttribute("playsinline", "true");
        
        const box = modal.querySelector(".viewfinder-box");
        if (box) box.appendChild(video);

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;

        if (window.BarcodeDetector) {
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          scanInterval = setInterval(async () => {
            if (video.readyState < 2) return;
            try {
              const barcodes = await detector.detect(video);
              if (barcodes.length > 0) handleDetected(barcodes[0].rawValue);
            } catch (_) {}
          }, 400);
        }
      } catch (err) {
        console.error("[Web Scan] Error:", err);
        stop();
        window.showAlert?.(t('error_camera', 'ไม่สามารถเปิดกล้องได้'), 'error');
      }
    }

    async function toggleTorch() {
      if (!isNative()) {
        // Web torch
        if (!stream) return;
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        if (caps.torch) {
          torchActive = !torchActive;
          track.applyConstraints({ advanced: [{ torch: torchActive }] });
          torchBtn.classList.toggle("active", torchActive);
        }
        return;
      }
      
      const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;
      if (!BarcodeScanner) return;
      try {
        if (BarcodeScanner.toggleTorch) {
          await BarcodeScanner.toggleTorch();
          const state = BarcodeScanner.isTorchEnabled ? await BarcodeScanner.isTorchEnabled() : null;
          torchActive = state ? !!state.enabled : !torchActive;
        } else {
          torchActive = !torchActive;
          if (torchActive) await BarcodeScanner.enableTorch();
          else await BarcodeScanner.disableTorch();
        }
        torchBtn.classList.toggle("active", torchActive);
      } catch (err) {
        console.warn("[Native Scan] Torch not available:", err.message);
      }
    }

    function stop() {
      if (isNative()) {
        const BarcodeScanner = window.Capacitor?.Plugins?.BarcodeScanner;
        if (BarcodeScanner?.stopScan) {
          Promise.resolve(BarcodeScanner.stopScan()).catch(() => {});
        }
        setScannerUiActive(false);
      }
      removeNativeListeners();

      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      
      const video = document.getElementById("scanVideo");
      if (video) video.remove();
      
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      torchActive = false;
      torchBtn?.classList.remove("active");
    }

    function handleDetected(content) {
      const val = String(content || "").trim();
      if (!val) return;

      stop();
      
      // Parse Booking ID from URL or raw content
      let bid = val;
      try {
        if (val.startsWith("http")) {
          const url = new URL(val);
          bid = url.searchParams.get("bid") || url.searchParams.get("bookingId") || url.searchParams.get("id") || val;
        }
      } catch (_) {}

      // Navigate to dedicated Buyer Check-in page
      window.location.href = `../../scan-checkin.html?bid=${encodeURIComponent(bid)}`;
    }

    // Bind events
    if (scanBtn) scanBtn.onclick = () => start();
    if (closeBtn) closeBtn.onclick = () => stop();
    if (torchBtn) torchBtn.onclick = () => toggleTorch();
    if (manualBtn) manualBtn.onclick = () => {
      const v = manualInput.value.trim();
      if (v) handleDetected(v);
      else window.showAlert?.(t('error_enter_code', 'กรุณากรอกรหัสการจอง'), 'warning');
    };
    modal.onclick = (e) => { if (e.target === modal) stop(); };

    return { start, stop };
  })();

  /* =========================
     Init Page
   ========================= */
  function init() {
    if (typeof setActiveBottomNav === "function") setActiveBottomNav("booking");

    FILTER = normalizeFilter(new URLSearchParams(window.location.search).get("filter") || FILTER);

    document.querySelectorAll(".seg-btn").forEach(btn => {
      btn.classList.toggle("active", (btn.dataset.filter || "all") === FILTER);
      btn.onclick = () => {
        document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        FILTER = normalizeFilter(btn.dataset.filter || "all");
        applyFilters();
      };
    });

    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.oninput = () => {
        KEYWORD = searchInput.value;
        applyFilters();
      };
    }

    loadData();
    let realtimeBookingTimer = null;
    window.addEventListener('agriprice:realtime:booking', () => {
      clearTimeout(realtimeBookingTimer);
      realtimeBookingTimer = setTimeout(loadData, 120);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
