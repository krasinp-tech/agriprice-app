/**
 * AGRIPRICE - Booking Step 3 JavaScript
 * เธเธตเน€เธเธญเธฃเน: เธชเธฃเธธเธเธเธฒเธฃเธเธญเธ, เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธฒเธ step 1-2, เธขเธทเธเธขเธฑเธเธเธฒเธฃเธเธญเธ
 * เธฃเธญเธเธฃเธฑเธ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
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
  const summaryAddress = document.getElementById("summaryAddress");

  // ================================
  // ๐”ต DATABASE-READY API LAYER
  // 🔘 DATABASE-READY API LAYER
  // ================================
  const BookingAPI = {
    /**
     * โหลดข้อมูลสรุปการจองจาก Database
     * @returns {Promise<Object>}
     */
    async loadBookingSummary() {
      // อ่านจาก localStorage — ข้อมูลถูกบันทึกไว้จาก step1 และ step2
      const step1 = localStorage.getItem("bookingStep1");
      const step2 = localStorage.getItem("bookingStep2");
      return {
        step1: step1 ? JSON.parse(step1) : null,
        step2: step2 ? JSON.parse(step2) : null,
      };
    },

    async confirmBooking(bookingData) {
      const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
      const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
      const token     = localStorage.getItem(TOKEN_KEY) || '';

      if (API_BASE && token) {
        try {
          const buyer_id = bookingData.buyer_id || localStorage.getItem('bookingFarmerId') || null;
          let scheduled_time;
          try {
            if (bookingData.date && typeof bookingData.date === 'string') {
              let dateOnly = bookingData.date.includes('T') ? bookingData.date.split('T')[0] : bookingData.date;
              const rawTime = bookingData.timeSlot?.time || '08:00';
              const timeStart = rawTime.split('-')[0].trim();
              scheduled_time = new Date(dateOnly + 'T' + timeStart + ':00').toISOString();
            } else {
              scheduled_time = new Date().toISOString();
            }
          } catch (e) {
            scheduled_time = new Date().toISOString();
          }

          const payload = {
            buyer_id,
            farmer_id: bookingData.farmer_id || null,
            product_id: bookingData.product_id ? String(bookingData.product_id) : null,
            slot_id: bookingData.slot_id ? String(bookingData.slot_id) : null,
            scheduled_time,
            note: bookingData.note || null,
            address: bookingData.address || '',
            contact_name: bookingData.contact?.name || '',
            contact_phone: bookingData.contact?.phone || '',
            product_amount: bookingData.productAmount || null,
            vehicle_plates: bookingData.vehicles?.map(v => v.plate).join(', ') || '',
          };

          const res = await fetch(API_BASE + '/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload),
          });

          const result = await res.json().catch(() => ({}));

          if (!res.ok) {
            const errMsg = result.message || result.error || 'ยืนยันการจองไม่สำเร็จ';
            throw new Error(errMsg);
          }

          const bkData   = result.data?.booking || result.data || result.booking || {};
          const q_no     = result.data?.queue_no || result.queue_no || '';
          const bookingId = bkData.booking_no || String(bkData.booking_id || '') || null;
          
          const confirmed = { ...bookingData, bookingId, queue_no: q_no };
          localStorage.setItem('confirmedBooking', JSON.stringify(confirmed));
          return { success: true, bookingId, queue_no, message: 'จองคิวสำเร็จ' };
        } catch (e) {
          console.error('[step3] confirmBooking API failed:', e.message);
          throw e;
        }
      }

      // fallback mock (เธ–เนเธฒเนเธกเนเธกเธต API เธซเธฃเธทเธญเนเธกเนเนเธ”เน login)
      localStorage.setItem('confirmedBooking', JSON.stringify(bookingData));
      return { success: true, bookingId: bookingData.bookingId || bookingData.queue_no || bookingData.slotId || null, message: 'จองคิวสำเร็จ' };
    },

    /**
     * เธชเธธเนเธกเธซเธกเธฒเธขเน€เธฅเธเธชเธฅเธญเธ— (Slot ID)
     * @returns {Promise<String>}
     */
    async generateSlotId() {
      // server เธเธฐ generate queue_no เน€เธญเธเธ•เธญเธ POST /api/bookings
      // เนเธเน random เน€เธเนเธ placeholder เธเนเธญเธ เนเธฅเนเธงเนเธ—เธเธ”เนเธงเธขเธเนเธฒเธเธฃเธดเธเธซเธฅเธฑเธ confirm
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

  function resolveBookingAddress(step1Data, step2Data) {
    const step1Address = [
      step1Data?.address,
      step1Data?.address_line1,
      step1Data?.location?.address,
      step1Data?.mapAddress,
      step1Data?.map_link
    ].find(v => typeof v === "string" && v.trim());

    const profileAddress = [
      step2Data?.contact?.address,
      step2Data?.contact?.address_line1
    ].find(v => typeof v === "string" && v.trim());

    return (step1Address || profileAddress || step2Data?.contact?.name || "").trim();
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

    vehicles.forEach((vehicle, idx) => {
      const vehicleItem = document.createElement("div");
      vehicleItem.className = "vehicle-item";

      vehicleItem.innerHTML = `
        <span class="material-icons-outlined vehicle-icon">local_shipping</span>
        <div class="vehicle-info">
          <div class="vehicle-title">รถคันที่ ${idx + 1}</div>
          <div class="vehicle-detail">${vehicle.plate}</div>
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
      // ๐”ต เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเนเธฒเธ API Layer (เธฃเธญเธเธฃเธฑเธ Database)
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;

      if (!step1Data || !step2Data) {
        throw new Error("ไม่พบข้อมูลการจอง");
      }

      // ================================
      // 1. เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธดเธง
      // ================================

      // เธงเธฑเธเธ—เธตเน
      if (step1Data.dateFormatted) {
        summaryDate.textContent = step1Data.dateFormatted;
      } else if (step1Data.date) {
        summaryDate.textContent = formatThaiDate(step1Data.date);
      }

      // เน€เธงเธฅเธฒ
      if (step1Data.timeSlot && step1Data.timeSlot.time) {
        summaryTime.textContent = `${step1Data.timeSlot.time} น.`;
      }

      // เธซเธกเธฒเธขเน€เธฅเธ slot โ€” เนเธชเธ”เธเธเธทเนเธญ slot เธเธฒเธ API (queue_no เธเธฐเนเธ”เนเธซเธฅเธฑเธ confirm)
      const slotLabel = step1Data.timeSlot?.slot_name || step1Data.timeSlot?.time || '-';
      if (summarySlot) summarySlot.textContent = slotLabel;

      // ================================
      // 2. เธเธฅเธเธฅเธดเธ• (Product Details)
      // ================================
      // Fetch real product details from API
      let productDetails = null;
      if (step1Data.product_id) {
        try {
          const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
          const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
          const token = localStorage.getItem(TOKEN_KEY) || '';
          const res = await fetch(`${API_BASE}/api/products/${step1Data.product_id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (res.ok) {
            const json = await res.json();
            productDetails = json.data || null;
          }
        } catch (e) {
          if (DEBUG_BOOKING) console.warn('[step3] Failed to fetch product details:', e.message);
        }
      }

      // Render product details
      if (productDetails) {
        // Product name
        if (productName) productName.textContent = productDetails.name || '-';
        // Product type
        if (productType) productType.textContent = productDetails.type || '-';
        // Product image
        if (productImg) {
          productImg.src = productDetails.image_url || '../../../assets/images/durian.png';
          productImg.alt = productDetails.name || 'ผลผลิต';
        }
        // Weight
        if (summaryWeight) summaryWeight.textContent = step2Data.productAmount || '-';
      } else {
        // Fallback to step1/localStorage
        if (productName) productName.textContent = step1Data.productName || '-';
        if (productType) productType.textContent = '-';
        if (productImg) {
          productImg.src = '../../../assets/images/durian.png';
          productImg.alt = step1Data.productName || 'ผลผลิต';
        }
        if (summaryWeight) summaryWeight.textContent = step2Data.productAmount || '-';
      }

      // เธเธทเนเธญเธฅเนเธ/เธเธนเนเธฃเธฑเธเธเธทเนเธญ เธเธฒเธ step1
      const farmerName = step1Data.farmerName
        || step1Data.sellerName
        || localStorage.getItem('bookingFarmerName')
        || 'ร้านค้า';
      if (summaryProduct) summaryProduct.textContent = farmerName;

      // ================================
      // 2. เธเธฅเธเธฅเธดเธ•
      // ================================
      
      if (productName) productName.textContent = step2Data?.productName || step1Data?.productName || 'ผลผลิต';
      
      if (productType) productType.textContent = step1Data?.variety || step1Data?.productType || '';
      
      if (productImg) { productImg.src = step1Data?.productImage || '../../../assets/images/durian.png'; productImg.alt = step1Data?.productName || ''; }

      // เธเนเธณเธซเธเธฑเธ
      if (step2Data.productAmount) {
        summaryWeight.textContent = formatNumber(step2Data.productAmount);
      } else {
        summaryWeight.textContent = "ไม่ระบุ";
      }

      // ================================
      // 3. เธขเธฒเธเธเธฒเธซเธเธฐ
      // ================================
      if (step2Data.vehicles) {
        renderVehicles(step2Data.vehicles);
      }

      // ================================
      // 4. เธเนเธญเธกเธนเธฅเธ•เธดเธ”เธ•เนเธญ
      // ================================
      if (step2Data.contact) {
        summaryContactName.textContent = step2Data.contact.name;
        summaryContactPhone.textContent = step2Data.contact.phone;
      }

      if (summaryAddress) {
        const addressText = resolveBookingAddress(step1Data, step2Data);
        summaryAddress.textContent = addressText || "ไม่ระบุที่อยู่";
      }

      if (DEBUG_BOOKING) console.log("๐“ฅ เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธชเธฃเธธเธ:", { step1Data, step2Data });

    } catch (error) {
      console.error("Error loading summary data:", error);
      window.appNotify("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  // ================================
  // Submit Confirmation
  // ================================
  async function confirmBooking() {
    const confirmed = await new Promise((resolve) => {
      if (window.showConfirm) window.showConfirm("ต้องการยืนยันการจองคิวหรือไม่?", resolve);
      else resolve(false);
    });

    if (!confirmed) return;

    try {
      // เธฃเธงเธกเธเนเธญเธกเธนเธฅเธ—เธฑเนเธเธซเธกเธ”
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;
      const finalBookingData = {
        // เธเธฒเธ Step 1
        date:          step1Data.date,
        dateFormatted: step1Data.dateFormatted,
        timeSlot:      step1Data.timeSlot,
        slot_id:       step1Data.slot_id    || null,
        product_id:    step1Data.product_id || null,
        buyer_id:      step1Data.buyer_id   || null,
        farmer_id:     step1Data.farmer_id  || (() => { try { return JSON.parse(localStorage.getItem(window.AUTH_USER_KEY||'user')||'null')?.id||null; } catch(_){return null;} })(),
        farmerName:    step1Data.farmerName || localStorage.getItem('bookingFarmerName') || '',
        productName:   step1Data.productName || '',

        // เธเธฒเธ Step 2
        vehicles:      step2Data.vehicles      || [],
        productAmount: step2Data.productAmount || null,
        contact:       step2Data.contact       || {},
        address:       resolveBookingAddress(step1Data, step2Data),

        status:       "confirmed",
        confirmedAt:  new Date().toISOString(),
        userId:       (() => { try { return JSON.parse(localStorage.getItem(window.AUTH_USER_KEY||'user')||'null')?.id||null; } catch(_){return null;} })(),
        step: 3
      };

      // ๐”ต เธเธฑเธเธ—เธถเธเธเนเธฒเธ API Layer (เธฃเธญเธเธฃเธฑเธ Database)
      const result = await BookingAPI.confirmBooking(finalBookingData);

      if (DEBUG_BOOKING) console.log("โ… เธขเธทเธเธขเธฑเธเธเธฒเธฃเธเธญเธเธชเธณเน€เธฃเนเธ:", result);

      // เนเธเธซเธเนเธฒเธชเธณเน€เธฃเนเธ (step 4)
      const bookingId = result.bookingId || result.booking?.id || "";
      if (window.navigateWithTransition) window.navigateWithTransition("booking-step4.html" + (bookingId ? `?bid=${bookingId}` : "")); else window.location.href = "booking-step4.html" + (bookingId ? `?bid=${bookingId}` : "");
    } catch (error) {
      console.error("Error confirming booking:", error);
      window.appNotify("เกิดข้อผิดพลาดในการยืนยันการจอง กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    if (window.navigateWithTransition) window.navigateWithTransition("booking-step2.html"); else window.location.href = "booking-step2.html";
  });

  btnSubmit?.addEventListener("click", confirmBooking);

  // ================================
  // Initialize
  // ================================
  async function init() {
    // เธ•เธฃเธงเธเธชเธญเธเธงเนเธฒเธกเธตเธเนเธญเธกเธนเธฅเธเธฒเธ step เธเนเธญเธเธซเธเนเธฒเธซเธฃเธทเธญเนเธกเน
    const step1Data = localStorage.getItem("bookingStep1");
    const step2Data = localStorage.getItem("bookingStep2");

    if (!step1Data || !step2Data) {
      window.appNotify("กรุณากรอกข้อมูลจาก Step 1 และ Step 2 ก่อน", "error");
      if (window.navigateWithTransition) window.navigateWithTransition("booking-step1.html"); else window.location.href = "booking-step1.html";
      return;
    }

    await loadSummaryData();
    if (DEBUG_BOOKING) console.log("๐€ Booking Step 3 initialized");
  }

  init();
});
