/**
 * AGRIPRICE - Booking Step 4 JavaScript
 * ฟีเจอร์: การจองสำเร็จ, QR Code, สถานะคิว, แผนที่, ยกเลิกการจอง
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack") || document.querySelector(".btn-back");
  const btnOpenMap = document.getElementById("openMapBtn");
  const btnCancelBooking = document.getElementById("btnCancelBooking");
  const toggleDetailBtn = document.getElementById("btnToggleDetail") || document.getElementById("toggleDetailBtn");

  const queueNo = document.getElementById("queueNo");
  const timeText = document.getElementById("timeText");
  const bookingIdText = document.getElementById("bookingIdText");
  const currentQueue = document.getElementById("currentQueue");
  const myQueue = document.getElementById("myQueue");
  const aheadCount = document.getElementById("aheadCount");

  const heroBg = document.getElementById("heroBg");
  const heroStatusIcon = document.getElementById("heroStatusIcon");
  const heroSub = document.getElementById("heroSub");
  const statusPill = document.getElementById("statusPill");

  function normalizeUiStatus(status) {
    const value = String(status || "waiting").toLowerCase();
    if (value === "success" || value === "completed" || value === "complete") return "completed";
    if (value === "cancel" || value === "cancelled" || value === "canceled") return "cancelled";
    if (value === "confirmed") return "confirmed";
    if (value === "in_progress" || value === "processing") return "in_progress";
    if (value === "rejected") return "rejected";
    return "waiting";
  }

  function applyStatusUi(status) {
    const uiStatus = normalizeUiStatus(status);
    const config = {
      waiting: {
        icon: "hourglass_top",
        label: t("status_waiting", "รอคิว"),
        message: t("status_msg_waiting", "การจองของคุณอยู่ในคิวรอ"),
      },
      confirmed: {
        icon: "check_circle",
        label: t("status_confirmed", "ยืนยันแล้ว"),
        message: t("status_msg_confirmed", "การจองของคุณได้รับการยืนยันแล้ว"),
      },
      in_progress: {
        icon: "sync",
        label: t("status_in_progress", "กำลังดำเนินการ"),
        message: t("status_msg_in_progress", "กำลังดำเนินการรับสินค้าของคุณ"),
      },
      completed: {
        icon: "task_alt",
        label: t("status_completed", "เสร็จสิ้น"),
        message: t("status_msg_completed", "การรับสินค้าเสร็จสิ้นแล้ว"),
      },
      cancelled: {
        icon: "cancel",
        label: t("status_cancelled", "ยกเลิกแล้ว"),
        message: t("status_msg_cancelled", "การจองนี้ถูกยกเลิกแล้ว"),
      },
      rejected: {
        icon: "block",
        label: t("status_rejected", "ถูกปฏิเสธ"),
        message: t("status_msg_rejected", "การจองนี้ถูกปฏิเสธโดยร้านล้ง"),
      },
    }[uiStatus];

    if (heroBg) {
      heroBg.className = 'hero-bg';
      heroBg.classList.add(`status-${uiStatus}`);
      if (uiStatus === 'cancelled' || uiStatus === 'rejected') {
        document.querySelector('.booking-step4')?.classList.add('is-canceled');
      } else {
        document.querySelector('.booking-step4')?.classList.remove('is-canceled');
      }
    }
    if (heroStatusIcon) heroStatusIcon.textContent = config.icon;
    if (heroSub) heroSub.textContent = config.message;
    if (statusPill) statusPill.textContent = config.label;
    if (btnCancelBooking) {
      btnCancelBooking.style.display = ["completed", "cancelled", "rejected"].includes(uiStatus) ? "none" : "";
    }
  }
  const eta = document.getElementById("eta");
  const shopName = document.getElementById("shopName");
  const shopAddr = document.getElementById("shopAddr");
  const detailPanel = document.getElementById("detailPanel");
  const qrCanvas = document.getElementById("qrCanvas");

  // ================================
  // Path helpers
  // ================================
  function getRelativePrefixToRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "";

    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;

    return "../" + "../".repeat(depth);
  }

  const prefixRoot = getRelativePrefixToRoot();

  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    const normalized = String(p).replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
    return prefixRoot + normalized;
  }

  // ================================
  // API LAYER
  // ================================
  const getApiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  const _TKEY   = window.AUTH_TOKEN_KEY || 'token';
  const _aH     = () => { const t=localStorage.getItem(_TKEY)||''; return t?{'Authorization':'Bearer '+t}:{}; };
  let statusPollTimer = null;

  const BookingAPI = {
    getResolvedAddress(raw) {
      const formPayload = raw?.form_payload && typeof raw.form_payload === 'object'
        ? raw.form_payload
        : {};
      const formAddress = [
        formPayload.address,
        formPayload.contact?.address,
        formPayload.contact?.address_line1,
      ].find(v => typeof v === 'string' && v.trim());

      return [
        raw?.address,
        formAddress,
      ].find(v => typeof v === 'string' && v.trim()) || '';
    },

    async loadConfirmedBooking() {
      const urlP = new URLSearchParams(window.location.search);
      const bid  = urlP.get("bookingId") || urlP.get("bid") || null;
      const local = localStorage.getItem("confirmedBooking");
      const localObj = (() => {
        try { return local ? JSON.parse(local) : null; }
        catch (_) { return null; }
      })();

      const preferredBid = localObj?.booking_id || localObj?.bookingId || localObj?.booking_no || bid || null;

      const mapBookingRecord = (d, fallbackId) => {
        let vehicles = [];
        let productAmount = 0;
        try {
          const noteData = typeof d.note === 'string' ? JSON.parse(d.note || '{}') : (d.note || {});
          vehicles = Array.isArray(noteData.vehicles) ? noteData.vehicles : [];
          productAmount = noteData.productAmount || d.product_amount || d.expected_qty || d.quantity || 0;
        } catch(_) {}
        
        if (vehicles.length === 0 && (d.vehicle_plates || d.vehicle_info)) {
          vehicles = String(d.vehicle_plates || d.vehicle_info).split(',')
            .map(p => p.trim()).filter(Boolean)
            .map(plate => ({ plate, type: 'truck', typeName: t('truck', 'รถบรรทุก') }));
        }
        if (!productAmount && d.product_amount) productAmount = d.product_amount;
        if (!productAmount && d.expected_qty) productAmount = d.expected_qty;
        if (!productAmount && d.quantity) productAmount = d.quantity;

        const firstRelation = (value) => Array.isArray(value) ? value[0] : value;
        const offerOwner = d.offer_owner
          || d.buyer_profile
          || firstRelation(d.product?.profiles)
          || firstRelation(d.products?.profiles)
          || firstRelation(d.buy_offers?.profiles)
          || firstRelation(d.slot?.product?.profiles)
          || null;
        const requester = d.requester || d.farmer || d.buyer || null;
        const ownerAddress = offerOwner
          ? [offerOwner.address_line1, offerOwner.address_line2].filter(Boolean).join(" ")
          : "";
        const resolvedAddress = ownerAddress || offerOwner?.address || "";

        const shopLabel = offerOwner
          ? (offerOwner.shop_name || `${offerOwner.first_name || ""} ${offerOwner.last_name || ""}`.trim())
          : "";
        const requesterName = requester
          ? `${requester.first_name || ""} ${requester.last_name || ""}`.trim()
          : "";
        const ownerMapLink = (offerOwner?.lat && offerOwner?.lng)
          ? `${offerOwner.lat},${offerOwner.lng}`
          : (offerOwner?.map_link || "");

        return {
          bookingId:    String(d.booking_no || d.booking_id || fallbackId || ''),
          booking_id:   d.booking_id || null,
          booking_no:   d.booking_no || null,
          status:       d.status || 'waiting',
          shopName:     shopLabel,
          fullName:     requesterName,
          phone:        offerOwner?.phone || requester?.phone || '',
          address:      resolvedAddress,
          mapLink:      ownerMapLink,
          queueNo:      d.queue_no || '',
          queue_no:     d.queue_no || '',
          slot_id:      d.slot_id || null,
          time:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '',
          date:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleDateString('th-TH') : '',
          productName:  d.product?.name || '',
          vehicleCount: vehicles.length || d.vehicle_count || 1,
          productAmount,
          vehicles,
        };
      };

      if (window.api && preferredBid) {
        try {
          const d = await window.api.getBooking(preferredBid);
          if (d) return mapBookingRecord(d.data || d, preferredBid);
        } catch(e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] loadConfirmedBooking:', e.message); }
      }

      if (local) return JSON.parse(local);
      return null;
    },

    async saveConfirmedBooking(data) {
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus(bookingId) {
      if (window.api && bookingId) {
        try {
          // 1. Try specialized queue-status endpoint
          const json = await window.api.getQueueStatus(bookingId);
          if (json) {
            const d = json.data || json || {};
            const ahead = Math.max(0, Number(d.waitingAhead || 0));
            return {
              currentQueue: d.currentQueue || "-",
              waitingQueues: ahead,
              estimatedMinutes: ahead * 30,
              averageTimePerQueue: 30,
            };
          }
        } catch(e) { 
          if (DEBUG_BOOKING) console.warn("[step4] Queue logic failed:", e); 
        }
      }
      return { currentQueue: "-", waitingQueues: 0, estimatedMinutes: 0, averageTimePerQueue: 30 };
    },

    async loadLocationData(bookingData) {
      if (bookingData) {
        return {
          name: bookingData.shopName || '',
          address: bookingData.address || '',
          lat: null,
          lng: null,
          googleMapsUrl: bookingData.address
            ? `https://maps.google.com/?q=${encodeURIComponent(bookingData.address)}`
            : '',
        };
      }
      return { name: '', address: '', lat: null, lng: null, googleMapsUrl: '' };
    },

    async cancelBooking(bookingId, cancelReason) {
      if (!window.api) return { success: false, message: "API client not ready" };
      try {
        await window.api.updateBooking(bookingId, 'cancel', cancelReason ? { cancel_reason: cancelReason } : {});
        localStorage.removeItem("confirmedBooking");
        localStorage.removeItem("bookingSlotId");
        localStorage.removeItem("bookingStep1");
        localStorage.removeItem("bookingStep2");
        return { success: true, message: t('cancel_booking_success', "ยกเลิกการจองสำเร็จ") };
      } catch (e) {
        if (DEBUG_BOOKING) console.warn('[BookingAPI] cancelBooking:', e.message);
        return { success: false, message: e.message || t('error_occurred', "เกิดข้อผิดพลาด") };
      }
    },
  };

  // ================================
  // Utilities
  // ================================
  function formatEstimatedTime(minutes) {
    if (minutes < 60) return `${minutes} ${t('unit_minute', 'นาที')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ${t('unit_hour', 'ชั่วโมง')}`;
    return `${hours} ${t('unit_hour', 'ชั่วโมง')} ${mins} ${t('unit_minute', 'นาที')}`;
  }

  function renderDetailPanel(bookingData) {
    const vehicles = Array.isArray(bookingData.vehicles) ? bookingData.vehicles : [];
    const vehicleHtml = vehicles.length
      ? vehicles.map(v => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0">
            <span class="material-icons-outlined" style="font-size:18px;color:#666">local_shipping</span>
            <div>
              <div style="font-size:13px;font-weight:600">${v.typeName || t(v.type, v.type) || t('vehicle', 'รถ')}</div>
              <div style="font-size:12px;color:#888">${v.plate || '-'}</div>
            </div>
          </div>`).join('')
      : `<div style="color:#999;font-size:13px">${t('no_vehicle_info', 'ไม่มีข้อมูลรถ')}</div>`;

    return `
      <div style="display:flex;flex-direction:column;gap:6px;font-size:14px">
        <div><b>${t('label_shop', 'ร้าน')}:</b> ${shopName.textContent || '-'}</div>
        <div><b>${t('label_address', 'ที่อยู่')}:</b> ${shopAddr.textContent || '-'}</div>
        <div><b>${t('label_queue_no', 'หมายเลขคิว')}:</b> ${bookingData.queueNo || bookingData.slotId || '-'}</div>
        <div><b>${t('label_booking_time', 'เวลานัดคิว')}:</b> ${timeText ? timeText.textContent + ' ' + t('time_unit', 'น.') : '-'}</div>
        <div><b>${t('date', 'วันที่')}:</b> ${bookingData.date || bookingData.dateFormatted || '-'}</div>
        <div><b>${t('label_booking_id', 'Booking ID')}:</b> ${bookingData.bookingId || '-'}</div>
        ${bookingData.productAmount ? `<div><b>${t('label_product_weight', 'น้ำหนักสินค้า')}:</b> ${bookingData.productAmount} ${t('unit_kg', 'กก.')}</div>` : ''}
        <div style="margin-top:8px"><b>${t('label_vehicle_list', 'ยานพาหนะ ({n} คัน)').replace('{n}', vehicles.length)}:</b></div>
        ${vehicleHtml}
      </div>
    `;
  }

  // ================================
  // QR Code
  // ================================
  function buildQrPayload(bookingId) {
    let baseUrl = window.FRONTEND_URL || window.location.origin;
    if (baseUrl.startsWith('capacitor://') || baseUrl.startsWith('ionic://')) {
      const apiBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : '';
      if (apiBase && !apiBase.startsWith('capacitor://') && !apiBase.startsWith('ionic://')) {
        baseUrl = apiBase;
      } else {
        baseUrl = 'https://agriprice-otp.web.app';
      }
    }
    const url = new URL("pages/scan-checkin.html", baseUrl);
    url.searchParams.set("bid", bookingId);
    return url.href;
  }

  function drawFallbackQR() {
    if (!qrCanvas) return;
    qrCanvas.innerHTML = '<div style="width:110px;height:110px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;border-radius:4px;">QR</div>';
  }

  function generateQRCode(text) {
    if (!qrCanvas) return;
    try {
      qrCanvas.innerHTML = "";
      new QRCode(qrCanvas, {
        text: String(text || ""),
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      drawFallbackQR();
    }
  }

  // ================================
  // Load Success Data
  // ================================
  async function loadSuccessData() {
    const bookingData = await BookingAPI.loadConfirmedBooking();
    if (!bookingData) throw new Error("ไม่พบข้อมูลการจอง");
    applyStatusUi(bookingData.status);

    const queueLabel = bookingData.queueNo
      || bookingData.queue_no
      || bookingData.booking_no
      || t('waiting_confirm', 'รอการยืนยัน');
    if (queueNo)  queueNo.textContent  = queueLabel;
    if (myQueue)  myQueue.textContent  = queueLabel;

    if (bookingData.time) {
      if (timeText) timeText.textContent = bookingData.time;
    }

    const bidFromUrl = new URLSearchParams(window.location.search).get("bid");
    let bkId = bookingData.bookingId || String(bookingData.booking_id || "") || bidFromUrl || "";
    if (!bkId) bkId = `LOCAL-${String(queueLabel || '-').replace(/\s+/g, '')}`;

    bookingData.bookingId = bkId;
    await BookingAPI.saveConfirmedBooking(bookingData);

    if (bookingIdText) bookingIdText.textContent = bkId;
    generateQRCode(buildQrPayload(bkId));

    const lookupId = bookingData.booking_id || bookingData.booking_no || bkId;
    const queueStatus = String(bkId).startsWith("LOCAL-")
      ? { currentQueue: queueLabel || '-', waitingQueues: 0, estimatedMinutes: 0 }
      : await BookingAPI.loadQueueStatus(lookupId);

    // ✅ หากเลขคิวหลักยังเป็น "รอการยืนยัน" แต่เราคำนวณคิวได้ ให้สรุปเป็นเลขคิวจริง
    let finalMyQueue = queueLabel;
    if (finalMyQueue === t('waiting_confirm', 'รอการยืนยัน') && queueStatus.currentQueue && queueStatus.currentQueue !== '-') {
      const curSeq = parseInt(String(queueStatus.currentQueue).split('-').pop()) || 0;
      if (curSeq > 0) {
        const mySeq = curSeq + (queueStatus.waitingQueues || 0);
        const prefix = String(queueStatus.currentQueue).split('-')[0] || 'Q';
        finalMyQueue = `${prefix}-${String(mySeq).padStart(2, '0')}`;
      }
    }

    if (queueNo)     queueNo.textContent     = finalMyQueue;
    if (myQueue)     myQueue.textContent     = finalMyQueue;
    if (currentQueue) currentQueue.textContent = queueStatus.currentQueue || '-';
    if (aheadCount)   aheadCount.textContent   = `${queueStatus.waitingQueues ?? 0} ${t('unit_queue', 'คิว')}`;
    if (eta)          eta.textContent           = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    // ✅ อัปเดตข้อมูลใน object เพื่อให้ renderDetailPanel แสดงค่าล่าสุด
    bookingData.queueNo = finalMyQueue;
    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);

    const shopLabel = bookingData.shopName || "-";
    const addrLabel = bookingData.address || "";
    if (shopName)  shopName.textContent  = shopLabel;
    if (shopAddr)  shopAddr.textContent  = addrLabel || t('unspecified_address', "ไม่ระบุที่อยู่");
    
    const mapContainer = document.getElementById('mapContainer');
    const mapIframe = document.getElementById('mapIframe');
    const mapQuery = bookingData.mapLink || addrLabel;
    
    if (mapQuery && mapContainer && mapIframe) {
      mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
      mapContainer.style.display = 'block';
    } else if (mapContainer) {
      mapContainer.style.display = 'none';
    }

    if (btnOpenMap) {
      btnOpenMap.dataset.mapsUrl = bookingData.mapLink || (addrLabel ? `https://maps.google.com/?q=${encodeURIComponent(addrLabel)}` : "");
    }

    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);
    if (!String(bkId).startsWith("LOCAL-") && lookupId) {
      startBookingStatusPolling(lookupId);
    }
  }

  async function checkBookingStatusOnce(bookingId) {
    if (!bookingId || !window.api) return null;
    try {
      const d = await window.api.getBooking(bookingId);
      if (!d) return null;
      const data = d.data || d;
      return { status: data.status, queueNo: data.queue_no };
    } catch (e) { return null; }
  }

  function showBeautifulSuccessPopup(msg) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;transition:opacity 0.3s ease;';
    
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-card,#fff);border-radius:24px;padding:32px 24px;width:calc(100% - 48px);max-width:340px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);transform:scale(0.9) translateY(20px);transition:all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);';
    
    card.innerHTML = `
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(11, 133, 60, 0.15);color:var(--primary,#0B853C);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
        <span class="material-icons-outlined" style="font-size:40px;">check_circle</span>
      </div>
      <h3 style="margin:0 0 12px;font-size:22px;font-weight:900;color:var(--text-main,#111);">สำเร็จ!</h3>
      <p style="margin:0 0 24px;font-size:15px;color:var(--text-muted,#666);line-height:1.5;">${msg}</p>
      <button style="width:100%;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg, var(--primary,#0B853C) 0%, #00C853 100%);color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(11, 133, 60, 0.3);">ตกลง (OK)</button>
    `;
    
    const btn = card.querySelector('button');
    btn.onclick = () => {
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.9) translateY(20px)';
      setTimeout(() => overlay.remove(), 300);
    };
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      card.style.transform = 'scale(1) translateY(0)';
    });
  }

  function startBookingStatusPolling(bookingId) {
    if (statusPollTimer) clearInterval(statusPollTimer);
    let lastKnownStatus = null;

    async function refreshQueueDisplay() {
      const snap = await checkBookingStatusOnce(bookingId);
      if (!snap) return;
      
      if (snap.status === 'success') {
        setCancellationAvailable(snap.status);
        if (aheadCount) aheadCount.textContent = `0 ${t('unit_queue', 'คิว')}`;
        if (eta) eta.textContent = `0 ${t('unit_minute', 'นาที')}`;
        if (currentQueue) currentQueue.textContent = snap.queueNo || '-';
        
        // Show beautiful alert if status just changed to success while watching
        if (lastKnownStatus && lastKnownStatus !== 'success') {
          if (window.Capacitor?.Plugins?.Haptics) {
            try { await window.Capacitor.Plugins.Haptics.impact({ style: 'heavy' }); } catch(e){}
          }
          showBeautifulSuccessPopup('ล้งยืนยันรับคิวและเช็คอินสำเร็จแล้ว!');
        }
        
        clearInterval(statusPollTimer);
        return;
      }
      
      lastKnownStatus = snap.status;

      try {
        const d = await window.api.getQueueStatus(bookingId);
        if (d) {
          const data = d.data || d || {};
          if (currentQueue) currentQueue.textContent = data.currentQueue || '-';
          if (aheadCount)   aheadCount.textContent   = `${data.waitingAhead ?? 0} ${t('unit_queue', 'คิว')}`;
          if (eta)          eta.textContent           = formatEstimatedTime(data.estimatedMinutes ?? 0);
        }
      } catch(e) {}
    }
    refreshQueueDisplay();
    // Reduce interval from 15s to 5s for fast real-time feedback
    statusPollTimer = setInterval(refreshQueueDisplay, 5000);
  }

  // ================================
  // Event Handlers
  // ================================

  function handleToggleDetail() {
    if (!detailPanel || !toggleDetailBtn) return;
    const isHidden = detailPanel.hidden;
    detailPanel.hidden = !isHidden;
    toggleDetailBtn.textContent = isHidden ? t('hide_booking_details', "ซ่อนรายละเอียดการจอง") : t('show_booking_details', "แสดงรายละเอียดการจอง");
  }

  async function handleOpenMap() {
    const mapsUrl = btnOpenMap?.dataset?.mapsUrl;
    if (mapsUrl) {
      const finalUrl = mapsUrl.startsWith('http') ? mapsUrl : `https://www.google.com/maps?q=${encodeURIComponent(mapsUrl)}`;
      if (window.openExternalInApp) await window.openExternalInApp(finalUrl);
      else window.location.href = finalUrl;
    }
  }

  async function handleCancelBooking() {
    const bkId = (bookingIdText?.textContent || '').trim();
    const latestBooking = await checkBookingStatusOnce(bkId);
    const latestStatus = String(latestBooking?.status || '').toLowerCase();
    if (['success', 'completed', 'cancel', 'cancelled', 'canceled', 'rejected'].includes(latestStatus)) {
      setCancellationAvailable(latestStatus);
      if (window.appNotify) {
        window.appNotify(
          ['success', 'completed'].includes(latestStatus)
            ? t('completed_cannot_cancel', 'งานนี้เสร็จสิ้นแล้ว ไม่สามารถยกเลิกการจองได้')
            : t('booking_cannot_cancel', 'การจองนี้ไม่สามารถยกเลิกได้'),
          'warning'
        );
      }
      return;
    }

    // Step 1: Ask for reason first with preset choices
    const reasonOptions = [
      t("cancel_reason_change_plan", "เปลี่ยนแผน / ไม่ว่างตามนัด"),
      t("cancel_reason_price", "ราคาไม่เป็นที่ต้องการ"),
      t("cancel_reason_product", "ผลผลิตไม่พร้อมจำหน่าย"),
      t("cancel_reason_emergency", "เหตุฉุกเฉิน / เป็นเหตุสุดวิสัย"),
      t("cancel_reason_double_book", "จองซ้ำ / ผิดรายการ"),
      t("cancel_reason_other", "อื่นๆ"),
    ];

    let cancelReason = null;
    try {
      cancelReason = await new Promise((resolve) => {
        // Build a small inline dialog
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
        const card = document.createElement("div");
        card.style.cssText = "background:#fff;border-radius:20px;padding:24px 20px;max-width:380px;width:100%;font-family:'Outfit',sans-serif;";
        card.innerHTML = `
          <h3 style="margin:0 0 6px;font-size:18px;font-weight:800;color:#1a1a1a">${t("cancel_reason_title", "กรุณาระบุเหตุผลการยกเลิก")}</h3>
          <p style="margin:0 0 16px;font-size:13px;color:#888">${t("cancel_reason_sub", "ข้อมูลนี้จะถูกแสดงให้ผู้รับซื้อทราบสาเหตุการยกเลิก")}</p>
          <div id="reasonOptions" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
            ${reasonOptions.map((r, i) => `<button data-idx="${i}" style="background:#F0F4F1;border:1.5px solid transparent;border-radius:12px;padding:11px 14px;text-align:left;font-size:14px;font-weight:600;cursor:pointer;color:#1a1a1a;font-family:inherit;width:100%">${r}</button>`).join("")}
          </div>
          <textarea id="reasonFreeText" placeholder="${t("or_type_reason", "หรือพิมพ์เหตุผลเพิ่มเติม...สามารถไม่ระบุก็ได้")}" style="width:100%;height:70px;border:1.5px solid #ddd;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;resize:none;margin-bottom:14px;box-sizing:border-box"></textarea>
          <div style="display:flex;gap:10px">
            <button id="reasonCancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #ddd;background:transparent;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:#666">${t("back", "ยกเลิก")}</button>
            <button id="reasonConfirm" style="flex:1;padding:12px;border-radius:12px;border:none;background:#E53935;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">${t("confirm_cancel", "ยืนยันยกเลิก")}</button>
          </div>
        `;
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        let selected = null;
        card.querySelectorAll("#reasonOptions button").forEach(btn => {
          btn.addEventListener("click", () => {
            card.querySelectorAll("#reasonOptions button").forEach(b => { b.style.background = "#F0F4F1"; b.style.border = "1.5px solid transparent"; b.style.color = "#1a1a1a"; });
            btn.style.background = "rgba(229,57,53,0.08)";
            btn.style.border = "1.5px solid rgba(229,57,53,0.4)";
            btn.style.color = "#E53935";
            selected = reasonOptions[Number(btn.dataset.idx)];
            card.querySelector("#reasonFreeText").value = "";
          });
        });
        card.querySelector("#reasonFreeText").addEventListener("input", () => { selected = null; });
        card.querySelector("#reasonCancel").onclick = () => { document.body.removeChild(overlay); resolve(null); };
        card.querySelector("#reasonConfirm").onclick = () => {
          const freeText = card.querySelector("#reasonFreeText").value.trim();
          document.body.removeChild(overlay);
          resolve(freeText || selected || "");
        };
      });
    } catch (_) { cancelReason = null; }

    // null means user dismissed without confirming
    if (cancelReason === null) return;

    const result = await BookingAPI.cancelBooking(bkId, cancelReason);
    if (result.success) {
      if (window.appNotify) window.appNotify(t('cancel_success', "ยกเลิกการจองสำเร็จ"), "success");
      window.location.href = resolveToRootUrl("pages/farmer/booking/booking.html?filter=cancel");
    } else {
      if (window.appNotify) window.appNotify(result.message || t('cancel_error', "ยกเลิกการจองไม่สำเร็จ"), "error");
    }
  }

  btnBack?.addEventListener("click", () => {
    window.location.href = resolveToRootUrl("pages/farmer/booking/booking.html");
  });

  toggleDetailBtn?.addEventListener("click", handleToggleDetail);
  btnOpenMap?.addEventListener("click", handleOpenMap);
  btnCancelBooking?.addEventListener("click", handleCancelBooking);

  loadSuccessData();
});
