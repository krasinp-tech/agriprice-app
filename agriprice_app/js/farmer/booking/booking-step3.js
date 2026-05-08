/**
 * AGRIPRICE - Booking Step 3 JavaScript
 * ฟีเจอร์: สรุปการจอง, โหลดข้อมูลจาก step 1-2, ยืนยันการจอง
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack");
  const btnSubmit = document.getElementById("btnSubmit");

  // Summary elements
  const summaryDate = document.getElementById("summaryDate");
  const summaryTime = document.getElementById("summaryTime");
  const summaryProduct = document.getElementById("summaryProduct");
  const summarySlot = document.getElementById("summarySlot");
  const summaryWeight = document.getElementById("summaryWeight");
  const productName = document.getElementById("productName");
  const productType = document.getElementById("productType");
  const productImg = document.getElementById("productImg");
  const vehicleCount = document.getElementById("vehicleCount");
  const vehicleList = document.getElementById("vehicleList");
  const summaryContactName = document.getElementById("summaryContactName");
  const summaryContactPhone = document.getElementById("summaryContactPhone");

  // ================================
  // 🔵 MOCK DATA - รองรับ Database ในอนาคต
  // ================================
  
  // TODO: Replace with API call to get product info
  const mockProductData = {
    name: "ทุเรียน หมอนทอง",
    type: "ประเภทการ",
    image: "../../assets/images/ทุเรียน.png",
    seller: "สิงคนท หลวงหลังสวน" // จาก Step 1
  };

  // ================================
  // 🔵 DATABASE-READY API LAYER
  // ================================
  const BookingAPI = {
    /**
     * โหลดข้อมูลสรุปการจองจาก Database
     * @returns {Promise<Object>}
     */
    async loadBookingSummary() {
      // TODO: Uncomment when backend is ready
      /*
      const response = await fetch('/api/booking/summary');
      return await response.json();
      */
      
      // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
      const step1 = localStorage.getItem("bookingStep1");
      const step2 = localStorage.getItem("bookingStep2");
      
      return {
        step1: step1 ? JSON.parse(step1) : null,
        step2: step2 ? JSON.parse(step2) : null
      };
    },

    /**
     * ยืนยันการจองและบันทึกลง Database
     * @param {Object} bookingData - ข้อมูลการจองทั้งหมด
     * @returns {Promise<Object>}
     */
    async confirmBooking(bookingData) {
      // TODO: Uncomment when backend is ready
      /*
      const response = await fetch('/api/booking/confirm', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(bookingData)
      });
      
      if (!response.ok) throw new Error('Failed to confirm booking');
      return await response.json();
      */
      
      // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
      localStorage.setItem("confirmedBooking", JSON.stringify(bookingData));
      
      return {
        success: true,
        bookingId: bookingData.slotId,
        message: "จองคิวสำเร็จ"
      };
    },

    /**
     * สุ่มหมายเลขสลอท (Slot ID)
     * @returns {Promise<String>}
     */
    async generateSlotId() {
      // TODO: Uncomment when backend is ready
      /*
      const response = await fetch('/api/booking/generate-slot');
      const data = await response.json();
      return data.slotId;
      */
      
      // 🔵 MOCK: สุ่มเลขเอง
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const letter = letters[Math.floor(Math.random() * letters.length)];
      const number = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
      return `${letter}-${number}`;
    }
  };

  // ================================
  // Thai Month Names
  // ================================
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  // ================================
  // Utility Functions
  // ================================
  function formatThaiDate(isoString) {
    const date = new Date(isoString);
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  }

  function formatNumber(num) {
    if (!num && num !== 0) return "ไม่ระบุ";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // ================================
  // Render Vehicle List
  // ================================
  function renderVehicles(vehicles) {
    if (!vehicles || vehicles.length === 0) {
      vehicleList.innerHTML = '<p style="color: #999; text-align: center;">ไม่มีข้อมูลยานพาหนะ</p>';
      vehicleCount.textContent = "0 คัน";
      return;
    }

    vehicleList.innerHTML = "";

    vehicles.forEach((vehicle) => {
      const vehicleItem = document.createElement("div");
      vehicleItem.className = "vehicle-item";

      vehicleItem.innerHTML = `
        <span class="material-icons-outlined vehicle-icon">local_shipping</span>
        <div class="vehicle-info">
          <div class="vehicle-title">รถคันที่ ${vehicle.vehicleNumber}</div>
          <div class="vehicle-detail">${vehicle.licensePlate}</div>
        </div>
      `;

      vehicleList.appendChild(vehicleItem);
    });

    // Update vehicle count
    vehicleCount.textContent = `${vehicles.length} คัน`;
  }

  // ================================
  // Load Summary Data
  // ================================
  async function loadSummaryData() {
    try {
      // 🔵 โหลดข้อมูลผ่าน API Layer (รองรับ Database)
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;

      if (!step1Data || !step2Data) {
        throw new Error("ไม่พบข้อมูลการจอง");
      }

      // ================================
      // 1. รายละเอียดคิว
      // ================================
      
      // วันที่
      if (step1Data.dateFormatted) {
        summaryDate.textContent = step1Data.dateFormatted;
      } else if (step1Data.date) {
        summaryDate.textContent = formatThaiDate(step1Data.date);
      }

      // เวลา
      if (step1Data.timeSlot && step1Data.timeSlot.time) {
        summaryTime.textContent = `${step1Data.timeSlot.time} น.`;
      }

      // สิ่งที่จองรับ (TODO: ดึงจาก product API)
      summaryProduct.textContent = mockProductData.seller;

      // หมายเลขสลอท
      const slotId = await BookingAPI.generateSlotId();
      summarySlot.textContent = slotId;
      localStorage.setItem("bookingSlotId", slotId);

      // ================================
      // 2. ผลผลิต
      // ================================
      
      // ชื่อผลผลิต (TODO: ดึงจาก product API)
      productName.textContent = mockProductData.name;
      
      // ประเภท (TODO: ดึงจาก product API)
      productType.textContent = mockProductData.type;
      
      // รูปภาพ (TODO: ดึงจาก product API)
      productImg.src = mockProductData.image;
      productImg.alt = mockProductData.name;

      // น้ำหนัก
      if (step2Data.productAmount) {
        summaryWeight.textContent = formatNumber(step2Data.productAmount);
      } else {
        summaryWeight.textContent = "ไม่ระบุ";
      }

      // ================================
      // 3. ยานพาหนะ
      // ================================
      if (step2Data.vehicles) {
        renderVehicles(step2Data.vehicles);
      }

      // ================================
      // 4. ข้อมูลติดต่อ
      // ================================
      if (step2Data.contact) {
        summaryContactName.textContent = step2Data.contact.name;
        summaryContactPhone.textContent = step2Data.contact.phone;
      }

      console.log("📥 โหลดข้อมูลสรุป:", { step1Data, step2Data, slotId });

    } catch (error) {
      console.error("Error loading summary data:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง");
    }
  }

  // ================================
  // Submit Confirmation
  // ================================
  async function confirmBooking() {
    const confirmed = confirm("ต้องการยืนยันการจองคิวหรือไม่?");
    
    if (!confirmed) {
      return;
    }

    try {
      // รวมข้อมูลทั้งหมด
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;
      const slotId = localStorage.getItem("bookingSlotId");

      const finalBookingData = {
        // จาก Step 1
        date: step1Data.date,
        dateFormatted: step1Data.dateFormatted,
        timeSlot: step1Data.timeSlot,
        
        // จาก Step 2
        vehicles: step2Data.vehicles,
        productAmount: step2Data.productAmount,
        contact: step2Data.contact,
        
        // เพิ่มเติม
        slotId: slotId,
        productInfo: mockProductData, // TODO: ดึงจาก product API
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        
        // Database fields (เตรียมไว้)
        userId: null, // TODO: ดึงจาก auth session
        sellerId: null, // TODO: ดึงจาก product data
        step: 3
      };

      // 🔵 บันทึกผ่าน API Layer (รองรับ Database)
      const result = await BookingAPI.confirmBooking(finalBookingData);

      console.log("✅ ยืนยันการจองสำเร็จ:", result);

      // ไปหน้าสำเร็จ (step 4)
      window.location.href = "booking-step4.html";

    } catch (error) {
      console.error("Error confirming booking:", error);
      alert("เกิดข้อผิดพลาดในการยืนยันการจอง กรุณาลองใหม่อีกครั้ง");
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    window.location.href = "booking-step2.html";
  });

  btnSubmit?.addEventListener("click", confirmBooking);

  // ================================
  // Initialize
  // ================================
  async function init() {
    // ตรวจสอบว่ามีข้อมูลจาก step ก่อนหน้าหรือไม่
    const step1Data = localStorage.getItem("bookingStep1");
    const step2Data = localStorage.getItem("bookingStep2");

    if (!step1Data || !step2Data) {
      alert("กรุณากรอกข้อมูลจาก Step 1 และ Step 2 ก่อน");
      window.location.href = "booking-step1.html";
      return;
    }

    await loadSummaryData();
    console.log("🚀 Booking Step 3 initialized");
  }

  init();
});