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

  function esc(input) {
    if (window.AgriPriceUI) return window.AgriPriceUI.escapeHtml(input);
    return String(input ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mapStatusText(status) {
    switch (status) {
      case "waiting": return t('waiting', 'รอคิว');
      case "success": return t('success', 'สำเร็จ');
      case "cancel": return t('cancel', 'ยกเลิก');
      default: return t('unknown', 'ไม่ทราบสถานะ');
    }
  }

  /* =========================
     Data Mapping
   ========================= */
  const mapApiItemToUi = (b) => {
    const shopName = b.farmer
      ? `${b.farmer.first_name || ''} ${b.farmer.last_name || ''}`.trim()
      : t('booking_unknown_name', 'เกษตรกรทั่วไป');
    
    let createdAt = "-";
    if (b.created_at) {
      const d = new Date(b.created_at);
      createdAt = !isNaN(d.getTime()) 
        ? d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : b.created_at;
    }

    let timeStr = "-";
    if (b.slot && b.slot.time_start) {
      timeStr = b.slot.time_start;
    } else if (b.scheduled_time) {
      const d = new Date(b.scheduled_time);
      timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : b.scheduled_time;
    }

    let vehicles = [];
    try {
      vehicles = typeof b.vehicle_info === 'string' ? JSON.parse(b.vehicle_info) : (b.vehicle_info || []);
      if (!Array.isArray(vehicles)) vehicles = [];
    } catch (_) {}

    return {
      id: b.id,
      bookingId: b.booking_no || String(b.id),
      status: b.status || "waiting",
      shopName: shopName,
      phone: b.farmer?.phone || "",
      address: b.farmer ? [b.farmer.address_line1, b.farmer.address_line2].filter(Boolean).join(' ') : "",
      queueNo: b.queue_no || "-",
      time: timeStr,
      createdAt: createdAt,
      productName: b.offer?.title || b.product?.name || "",
      quantityKg: b.expected_qty || b.product_amount || 0,
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
      const passFilter = FILTER === "all" ? true : (b.status === FILTER);
      const passSearch = !k || 
        b.bookingId.toLowerCase().includes(k) || 
        b.shopName.toLowerCase().includes(k) || 
        b.queueNo.toLowerCase().includes(k);
      return passFilter && passSearch;
    });

    renderList(filtered, listEl);
    if (emptyEl) emptyEl.hidden = filtered.length !== 0;
  }

  function renderList(list, container) {
    container.innerHTML = list.map(b => `
      <article class="booking-card" data-id="${esc(b.bookingId)}" data-dbid="${b.id}">
        <div class="row">
          <div class="shop">${esc(b.shopName)}</div>
          <div class="badge ${b.status}">${mapStatusText(b.status)}</div>
        </div>

        <div class="meta">
          ${t('booking_id', 'เลขที่การจอง')}: <b>${esc(b.bookingId)}</b> • ${t('scheduled_time', 'เวลานัดคิว')}: <b>${esc(b.time)} น.</b>
        </div>

        ${b.productName ? `<div class="meta">${esc(b.productName)} — <b>${Number(b.quantityKg).toLocaleString()} กก.</b></div>` : ''}

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
    let torchActive = false;

    const isNative = () => !!(window.Capacitor && window.Capacitor.isNative);

    async function start() {
      if (window.AgriPermission && window.AgriPermission.requestCamera) {
        const p = await window.AgriPermission.requestCamera();
        if (!p.granted) return;
      }

      if (isNative()) {
        startNativeScanner();
      } else {
        startWebScanner();
      }
    }

    async function startNativeScanner() {
      try {
        const { BarcodeScanner } = window.Capacitor.Plugins;
        if (!BarcodeScanner) throw new Error("Scanner plugin not found");

        // Hide app background to see camera
        document.body.classList.add("scanner-active");
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        const result = await BarcodeScanner.startScan({ formats: ['QR_CODE'] });
        if (result.hasContent) {
          handleDetected(result.content);
        }
      } catch (err) {
        console.error("[Native Scan] Error:", err);
        stop();
        alert(t('error_camera', 'ไม่สามารถเริ่มสแกนเนอร์ได้'));
      }
    }

    async function startWebScanner() {
      try {
        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        const video = document.createElement("video");
        video.id = "scanVideo";
        video.style.cssText = "width:100%; height:100%; object-fit:cover; position:absolute; inset:0; z-index:-1;";
        video.setAttribute("autoplay", "true");
        video.setAttribute("muted", "true");
        video.setAttribute("playsinline", "true");
        
        const box = modal.querySelector(".viewfinder-box");
        if (box) box.appendChild(video);

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;

        // Use MLKit BarcodeDetector if available in browser, else just wait (it's a demo)
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
        alert(t('error_camera', 'ไม่สามารถเปิดกล้องได้'));
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
      
      const { BarcodeScanner } = window.Capacitor.Plugins;
      torchActive = !torchActive;
      await BarcodeScanner.enableTorch(); // Simplify for MLKit
      torchBtn.classList.toggle("active", torchActive);
    }

    function stop() {
      if (isNative()) {
        const { BarcodeScanner } = window.Capacitor.Plugins;
        BarcodeScanner?.stopScan();
        document.body.classList.remove("scanner-active");
      }

      if (scanInterval) clearInterval(scanInterval);
      if (stream) stream.getTracks().forEach(t => t.stop());
      
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
          bid = url.searchParams.get("bid") || url.searchParams.get("bookingId") || val;
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
      else alert(t('error_enter_code', 'กรุณากรอกรหัสการจอง'));
    };
    modal.onclick = (e) => { if (e.target === modal) stop(); };

    return { start, stop };
  })();

  /* =========================
     Init Page
   ========================= */
  function init() {
    if (typeof setActiveBottomNav === "function") setActiveBottomNav("booking");

    document.querySelectorAll(".seg-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        FILTER = btn.dataset.filter || "all";
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
  }

  document.addEventListener("DOMContentLoaded", init);
})();
