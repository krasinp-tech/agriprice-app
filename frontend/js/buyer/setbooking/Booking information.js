/**
 * AGRIPRICE - Booking Step 4 JavaScript
 * ฟีเจอร์: การจองสำเร็จ, QR Code, สถานะคิว, แผนที่, ยกเลิกการจอง
 * แนวทาง QR ที่ถูกต้อง: เก็บ URL/bookingId สั้น ๆ แล้ว lookup จาก DB ในอนาคต
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
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
  const _API    = (window.API_BASE_URL || '').replace(/\/$/, '');
  const _TKEY   = window.AUTH_TOKEN_KEY || 'token';
  const _aH     = () => { const t=localStorage.getItem(_TKEY)||''; return t?{'Authorization':'Bearer '+t}:{}; };

  const BookingAPI = {
    async loadConfirmedBooking() {
      // อ่าน bookingId จาก URL หรือ localStorage
      const urlP = new URLSearchParams(window.location.search);
      const bid  = urlP.get("bookingId") || urlP.get("bid") || null;

      // ถ้ามี API และ bid ให้ดึงจาก server
      if (_API && bid) {
        try {
          const res = await fetch(`${_API}/api/bookings/${bid}`, { headers: _aH() });
          if (res.ok) {
            const json = await res.json();
            // server ส่ง { success, message, data, ...data } ใช้ json.data หรือ json ตรง ๆ
            const d = json.data || json;
            return {
              bookingId:    String(d.booking_no || d.booking_id || bid),
              status:       d.status || 'waiting',
              shopName:     d.farmer ? `${d.farmer.first_name} ${d.farmer.last_name}`.trim() : '',
              fullName:     d.buyer  ? `${d.buyer.first_name} ${d.buyer.last_name}`.trim()   : '',
              phone:        d.farmer?.phone || '',
              address:      d.address || '',
              queueNo:      d.queue_no || '',
              time:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '',
              date:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleDateString('th-TH') : '',
              productName:  d.product?.name || '',
              quantityKg:   0,
              vehicles:     Array.isArray(d.vehicles) ? d.vehicles : [],
              vehicleCount: d.vehicle_count || 0,
              slotName:     d.slot?.slot_name || '',
              mapLink:      d.farmer?.map_link || '',
            };
          }
        } catch(e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] loadConfirmedBooking:', e.message); }
      }

      // fallback: localStorage (ข้อมูลจาก step3)
      const local = localStorage.getItem("confirmedBooking");
      if (local) return JSON.parse(local);

      return null;
    },

    async saveConfirmedBooking(data) {
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus(bookingData) {
      // คำนวณจาก bookingData ที่ดึงมาแล้ว (ยังไม่มี realtime API)
      // currentQueue = "-" (ต้องการ API เพิ่มเติม)
      // waitingQueues = 0 (ไม่รู้คิวอื่น)
      return {
        currentQueue: "-",
        waitingQueues: 0,
        estimatedMinutes: 0,
        averageTimePerQueue: 0,
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
            return { success: true, message: "ยกเลิกการจองสำเร็จ" };
          }
          return { success: false, message: "ยกเลิกการจองไม่สำเร็จ" };
        } catch(e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] cancelBooking:', e.message); }
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

  function formatEstimatedTime(minutes) {
    if (minutes < 60) return `${minutes} นาที`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ชั่วโมง`;
    return `${hours} ชั่วโมง ${mins} นาที`;
  }

  function renderDetailPanel(bookingData) {
    return `
      <div><b>ร้าน:</b> ${shopName.textContent}</div>
      <div><b>ที่อยู่:</b> ${shopAddr.textContent}</div>
      <div><b>หมายเลขคิว:</b> ${bookingData.queueNo || bookingData.slotId || "-"}</div>
      <div><b>เวลานัดคิว:</b> ${timeText.textContent ? timeText.textContent + " น." : "-"}</div>
      <div><b>วันที่:</b> ${bookingData.dateFormatted || "-"}</div>
      <div><b>Booking ID:</b> ${bookingData.bookingId || "-"}</div>
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
    if (aheadCount) aheadCount.textContent = `${queueStatus.waitingQueues ?? 0} คิว`;
    if (eta) eta.textContent = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    // location - ถ้า bookingData มี shopName/address ให้ใช้ค่านั้น
    const locationData = bookingData.shopName ? bookingData : await BookingAPI.loadLocationData();
    if (shopName) shopName.textContent = locationData.shopName || locationData.name || "-";
    if (shopAddr) shopAddr.textContent = locationData.address || "-";
    if (btnOpenMap) btnOpenMap.dataset.mapsUrl = bookingData.mapLink || locationData.googleMapsUrl || "";

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
    toggleDetailBtn.textContent = isHidden ? "ซ่อนรายละเอียดการจอง" : "แสดงรายละเอียดการจอง";
  }

  async function handleCancelBooking() {
    const confirmed = await new Promise((resolve) => {
      const message = "คุณต้องการยกเลิกการจองหรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้";
      if (window.showConfirm) window.showConfirm(message, resolve);
      else resolve(window.confirm(message));
    });
    if (!confirmed) return;

    try {
      const bkId = (bookingIdText?.textContent || "").trim();
      if (!bkId || bkId === "-") {
        if (window.appNotify) window.appNotify("ไม่พบรหัสการจอง", "error");
        else alert("ไม่พบรหัสการจอง");
        return;
      }

      const result = await BookingAPI.cancelBooking(bkId);
      if (result?.success) {
        if (window.appNotify) window.appNotify("ยกเลิกการจองสำเร็จ", "success");
        else alert("ยกเลิกการจองสำเร็จ");

        const nextHref = resolveToRootUrl("pages/buyer/setbooking/booking.html?filter=cancel");
        if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
      } else {
        if (window.appNotify) window.appNotify("เกิดข้อผิดพลาดในการยกเลิกการจอง", "error");
        else alert("เกิดข้อผิดพลาดในการยกเลิกการจอง");
      }
    } catch (error) {
      console.error("Error canceling booking:", error);
      if (window.appNotify) window.appNotify("เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง", "error");
      else alert("เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง");
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    // กลับไปหน้าดูรายการจอง
    if (window.navigateWithTransition) window.navigateWithTransition(resolveToRootUrl("pages/setbooking/booking.html")); else window.location.href = resolveToRootUrl("pages/setbooking/booking.html");
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
      window.appNotify("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  init();
});
