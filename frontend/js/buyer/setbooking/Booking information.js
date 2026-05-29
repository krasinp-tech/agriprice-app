/**
 * AGRIPRICE - Booking Step 4 JavaScript
 * ฟีเจอร์: การจองสำเร็จ, QR Code, สถานะคิว, แผนที่, ยกเลิกการจอง
 * แนวทาง QR ที่ถูกต้อง: เก็บ URL/bookingId สั้น ๆ แล้ว lookup จาก DB ในอนาคต
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

  const escapeHtml = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack");
  const toggleDetailBtn = document.getElementById("toggleDetailBtn");
  const btnCancelBooking = document.getElementById("btnCancelBooking");

  const queueNo = document.getElementById("queueNo");
  const timeText = document.getElementById("timeText");
  const bookingIdText = document.getElementById("bookingIdText");
  const currentQueue = document.getElementById("currentQueue");
  const myQueue = document.getElementById("myQueue");
  const aheadCount = document.getElementById("aheadCount");
  const eta = document.getElementById("eta");
  const shopName = document.getElementById("shopName");
  const shopAddr = document.getElementById("shopAddr");
  const farmerPhone = document.getElementById("farmerPhone");
  const btnCall = document.getElementById("btnCall");
  const btnChat = document.getElementById("btnChat");
  const btnOpenMap = document.getElementById("btnOpenMap");
  const detailPanel = document.getElementById("detailPanel");
  const qrCanvas = document.getElementById("qrCanvas");
  const vehicleCountTotal = document.getElementById("vehicleCountTotal");
  const vehiclesList = document.getElementById("vehiclesList");

  // ================================
  // Path helpers (สำคัญ: ให้ทำงานได้ทุกระดับ)
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
  // API LAYER - เชื่อม server จริง
  // ================================
  const _API = (window.API_BASE_URL || '').replace(/\/$/, '');
  const _TKEY = window.AUTH_TOKEN_KEY || 'token';
  const _aH = () => { const t = localStorage.getItem(_TKEY) || ''; return t ? { 'Authorization': 'Bearer ' + t } : {}; };

  const BookingAPI = {
    async loadConfirmedBooking() {
      // อ่าน bookingId จาก URL หรือ localStorage
      const urlP = new URLSearchParams(window.location.search);
      const bid = urlP.get("bookingId") || urlP.get("bid") || null;

      // ถ้ามี API และ bid ให้ดึงจาก server
      if (_API && bid) {
        try {
          const res = await fetch(`${_API}/api/bookings/${bid}`, { headers: _aH() });
          if (res.ok) {
            const json = await res.json();
            // server ส่ง { success, message, data, ...data } ใช้ json.data หรือ json ตรง ๆ
            const d = json.data || json;
            // หา farmer/seller จากฟิลด์ที่ API ส่งมา (รองรับหลายชื่อ)
            const farmer = d.farmer || d.seller || d.buyer_profile || null;
            const buyer  = d.buyer  || d.farmer_profile || null; // ไม่ได้ใช้แสดงในส่วนเกษตรกร
            return {
              bookingId: String(d.booking_no || d.booking_id || bid),
              status: d.status || 'waiting',
              shopName: farmer
                ? (farmer.shop_name || `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim())
                : (d.shop_name || 'AgriPrice Store'),
              fullName: farmer ? `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim() : '',
              phone: farmer?.phone || d.farmer_phone || '',
              address: d.farmer_address || '-',
              queueNo: d.queue_no || '',
              time: d.scheduled_time ? new Date(d.scheduled_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '',
              date: d.scheduled_time ? new Date(d.scheduled_time).toISOString() : '',
              productName: d.product?.name || '',
              quantityKg: d.product_amount || 0,
              vehicles: Array.isArray(d.vehicles) && d.vehicles.length > 0
                ? d.vehicles
                : (d.vehicle_plates
                  ? String(d.vehicle_plates).split(',').map(p => p.trim()).filter(Boolean).map(plate => ({ plate, type: 'รถบรรทุก' }))
                  : []),
              vehicleCount: d.vehicle_count || 0,
              slotName: d.slot?.slot_name || '',
              mapLink: farmer?.map_link || farmer?.mapLink || '',
              chatTargetId: farmer?.profile_id || d.farmer_id || d.seller_id || null,
              booking_id: d.booking_id || null,
              booking_no: d.booking_no || null,
              dateFormatted: d.scheduled_time ? new Date(d.scheduled_time).toISOString() : '',
            };
          }
        } catch (e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] loadConfirmedBooking:', e.message); }
      }

      // fallback: localStorage (ข้อมูลจาก step3)
      const local = localStorage.getItem("confirmedBooking");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed) {
            parsed.address = parsed.address || '-';
            return parsed;
          }
        } catch (_) {}
      }

      return null;
    },

    async saveConfirmedBooking(data) {
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus(bookingData) {
      // [FIX] เรียก /api/bookings/:id/queue-status จริง แทนการ hardcode
      const lookupId = bookingData?.booking_id || bookingData?.booking_no || bookingData?.bookingId;
      if (_API && lookupId) {
        try {
          const res = await fetch(`${_API}/api/bookings/${lookupId}/queue-status`, { headers: _aH() });
          if (res.ok) {
            const json = await res.json();
            const d = json?.data || {};
            return {
              currentQueue: d.currentQueue || '-',
              waitingQueues: Number(d.waitingAhead || 0),
              estimatedMinutes: Number(d.estimatedMinutes || 0),
              averageTimePerQueue: Number(d.averageTimePerQueue || 30),
            };
          }
        } catch (e) { if (DEBUG_BOOKING) console.warn('[Buyer BookingAPI] loadQueueStatus:', e.message); }
      }
      return {
        currentQueue: '-',
        waitingQueues: 0,
        estimatedMinutes: 0,
        averageTimePerQueue: 30,
      };
    },

    async loadLocationData() {
      // ที่อยู่มาจาก booking data แล้ว หากไม่มีให้ return ว่าง
      return {
        name: "",
        address: "",
        lat: 0,
        lng: 0,
        googleMapsUrl: "",
      };
    },

    async cancelBooking(bookingId) {
      if (_API && bookingId) {
        try {
          const res = await fetch(`${_API}/api/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { ..._aH(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancel' }),
          });
          if (res.ok) {
            localStorage.removeItem("confirmedBooking");
            localStorage.removeItem("bookingSlotId");
            localStorage.removeItem("bookingStep1");
            localStorage.removeItem("bookingStep2");
            localStorage.removeItem("bookingData");
            localStorage.removeItem("bookingReferrer");
            return { success: true, message: "ยกเลิกการจองสำเร็จ" };
          }
          return { success: false, message: "ยกเลิกการจองไม่สำเร็จ" };
        } catch (e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] cancelBooking:', e.message); }
      }
      return { success: false, message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" };
    },
  };


  // ================================
  // Utilities
  // ================================
  function generateBookingId(slotId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    // ใส่ slotId ต่อท้ายเล็กน้อยเพื่อไม่ให้ซ้ำง่าย (ยังคงสั้น)
    const slot = String(slotId || "").replace(/\s+/g, "").slice(0, 8);
    return `BK${year}${month}${day}${random}${slot ? "-" + slot : ""}`;
  }

  function formatBookingDate(dateValue) {
    if (window.AgriPriceUI) return window.AgriPriceUI.formatThaiDate(dateValue);
    if (!dateValue) return "-";
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return "-";
    const lang = localStorage.getItem('lang') || 'th';
    const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  function formatEstimatedTime(minutes) {
    if (window.AgriPriceUI) return window.AgriPriceUI.formatEstimatedTime(minutes);
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    if (minutes < 60) return `${minutes} ${t('minute', 'นาที')}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ${t('hour', 'ชั่วโมง')}`;
    return `${hours} ${t('hour', 'ชั่วโมง')} ${mins} ${t('minute', 'นาที')}`;
  }

  function renderDetailPanel(bookingData) {
    return `
      <div><b>${window.i18nT('shop_label', 'ร้าน')}:</b> ${escapeHtml(bookingData.shopName || "-")}</div>
      <div><b>${window.i18nT('address_label', 'ที่อยู่')}:</b> ${escapeHtml(bookingData.address || "-")}</div>
      <div><b>${window.i18nT('queue_number', 'หมายเลขคิว')}:</b> ${escapeHtml(bookingData.queueNo || "-")}</div>
      <div><b>${window.i18nT('queue_time', 'เวลานัดคิว')}:</b> ${escapeHtml(bookingData.time ? bookingData.time + " น." : "-")}</div>
      <div><b>${window.i18nT('transaction_date', 'วันที่')}:</b> ${escapeHtml(formatBookingDate(bookingData.date || bookingData.dateFormatted))}</div>
      <div><b>${window.i18nT('booking_number', 'Booking ID')}:</b> ${escapeHtml(bookingData.bookingId || bookingData.booking_no || "-")}</div>
    `;
  }

  // ================================
  // Render Vehicles Information
  // ================================
  function renderVehicles(bookingData) {
    const vehicles = Array.isArray(bookingData.vehicles) ? bookingData.vehicles : [];
    // แสดงจำนวนรถจาก vehicle_count (API) หรือ vehicles.length
    const count = vehicles.length || bookingData.vehicleCount || 0;
    if (vehicleCountTotal) vehicleCountTotal.textContent = count || "-";

    if (vehicles.length === 0) return; // ไม่มี plate/type ให้แสดง

    if (vehiclesList) {
      vehiclesList.innerHTML = vehicles
        .map(
          (v) => `
        <div class="vehicleRow">
          <div class="vehicleRowContent">
            <div class="vehicleRowPlate">${String(v.plate || "-").toUpperCase()}</div>
            <div class="vehicleRowType">${v.type || "-"}</div>
          </div>
        </div>
      `
        )
        .join("");
    }
  }

  // ================================
  // QR Code (แก้ overflow + สแกนแล้วใช้งานได้จริง)
  // ================================
  function buildQrPayload(bookingId) {
    // แนะนำให้ QR เป็น URL สั้น แล้วฝั่งปลายทางใช้ bookingId ไป lookup DB
    // สแกนแล้วเปิดหน้า step4 พร้อม bid (ตอนนี้ใช้ localStorage fallback ได้)
    const base =
      (window.location.origin || "") + resolveToRootUrl("pages/buyer/setbooking/Booking information.html");
    return `${base}?bid=${encodeURIComponent(bookingId)}`;
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
        width: 110,
        height: 110,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      if (DEBUG_BOOKING) console.log("สร้าง QR Code:", text);
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

    // slot - ใช้ queueNo จากข้อมูล, fallback ไป slotId หรือ localStorage
    const slot = bookingData.queueNo || bookingData.slotId || localStorage.getItem("bookingSlotId") || "";
    if (queueNo) queueNo.textContent = slot;
    if (myQueue) myQueue.textContent = slot;

    // time - ใช้ time จากข้อมูล
    if (bookingData.time) {
      if (timeText) timeText.textContent = bookingData.time;
    }

    // bookingId (ต้องคงที่: ถ้ายังไม่มีให้สร้าง แล้ว save กลับ)
    let bkId = bookingData.bookingId;

    // รองรับกรณีสแกน QR เปิดกลับมา: อ่าน bid จาก query ก่อน
    const bidFromUrl = new URLSearchParams(window.location.search).get("bid");
    if (bidFromUrl) bkId = bidFromUrl;

    if (!bkId) {
      bkId = generateBookingId(slot);
    }

    // sync ลง data และ save (เพื่ออนาคต DB ใช้ id นี้เป็น key)
    bookingData.bookingId = bkId;
    await BookingAPI.saveConfirmedBooking(bookingData);

    if (bookingIdText) bookingIdText.textContent = bkId;

    // QR: ใช้ URL สั้น
    const qrText = buildQrPayload(bkId);
    generateQRCode(qrText);

    // queue status
    const queueStatus = await BookingAPI.loadQueueStatus(bookingData);
    if (currentQueue) currentQueue.textContent = queueStatus.currentQueue || "-";
    const qSuffix = window.i18nT ? window.i18nT('queue_suffix', 'คิว') : 'คิว';
    if (aheadCount) aheadCount.textContent = `${queueStatus.waitingQueues ?? 0} ${qSuffix}`;
    if (eta) eta.textContent = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    // location - ถ้า bookingData มี shopName/address ให้ใช้ค่านั้น
    const locationData = bookingData.shopName ? bookingData : await BookingAPI.loadLocationData();
    if (shopName) shopName.textContent = locationData.shopName || locationData.name || "-";
    if (shopAddr) shopAddr.textContent = locationData.address || "-";
    if (farmerPhone) farmerPhone.textContent = bookingData.phone || "-";

    if (btnCall) {
      btnCall.onclick = () => {
        if (bookingData.phone) window.location.href = `tel:${bookingData.phone}`;
      };
    }
    if (btnChat) {
      btnChat.onclick = () => {
        const targetId = bookingData.chatTargetId || bookingData.farmerId;
        if (DEBUG_BOOKING) console.log("[Chat] Attempting to chat with:", targetId);

        if (targetId) {
          const chatUrl = resolveToRootUrl(`pages/shared/chat.html?targetId=${targetId}`);
          if (DEBUG_BOOKING) console.log("[Chat] Navigating to:", chatUrl);
          if (window.navigateWithTransition) window.navigateWithTransition(chatUrl); else window.location.href = chatUrl;
        } else {
          const msg = window.i18nT ? window.i18nT('chat_not_available', 'ไม่พบข้อมูลสำหรับการแชท') : 'ไม่พบข้อมูลสำหรับการแชท';
          if (window.appNotify) window.appNotify(msg, "warning");
          else console.warn("[Chat] No targetId found for booking:", bookingData);
        }
      };
    }

    if (btnOpenMap) {
      const mUrl = bookingData.mapLink || locationData.googleMapsUrl || "";
      btnOpenMap.style.display = mUrl ? "flex" : "none";
      btnOpenMap.onclick = () => {
        const mapsUrl = mUrl;
        if (mapsUrl) {
          const finalUrl = mapsUrl.startsWith('http') ? mapsUrl : `https://www.google.com/maps?q=${encodeURIComponent(mapsUrl)}`;
          window.open(finalUrl, "_blank");
        }
      };
    }

    // detail panel
    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);

    // Render vehicles information
    renderVehicles(bookingData);

    if (DEBUG_BOOKING) console.log("โหลดข้อมูลสำเร็จ:", { bookingData, queueStatus, location: locationData });
  }

  // ================================
  // Event Handlers
  // ================================
  function handleToggleDetail() {
    if (!detailPanel || !toggleDetailBtn) return;
    const isHidden = detailPanel.hidden;
    detailPanel.hidden = !isHidden;
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    toggleDetailBtn.textContent = isHidden ? t('hide_booking_details', "ซ่อนรายละเอียดการจอง") : t('show_booking_details', "แสดงรายละเอียดการจอง");
  }

  async function handleCancelBooking() {
    const confirmed = await new Promise((resolve) => {
      const message = window.i18nT ? window.i18nT('confirm_cancel_booking', "คุณต้องการยกเลิกการจองหรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้") : "คุณต้องการยกเลิกการจองหรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้";
      if (window.showConfirm) window.showConfirm(message, resolve);
      else resolve(window.confirm(message));
    });
    if (!confirmed) return;

    try {
      const bkId = (bookingIdText?.textContent || "").trim();
      const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
      if (!bkId || bkId === "-") {
        if (window.appNotify) window.appNotify(t('booking_id_not_found', "ไม่พบรหัสการจอง"), "error");
        else console.warn(t('booking_id_not_found', "ไม่พบรหัสการจอง"));
        return;
      }

      const result = await BookingAPI.cancelBooking(bkId);
      if (result?.success) {
        if (window.appNotify) window.appNotify(t('cancel_success', "ยกเลิกการจองสำเร็จ"), "success");
        else console.log(t('cancel_success', "ยกเลิกการจองสำเร็จ"));

        const nextHref = resolveToRootUrl("pages/buyer/setbooking/booking.html?filter=cancel");
        if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
      } else {
        if (window.appNotify) window.appNotify(t('cancel_error', "เกิดข้อผิดพลาดในการยกเลิกการจอง"), "error");
        else console.error(t('cancel_error', "เกิดข้อผิดพลาดในการยกเลิกการจอง"));
      }
    } catch (error) {
      console.error("Error canceling booking:", error);
      const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
      if (window.appNotify) window.appNotify(t('cancel_error', "เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง"), "error");
      else console.error(t('cancel_error', "เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง"));
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    // [FIX] แก้ path ให้ถูกต้อง: pages/buyer/setbooking/booking.html
    if (window.navigateWithTransition) window.navigateWithTransition(resolveToRootUrl("pages/buyer/setbooking/booking.html")); else window.location.href = resolveToRootUrl("pages/buyer/setbooking/booking.html");
  });

  toggleDetailBtn?.addEventListener("click", handleToggleDetail);
  btnCancelBooking?.addEventListener("click", handleCancelBooking);

  // ================================
  // Initialize
  // ================================
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get("bookingId") || urlParams.get("bid");
    const confirmedBooking = localStorage.getItem("confirmedBooking");

    // ถ้ามี bookingId ใน URL ให้ดึงจาก API ได้เลย ไม่ต้องอาศัย localStorage
    // ถ้าไม่มีทั้งคู่ ให้กลับหน้ารายการจอง
    if (!bookingId && !confirmedBooking) {
      if (window.navigateWithTransition) window.navigateWithTransition(resolveToRootUrl("pages/buyer/setbooking/booking.html")); else window.location.href = resolveToRootUrl("pages/buyer/setbooking/booking.html");
      return;
    }

    try {
      await loadSuccessData();
      if (DEBUG_BOOKING) console.log("Booking Step 4 initialized");
    } catch (err) {
      console.error("Error loading success data:", err);
      const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
      window.appNotify(t('load_data_error', "เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง"), "error");
    }
  }

  init();
});
