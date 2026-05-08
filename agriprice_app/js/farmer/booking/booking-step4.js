/**
 * AGRIPRICE - Booking Step 4 JavaScript
 * ฟีเจอร์: การจองสำเร็จ, QR Code, สถานะคิว, แผนที่, ยกเลิกการจอง
 * แนวทาง QR ที่ถูกต้อง: เก็บ URL/bookingId สั้น ๆ แล้ว lookup จาก DB ในอนาคต
 */

document.addEventListener("DOMContentLoaded", () => {
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack");
  const btnOpenMap = document.getElementById("openMapBtn");
  const btnCancelBooking = document.getElementById("btnCancelBooking");
  const toggleDetailBtn = document.getElementById("toggleDetailBtn");

  const queueNo = document.getElementById("queueNo");
  const timeText = document.getElementById("timeText");
  const bookingIdText = document.getElementById("bookingIdText");
  const currentQueue = document.getElementById("currentQueue");
  const myQueue = document.getElementById("myQueue");
  const aheadCount = document.getElementById("aheadCount");
  const eta = document.getElementById("eta");
  const shopName = document.getElementById("shopName");
  const shopAddr = document.getElementById("shopAddr");
  const detailPanel = document.getElementById("detailPanel");
  const qrCanvas = document.getElementById("qrCanvas");

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
  // 🔵 MOCK DATA (รองรับ DB ในอนาคต)
  // ================================
  const mockQueueData = {
    currentQueue: "A-001",
    waitingQueues: 2,
    estimatedMinutes: 60,
    averageTimePerQueue: 30,
  };

  const mockLocationData = {
    name: "สิงคองพันธุ์ไทย นายแดง",
    address: "ตลาดเสรีพร 2 อาคาร1 (ใต้) 123 ถนนหลังสวน อ.พระโขนง นนท 10110",
    lat: 13.7563,
    lng: 100.5018,
    googleMapsUrl: "https://maps.google.com/?q=13.7563,100.5018",
  };

  // ================================
  // 🔵 DATABASE-READY API LAYER
  // ================================
  const BookingAPI = {
    async loadConfirmedBooking() {
      // อนาคต: ดึงจาก backend ด้วย bookingId ที่มากับ query (?bid=...)
      // const bid = new URLSearchParams(location.search).get("bid");
      // const res = await fetch(`/api/bookings/${bid}`);
      // return await res.json();

      const data = localStorage.getItem("confirmedBooking");
      return data ? JSON.parse(data) : null;
    },

    async saveConfirmedBooking(data) {
      // อนาคต: POST/PUT ไป backend
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus() {
      // อนาคต: fetch('/api/queue/status?bookingId=...')
      return mockQueueData;
    },

    async loadLocationData() {
      // อนาคต: fetch('/api/locations/{id}')
      return mockLocationData;
    },

    async cancelBooking(bookingId) {
      // อนาคต: POST /api/booking/{bookingId}/cancel
      // สำหรับ mock: ลบ booking จาก storage และเปลี่ยนสถานะเป็น cancel ใน history
      localStorage.removeItem("confirmedBooking");
      localStorage.removeItem("bookingSlotId");
      localStorage.removeItem("bookingStep1");
      localStorage.removeItem("bookingStep2");
      try {
        if (typeof MOCK_BOOKINGS !== 'undefined' && Array.isArray(MOCK_BOOKINGS)) {
          const idx = MOCK_BOOKINGS.findIndex(b => b.bookingId === bookingId);
          if (idx !== -1) {
            // ✅ เปลี่ยนสถานะแทนการลบ เพื่อให้ยังเห็นในรายการ "ยกเลิก"
            MOCK_BOOKINGS[idx].status = "cancel";
          }
        }
      } catch (_){ }
      return { success: true, message: "ยกเลิกการจองสำเร็จ" };
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
    // ใส่ slotId ต่อท้ายเล็กน้อยเพื่อไม่ซ้ำง่าย (ยังคงสั้น)
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
      <div><b>หมายเลขคิว:</b> ${bookingData.slotId || "-"}</div>
      <div><b>เวลานัดคิว:</b> ${timeText.textContent ? timeText.textContent + " น." : "-"}</div>
      <div><b>วันที่:</b> ${bookingData.dateFormatted || "-"}</div>
      <div><b>Booking ID:</b> ${bookingData.bookingId || "-"}</div>
    `;
  }

  // ================================
  // QR Code (แก้ overflow + สแกนแล้วใช้ได้จริง)
  // ================================
  function buildQrPayload(bookingId) {
    // ✅ แนะนำให้ QR เป็น “URL สั้น” แล้วฝั่งปลายทางใช้ bookingId ไป lookup DB
    // สแกนแล้วเปิดหน้า step4 พร้อม bid (ตอนนี้ใช้ localStorage fallback ได้)
    const base =
      (window.location.origin || "") + resolveToRootUrl("pages/farmer/booking/booking-step4.html");
    return `${base}?bid=${encodeURIComponent(bookingId)}`;
  }

  function drawFallbackQR() {
    if (!qrCanvas) return;
    const ctx = qrCanvas.getContext("2d");
    ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    ctx.fillStyle = "#F0F0F0";
    ctx.fillRect(0, 0, 110, 110);
    ctx.fillStyle = "#666";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("QR", 55, 60);
  }

  function generateQRCode(text) {
    if (!qrCanvas) return;

    try {
      // ล้าง canvas ก่อน (กันซ้อน)
      const ctx = qrCanvas.getContext("2d");
      ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);

      // ✅ ลด correctLevel เป็น M (ความจุเพิ่มขึ้น + ยังทนพอ)
      // ✅ ใช้ payload สั้น (URL + bookingId) -> ไม่ overflow แน่นอน
      new QRCode(qrCanvas, {
        text: String(text || ""),
        width: 110,
        height: 110,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });

      console.log("✅ สร้าง QR Code:", text);
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

    // slot
    const slot = bookingData.slotId || localStorage.getItem("bookingSlotId") || "";
    if (queueNo) queueNo.textContent = slot;
    if (myQueue) myQueue.textContent = slot;

    // time
    if (bookingData.timeSlot && bookingData.timeSlot.time) {
      const startTime = bookingData.timeSlot.time.split("-")[0];
      if (timeText) timeText.textContent = startTime;
    }

    // bookingId (ต้องคงที่: ถ้ายังไม่มีให้สร้าง แล้ว save กลับ)
    let bkId = bookingData.bookingId;

    // รองรับกรณีสแกน QR เปิดกลับมา: อ่าน bid จาก query ก่อน
    const bidFromUrl = new URLSearchParams(window.location.search).get("bid");
    if (bidFromUrl) bkId = bidFromUrl;

    if (!bkId) {
      bkId = generateBookingId(slot);
    }

    // sync ลง data และ save (เพื่ออนาคต DB จะใช้ id นี้เป็น key)
    bookingData.bookingId = bkId;
    await BookingAPI.saveConfirmedBooking(bookingData);

    if (bookingIdText) bookingIdText.textContent = bkId;

    // QR: ใช้ URL สั้น
    const qrText = buildQrPayload(bkId);
    generateQRCode(qrText);

    // queue status
    const queueStatus = await BookingAPI.loadQueueStatus();
    if (currentQueue) currentQueue.textContent = queueStatus.currentQueue || "-";
    if (aheadCount) aheadCount.textContent = `${queueStatus.waitingQueues ?? 0} คิว`;
    if (eta) eta.textContent = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    // location
    const locationData = await BookingAPI.loadLocationData();
    if (shopName) shopName.textContent = locationData.name || "-";
    if (shopAddr) shopAddr.textContent = locationData.address || "-";
    if (btnOpenMap) btnOpenMap.dataset.mapsUrl = locationData.googleMapsUrl || "";

    // detail panel
    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);

    console.log("📥 โหลดข้อมูลสำเร็จ:", { bookingData, queueStatus, location: locationData });
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

  function handleOpenMap() {
    const mapsUrl = btnOpenMap?.dataset?.mapsUrl;
    if (mapsUrl) window.open(mapsUrl, "_blank");
    else alert("ไม่สามารถเปิดแผนที่ได้");
  }

  async function handleCancelBooking() {
    const confirmed = confirm(
      "คุณต้องการยกเลิกการจองหรือไม่?\n\n" + "การยกเลิกจะไม่สามารถย้อนกลับได้"
    );
    if (!confirmed) return;

    try {
      const bkId = bookingIdText?.textContent || "";
      
      // ✅ อ่าน fromList ก่อนเรียก cancelBooking (เพราะมันจะลบ localStorage ทิ้ง)
      let fromList = false;
      try {
        const bookingData = JSON.parse(localStorage.getItem("confirmedBooking") || "null");
        if (bookingData && bookingData.fromList) {
          fromList = true;
        }
      } catch (_){ }

      const result = await BookingAPI.cancelBooking(bkId);

      if (result.success) {
        alert("ยกเลิกการจองสำเร็จ");
        
        // ตัดสินใจ redirect ตาม fromList flag
        if (!fromList) {
          // มาจาก flow จองใหม่ (step1-step4) -> กลับหน้าหลัก
          window.location.href = resolveToRootUrl("index.html");
        } else {
          // มาจาก booking list -> กลับไป booking พร้อม filter cancel
          const ref = localStorage.getItem("bookingReferrer");
          if (ref && ref.includes("booking.html")) {
            window.location.href = ref.split("?")[0] + "?filter=cancel";
          } else {
            window.location.href = resolveToRootUrl("pages/farmer/booking/booking.html?filter=cancel");
          }
        }
      } else {
        alert("เกิดข้อผิดพลาดในการยกเลิกการจอง");
      }
    } catch (error) {
      console.error("Error canceling booking:", error);
      alert("เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง");
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    // ✅ กลับหน้าที่มาก่อนจริง (จากปุ่มจอง/จากหน้าอื่น)
    const ref = localStorage.getItem("bookingReferrer");
    if (ref) window.location.href = ref;
    else window.location.href = resolveToRootUrl("pages/farmer/booking/booking.html");
  });

  toggleDetailBtn?.addEventListener("click", handleToggleDetail);
  btnOpenMap?.addEventListener("click", handleOpenMap);
  btnCancelBooking?.addEventListener("click", handleCancelBooking);

  // ================================
  // Initialize
  // ================================
  async function init() {
    let confirmedBooking = localStorage.getItem("confirmedBooking");

    // ถ้ายังไม่มี แต่มี bookingId ใน query ให้ลองสร้างจาก mock หรือเพียงใส่ id เพื่อดีโม
    if (!confirmedBooking) {
      const bid = new URLSearchParams(window.location.search).get("bookingId") ||
                  new URLSearchParams(window.location.search).get("bid");
      if (bid) {
        console.log("[Step4] no confirmedBooking, but bookingId present", bid);
        // พยายามหาใน MOCK_BOOKINGS ถ้ามี
        const demo = (typeof MOCK_BOOKINGS !== 'undefined' ? MOCK_BOOKINGS : []).find(b => b.bookingId === bid);
        if (demo) {
          confirmedBooking = JSON.stringify(demo);
          localStorage.setItem("confirmedBooking", confirmedBooking);
        } else {
          // ถ้าไม่มีใน mock ก็สร้าง object ขั้นพื้นฐาน
          const obj = { bookingId: bid, slotId: "--", timeSlot: { time: "--" } };
          confirmedBooking = JSON.stringify(obj);
          localStorage.setItem("confirmedBooking", confirmedBooking);
        }
      }
    }

    if (!confirmedBooking) {
      alert("ไม่พบข้อมูลการจอง กรุณาทำการจองใหม่");
      window.location.href = resolveToRootUrl("pages/farmer/booking/booking-step1.html");
      return;
    }

    try {
      await loadSuccessData();
      console.log("🚀 Booking Step 4 initialized");
    } catch (err) {
      console.error("Error loading success data:", err);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง");
    }
  }

  init();
});
