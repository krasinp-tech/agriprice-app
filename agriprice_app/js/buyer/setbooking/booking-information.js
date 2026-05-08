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
  // 🔵 MOCK DATA (รองรับ DB ในอนาคต)
  // ================================
  const MOCK_BOOKINGS = [
    {
    bookingId: "BK2602191266-E-844",
    status: "waiting",
    shopName: "นายหญิง นายแดง",
    fullName: "สิงคองพันธุ์ไทย นายแดง",
    phone: "081-234-5678",
    address: "ตำบลบางแก้ว อำเภอบางพลี จังหวัดชุมพร",
    queueNo: "E-844",
    time: "14:00",
    date: "26 กุมภาพันธ์ 2569",
    createdAt: "2026-02-19 10:00",
    productName: "ทุเรียน หมอนทอง",
    quantityKg: 8000,
    productType: "เกรด A",
    vehicles: [
      { slot: 1, plate: "กด5485", type: "รถบรรทุก 10ล้อ" },
      { slot: 2, plate: "กด5486", type: "รถบรรทุก 10ล้อ" },
    ],
    notes: "รับ 8,000 กก.",
  },
  {
    bookingId: "BK2602191267-E-845",
    status: "waiting",
    shopName: "พิมรี่พาย สายเขียว",
    fullName: "นายทองดี ใจงาม",
    phone: "089-555-0011",
    address: "ตำบลท่าช้าง อำเภอเมือง จังหวัดจันทบุรี",
    queueNo: "E-845",
    time: "14:30",
    date: "26 กุมภาพันธ์ 2569",
    createdAt: "2026-02-19 10:05",
    productName: "ทุเรียน ก้านยาว",
    quantityKg: 2500,
    productType: "เกรด B",
    vehicles: [
      { slot: 1, plate: "กข1234", type: "รถบรรทุก 6ล้อ" },
    ],
    notes: "รับ 2,500 กก.",
  },
  {
    bookingId: "BK2602191268-E-846",
    status: "waiting",
    shopName: "นางรจนา เงาะป่า",
    fullName: "นางสาวมะลิ ใจดี",
    phone: "082-777-3344",
    address: "ตำบลสวนใหม่ อำเภอบ้านสวน จังหวัดสุราษฎร์ธานี",
    queueNo: "E-846",
    time: "15:00",
    date: "26 กุมภาพันธ์ 2569",
    createdAt: "2026-02-19 10:10",
    productName: "ทุเรียน ชะนี",
    quantityKg: 1200,
    productType: "เกรด A",
    vehicles: [
      { slot: 1, plate: "กข5678", type: "รถตู้ 4ล้อ" },
    ],
    notes: "รับ 1,200 กก.",
  },
  {
    bookingId: "BK240115002",
    status: "waiting",
    shopName: "นายดำรงค์ สุพรรณ",
    address: "88/1 ถนนสายผลไม้ อ.เมือง จ.จันทบุรี 22000",
    queueNo: "B-012",
    time: "15:10",
    createdAt: "2026-02-12 14:05",
    vehicles: [
      { slot: 1, plate: "กค9456", type: "รถบรรทุก 10ล้อ" },
    ],
  },
  {
    bookingId: "BK240115003",
    status: "cancel",
    shopName: "คุณสมชาย นายสมหญิง",
    address: "77/7 อ.ท่าใหม่ จ.จันทบุรี 22120",
    queueNo: "C-003",
    time: "10:00",
    createdAt: "2026-02-11 09:12",
    vehicles: [
      { slot: 1, plate: "กง7890", type: "รถบรรทุก 6ล้อ" },
    ],
  },
  ];

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

      // ลองดึงจาก localStorage ก่อน
      const localData = localStorage.getItem("confirmedBooking");
      if (localData) {
        return JSON.parse(localData);
      }

      // ถ้าไม่มี ลองดึงจาก bookingId ใน URL query
      const urlParams = new URLSearchParams(window.location.search);
      const bookingId = urlParams.get("bookingId") || urlParams.get("bid");

      if (bookingId) {
        // ค้นหาจาก MOCK_BOOKINGS
        const found = MOCK_BOOKINGS.find((b) => b.bookingId === bookingId);
        if (found) {
          return found;
        }
      }

      return null;
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
      localStorage.removeItem("confirmedBooking");
      localStorage.removeItem("bookingSlotId");
      localStorage.removeItem("bookingStep1");
      localStorage.removeItem("bookingStep2");
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
  // Render Vehicles Information
  // ================================
  function renderVehicles(bookingData) {
    if (!bookingData.vehicles || !Array.isArray(bookingData.vehicles) || bookingData.vehicles.length === 0) {
      return;
    }

    const vehicles = bookingData.vehicles;
    if (vehicleCountTotal) vehicleCountTotal.textContent = vehicles.length;

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
  // QR Code (แก้ overflow + สแกนแล้วใช้ได้จริง)
  // ================================
  function buildQrPayload(bookingId) {
    // ✅ แนะนำให้ QR เป็น “URL สั้น” แล้วฝั่งปลายทางใช้ bookingId ไป lookup DB
    // สแกนแล้วเปิดหน้า step4 พร้อม bid (ตอนนี้ใช้ localStorage fallback ได้)
    const base =
      (window.location.origin || "") + resolveToRootUrl("pages/setbooking/Booking information.html");
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

    // slot - ใช้ queueNo จาก mock data, fallback ไป slotId หรือ localStorage
    const slot = bookingData.queueNo || bookingData.slotId || localStorage.getItem("bookingSlotId") || "";
    if (queueNo) queueNo.textContent = slot;
    if (myQueue) myQueue.textContent = slot;

    // time - ใช้ time จาก mock data
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

    // location - ถ้า bookingData มี shopName/address ให้ใช้ของเขา
    const locationData = bookingData.shopName ? bookingData : await BookingAPI.loadLocationData();
    if (shopName) shopName.textContent = locationData.shopName || locationData.name || "-";
    if (shopAddr) shopAddr.textContent = locationData.address || "-";
    if (btnOpenMap) btnOpenMap.dataset.mapsUrl = locationData.googleMapsUrl || "";

    // detail panel
    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);

    // Render vehicles information
    renderVehicles(bookingData);

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

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    // ✅ กลับไปหน้าดูรายการจอง
    window.location.href = resolveToRootUrl("pages/setbooking/booking.html");
  });

  toggleDetailBtn?.addEventListener("click", handleToggleDetail);

  // ================================
  // Initialize
  // ================================
  async function init() {
    const confirmedBooking = localStorage.getItem("confirmedBooking");
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get("bookingId") || urlParams.get("bid");

    // ถ้าไม่มี localStorage และ URL parameter ก็กลับไปหน้าจอง
    if (!confirmedBooking && !bookingId) {
      alert("ไม่พบข้อมูลการจอง กรุณากลับไปดูรายการจอง");
      window.location.href = resolveToRootUrl("pages/setbooking/booking.html");
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
