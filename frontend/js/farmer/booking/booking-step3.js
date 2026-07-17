/**
 * AGRIPRICE - Booking Step 3 JavaScript
 * ฟีเจอร์: สรุปการจอง, โหลดข้อมูลจาก step 1-2, ยืนยันการจอง
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function getCurrentLocale() {
    const lang = localStorage.getItem('lang') || 'th';
    if (lang === 'en') return 'en-US';
    if (lang === 'zh') return 'zh-CN';
    return 'th-TH';
  }

  function formatDateLocale(date) {
    const locale = getCurrentLocale();
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date));
  }

  function toLocalDateValue(dateLike) {
    if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
      return dateLike;
    }
    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
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
  // DATABASE-READY API LAYER
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
      if (!window.api) throw new Error("API client not ready");
      try {
        // buyer_id = เจ้าของประกาศรับซื้อ (Buyer)
        const buyer_id = bookingData.buyer_id
          || localStorage.getItem('bookingBuyerId')
          || localStorage.getItem('bookingFarmerId')
          || null;
        let scheduled_time;
        try {
          if (bookingData.date && typeof bookingData.date === 'string') {
            let dateOnly = toLocalDateValue(bookingData.date);
            const rawTime = bookingData.timeSlot?.time || '08:00';
            const timeStart = rawTime.split('-')[0].trim();
            scheduled_time = new Date(dateOnly + 'T' + timeStart + ':00+07:00').toISOString();
          } else {
            scheduled_time = new Date().toISOString();
          }
        } catch (e) {
          scheduled_time = new Date().toISOString();
        }

        const rawSlotId = bookingData.slot_id ? String(bookingData.slot_id) : null;
        const finalSlotId = rawSlotId && !Number.isNaN(Number(rawSlotId)) ? Number(rawSlotId) : null;
        const offerId = bookingData.offer_id || bookingData.product_id || bookingData.timeSlot?.offer_id || bookingData.timeSlot?.product_id || null;

        const payload = {
          buyer_id,
          farmer_id: bookingData.farmer_id || null,
          offer_id: offerId ? String(offerId) : null,
          product_id: offerId ? String(offerId) : null,
          slot_id: finalSlotId,
          scheduled_time,
          note: bookingData.note || null,
          address: bookingData.address || '',
          contact_name: bookingData.contact?.name || '',
          contact_phone: bookingData.contact?.phone || '',
          product_amount: bookingData.productAmount || null,
          vehicle_plates: bookingData.vehicles?.map(v => v.plate).join(', ') || '',
        };

        const result = await window.api.createBooking(payload);
        
        const bkData   = result.data?.booking || result.data || result.booking || {};
        const q_no     = result.data?.queue_no || bkData.queue_no || result.queue_no || '';
        const bookingId = bkData.booking_no || String(bkData.booking_id || '') || null;
        
        const confirmed = { ...bookingData, bookingId, queue_no: q_no };
        localStorage.setItem('confirmedBooking', JSON.stringify(confirmed));
        return { success: true, bookingId, queue_no: q_no, message: t('booking_success', 'จองคิวสำเร็จ') };
      } catch (e) {
        console.error('[step3] confirmBooking API failed:', e.message);
        throw e;
      }
    },

    /**
     * สุ่มหมายเลขสล็อต (Slot ID)
     * @returns {Promise<String>}
     */
    async generateSlotId() {
      // server จะ generate queue_no เองตอน POST /api/bookings
      // ใช้ random เป็น placeholder ก่อน แล้วแทนด้วยค่าจริงหลัง confirm
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const letter = letters[Math.floor(Math.random() * letters.length)];
      const number = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
      return `${letter}-${number}`;
    }
  };

  // (thaiMonths removed in favor of formatDateLocale)

  // ================================
  // Utility Functions
  // ================================
  function formatThaiDate(isoString) {
    return formatDateLocale(isoString);
  }

  function formatNumber(num) {
    if (!num && num !== 0) return t('unspecified', "ไม่ระบุ");
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function resolveBookingAddress(step1Data, step2Data) {
    const profileAddress = [
      step2Data?.contact?.address,
      step2Data?.contact?.address_line1
    ].find(v => typeof v === "string" && v.trim());

    const step1Address = [
      step1Data?.address,
      step1Data?.address_line1,
      step1Data?.location?.address,
      step1Data?.mapAddress,
      step1Data?.map_link
    ].find(v => typeof v === "string" && v.trim());

    return (profileAddress || step1Address || step2Data?.contact?.name || "").trim();
  }


  // ================================
  // Render Vehicle List
  // ================================
  function renderVehicles(vehicles) {
    if (!vehicles || vehicles.length === 0) {
      vehicleList.innerHTML = `<p style="color: #999; text-align: center;">${t('no_vehicle_info', 'ไม่มีข้อมูลยานพาหนะ')}</p>`;
      vehicleCount.textContent = `0 ${t('unit_vehicle', 'คัน')}`;
      return;
    }

    vehicleList.innerHTML = "";

    vehicles.forEach((vehicle, idx) => {
      const vehicleItem = document.createElement("div");
      vehicleItem.className = "vehicle-item";

      vehicleItem.innerHTML = `
        <span class="material-icons-outlined vehicle-icon">local_shipping</span>
        <div class="vehicle-info">
          <div class="vehicle-title" data-i18n="vehicle_no" data-i18n-n="${idx + 1}">${t('vehicle_no', 'รถคันที่ {n}').replace('{n}', idx + 1)}</div>
          <div class="vehicle-detail">${vehicle.plate}</div>
        </div>
      `;

      vehicleList.appendChild(vehicleItem);
    });

    // Update vehicle count
    vehicleCount.textContent = `${vehicles.length} ${t('unit_vehicle', 'คัน')}`;
  }

  // ================================
  // Load Summary Data
  // ================================
  async function loadSummaryData() {
    const categoryImageMap = {
      'ทุเรียน': 'durian.png',
      'ลองกอง': 'longkong.png',
      'ลางสาด': 'longkong.png',
      'ลำไย': 'longan.png',
      'ลิ้นจี่': 'longan.png',
      'มังคุด': 'mangosteen.png',
      'เงาะ': 'rambutan.png',
      'ปาล์มน้ำมัน': 'oil-bottle.png',
      'น้ำมัน': 'oil-bottle.png',
      'ปาล์ม': 'palm.png',
      'ยางพารา': 'rubber.png',
      'ผักสด': 'fresh-vegetables.png',
      'ผัก': 'fresh-vegetables.png',
      'คะน้า': 'fresh-vegetables.png',
      'กวางตุ้ง': 'fresh-vegetables.png',
      'กะหล่ำ': 'fresh-vegetables.png',
      'บรอกโคลี': 'fresh-vegetables.png',
      'แตงกวา': 'fresh-vegetables.png',
      'ถั่วฝักยาว': 'fresh-vegetables.png',
      'ฟัก': 'fresh-vegetables.png',
      'มะเขือเทศ': 'fresh-vegetables.png',
      'แตงโม': 'watermelon.png',
      'เมลอน': 'fresh-vegetables.png',
      'แก้วมังกร': 'dragon-fruit.png',
      'สละ': 'fresh-vegetables.png',
      'ระกำ': 'fresh-vegetables.png',
      'องุ่น': 'grape.png',
      'สตรอว์เบอร์รี': 'strawberry.png',
      'เมล็ดพันธุ์': 'seedlings.png',
      'งา': 'seedlings.png',
      'ทานตะวัน': 'seedlings.png',
      'ละหุ่ง': 'seedlings.png',
      'เห็ด': 'mushroom.png',
      'ไม้ประดับ': 'ornamental-plants.png',
      'สมุนไพร': 'herbs.png',
      'ขิง': 'herbs.png',
      'ข่า': 'herbs.png',
      'ขมิ้น': 'herbs.png',
      'ตะไคร้': 'herbs.png',
      'โหระพา': 'herbs.png',
      'กะเพรา': 'herbs.png',
      'มะกรูด': 'herbs.png',
      'เตย': 'herbs.png',
      'กระชาย': 'herbs.png',
      'มะรุม': 'herbs.png',
      'กล้วย': 'banana.png',
      'มะม่วง': 'mango.png',
      'มะละกอ': 'papaya.png',
      'มันสำปะหลัง': 'cassava.png',
      'อ้อย': 'sugarcane.png',
      'สับปะรด': 'pineapple.png',
      'ขนุน': 'mango.png',
      'มะขาม': 'mango.png',
      'ละมุด': 'mango.png',
      'พลับ': 'mango.png',
      'มะพร้าว': 'coconut.png',
      'ลูกตาล': 'coconut.png',
      'สาเก': 'coconut.png',
      'ส้ม': 'orange.png',
      'มะนาว': 'lime.png',
      'ข้าวโพด': 'corn.png',
      'พริก': 'chili.png',
      'ข้าว': 'rice.png',
    };

    function getFallbackImage(productName, category) {
      const name = String(productName || '').trim();
      const cat = String(category || '').trim();
      for (const key of Object.keys(categoryImageMap)) {
        if (name.includes(key) || cat.includes(key)) {
          return '../../../assets/images/' + categoryImageMap[key];
        }
      }
      return null;
    }

    function resolveImageUrl(imagePath, productName, category) {
      const val = String(imagePath || '').trim();
      if (val) {
        if (/^(https?:\/\/|data:|blob:)/i.test(val)) return val;
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        if (val.startsWith('/uploads/') || val.startsWith('uploads/')) {
          const cleanPath = val.startsWith('/') ? val : '/' + val;
          return currentBase + cleanPath;
        }
      }
      return getFallbackImage(productName, category);
    }

    function getCategoryStyle(productName, category) {
      const name = String(productName || '').trim();
      const cat = String(category || '').trim();

      const categoryStyleMap = {
        'พืชผัก': { icon: 'spa', bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', color: '#2e7d32' },
        'ผัก': { icon: 'spa', bg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', color: '#2e7d32' },
        'พืชไร่': { icon: 'agriculture', bg: 'linear-gradient(135deg, #efebe9 0%, #d7ccc8 100%)', color: '#4e342e' },
        'พืชอุตสาหกรรม': { icon: 'precision_manufacturing', bg: 'linear-gradient(135deg, #eceff1 0%, #cfd8dc 100%)', color: '#37474f' },
        'ข้าว': { icon: 'grass', bg: 'linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)', color: '#f57f17' },
        'สมุนไพร': { icon: 'local_pharmacy', bg: 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)', color: '#00695c' },
        'เห็ด': { icon: 'wb_cloudy', bg: 'linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)', color: '#33691e' },
        'ผลไม้': { icon: 'eco', bg: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', color: '#e65100' },
      };

      for (const key of Object.keys(categoryStyleMap)) {
        if (name.includes(key) || cat.includes(key)) {
          return categoryStyleMap[key];
        }
      }
      return { icon: 'inventory_2', bg: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)', color: '#616161' };
    }

    try {
      // 🔘 โหลดข้อมูลผ่าน API Layer (รองรับ Database)
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;

      if (!step1Data || !step2Data) {
        throw new Error(t('no_booking_info', "ไม่พบข้อมูลการจอง"));
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
        summaryTime.textContent = `${step1Data.timeSlot.time} ${t('time_unit', 'น.')}`;
      }

      // หมายเลข slot — แสดงชื่อ slot จาก API (queue_no จะได้หลัง confirm)
      const slotLabel = step1Data.timeSlot?.slot_name || step1Data.timeSlot?.time || '-';
      if (summarySlot) summarySlot.textContent = slotLabel;

      // ================================
      // 2. ผลผลิต (Product Details)
      // ================================
      // Fetch real product details from API
      let productDetails = null;
      const stepOfferId = step1Data.offer_id || step1Data.product_id;
      if (stepOfferId && window.api) {
        try {
          const productRes = await window.api.getProduct(stepOfferId);
          productDetails = productRes?.data || productRes;
        } catch (e) {
          if (DEBUG_BOOKING) console.warn('[step3] Failed to fetch product details:', e.message);
        }
      }

      // Render product details
      let finalProductName = '-';
      let finalVarietyName = null;
      let finalCategoryName = '';
      let rawImage = '';

      if (productDetails) {
        finalProductName = productDetails.name || '-';
        finalVarietyName = productDetails.variety || null;
        finalCategoryName = productDetails.category || '';
        rawImage = productDetails.image || '';
      } else {
        finalProductName = step1Data.productName || '-';
        finalVarietyName = null;
        finalCategoryName = '';
        rawImage = '';
      }

      const resolvedImageUrl = resolveImageUrl(rawImage, finalProductName, finalCategoryName);

      if (productName) productName.textContent = finalProductName;

      const placeholderEl = document.getElementById("productIconPlaceholder");
      const placeholderIconEl = document.getElementById("productPlaceholderIcon");

      if (resolvedImageUrl) {
        if (productImg) {
          productImg.src = resolvedImageUrl;
          productImg.alt = finalProductName;
          productImg.style.display = "block";
        }
        if (placeholderEl) placeholderEl.style.display = "none";
      } else {
        if (productImg) productImg.style.display = "none";
        if (placeholderEl) {
          placeholderEl.style.display = "flex";
          const matchedStyle = getCategoryStyle(finalProductName, finalCategoryName);
          placeholderEl.style.background = matchedStyle.bg;
          placeholderEl.style.color = matchedStyle.color;
          if (placeholderIconEl) {
            placeholderIconEl.textContent = matchedStyle.icon;
          }
        }
      }

      // Show/Hide Variety Badge
      const varietyBadge = document.getElementById("productTypeBadge");
      if (varietyBadge) {
        if (finalVarietyName && finalVarietyName.trim() && finalVarietyName !== '-') {
          if (productType) productType.textContent = finalVarietyName;
          varietyBadge.style.display = "inline-flex";
        } else {
          varietyBadge.style.display = "none";
        }
      }

      // ชื่อล้ง/ผู้รับซื้อ จาก step1
      const farmerName = step1Data.farmerName
        || step1Data.sellerName
        || localStorage.getItem('bookingFarmerName')
        || t('shop', 'ร้านค้า');
      if (summaryProduct) summaryProduct.textContent = farmerName;

      // ✅ (Product rendered above in API block)
      // น้ำหนัก
      if (step2Data.productAmount) {
        summaryWeight.textContent = formatNumber(step2Data.productAmount);
      } else {
        summaryWeight.textContent = t('unspecified', "ไม่ระบุ");
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

      if (summaryAddress) {
        const addressText = resolveBookingAddress(step1Data, step2Data);
        summaryAddress.textContent = addressText || t('unspecified_address', "ไม่ระบุที่อยู่");
      }

      if (DEBUG_BOOKING) console.log("🔍 โหลดข้อมูลสรุป:", { step1Data, step2Data });

    } catch (error) {
      console.error("Error loading summary data:", error);
      window.appNotify(t('error_occurred', "เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง"), "error");
    }
  }

  // ================================
  // Submit Confirmation
  // ================================
  async function confirmBooking() {
    // [FIXED] เอาหน้าต่างยืนยันออกตามความต้องการของผู้ใช้ เพื่อความรวดเร็ว
    try {
      // รวมข้อมูลทั้งหมด
      const bookingData = await BookingAPI.loadBookingSummary();
      const step1Data = bookingData.step1;
      const step2Data = bookingData.step2;
      const finalBookingData = {
        // จาก Step 1
        date:          step1Data.date,
        dateFormatted: step1Data.dateFormatted,
        timeSlot:      step1Data.timeSlot,
        slot_id:       step1Data.slot_id    || null,
        offer_id:      step1Data.offer_id   || step1Data.product_id || null,
        product_id:    step1Data.offer_id   || step1Data.product_id || null,
        buyer_id:      step1Data.buyer_id   || null,
        farmer_id:     step1Data.farmer_id  || (() => { try { return JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || 'null')?.id || null; } catch(_){return null;} })(),
        farmerName:    step1Data.farmerName || localStorage.getItem('bookingFarmerName') || '',
        productName:   step1Data.productName || '',

        // จาก Step 2
        vehicles:      (step2Data.vehicles || []).map(v => ({
            plate: v.plate,
            province: v.province || '',
            type: v.type || t('truck', 'รถบรรทุก')
        })),
        productAmount: step2Data.productAmount || null,
        contact:       step2Data.contact       || {},
        address:       resolveBookingAddress(step1Data, step2Data),

        // [FIX] ลบ status:"confirmed" ออก เพราะ Server กำหนด status='waiting' เสมอ
        // การระบุ "confirmed" ที่นี่ทำให้ Frontend logic สับสน
        confirmedAt:  new Date().toISOString(),
        userId:       (() => { try { return JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || 'null')?.id || null; } catch(_){return null;} })(),
        step: 3
      };

      // บันทึกผ่าน API Layer (รองรับ Database)
      const result = await BookingAPI.confirmBooking(finalBookingData);

      if (DEBUG_BOOKING) console.log("ยืนยันการจองสำเร็จ:", result);

      // ไปหน้าสำเร็จ (step 4)
      const bookingId = result.bookingId || result.booking?.id || "";
      const bookingQuery = bookingId ? `?bid=${encodeURIComponent(bookingId)}` : "";
      if (window.navigateWithTransition) window.navigateWithTransition("booking-step4.html" + bookingQuery); else window.location.href = "booking-step4.html" + bookingQuery;
    } catch (error) {
      console.error("Error confirming booking:", error);
      window.appNotify(error.message || t('error_occurred', "เกิดข้อผิดพลาดในการยืนยันการจอง"), "error");
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
    // ตรวจสอบว่ามีข้อมูลจาก step ก่อนหน้าหรือไม่
    const step1Data = localStorage.getItem("bookingStep1");
    const step2Data = localStorage.getItem("bookingStep2");

    if (!step1Data || !step2Data) {
      window.appNotify(t('complete_previous_steps', "กรุณากรอกข้อมูลจาก Step 1 และ Step 2 ก่อน"), "error");
      if (window.navigateWithTransition) window.navigateWithTransition("booking-step1.html"); else window.location.href = "booking-step1.html";
      return;
    }

    await loadSummaryData();
    if (DEBUG_BOOKING) console.log("Booking Step 3 initialized");
  }

  init();
});
