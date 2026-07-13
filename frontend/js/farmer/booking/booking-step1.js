/**
 * AGRIPRICE - Booking Step 1 JavaScript
 * ฟีเจอร์: ปฏิทินจริง, เลือกช่วงเวลา, บันทึก localStorage
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack");
  const btnSubmit = document.getElementById("btnSubmit");
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");
  const calendarMonth = document.getElementById("calendarMonth");
  const calendarDays = document.getElementById("calendarDays");
  const timeSlotsContainer = document.getElementById("timeSlotsContainer");

  // ================================
  // State
  // ================================
  let currentDate = new Date();
  let selectedDate = null;
  let selectedTimeSlot = null;
  let availableTimeSlots = []; // Fetched from API for selected day
  let monthSlots = []; // Fetched from API for entire month indicator dots

  function getStoredOfferId() {
    return localStorage.getItem('bookingOfferId') || localStorage.getItem('bookingProductId') || '';
  }

  function setStoredOfferId(id) {
    if (!id) return;
    localStorage.setItem('bookingOfferId', id);
    localStorage.setItem('bookingProductId', id);
  }

  function firstRelation(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function profileName(profile) {
    return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';
  }

  // ================================
  // API Functions
  // ================================
  async function fetchTimeSlots(date) {
    if (!date) return [];
    
    // [FIXED] Use centralized API client for robustness
    if (!window.api) {
      if (DEBUG_BOOKING) console.error('[booking-step1] window.api not ready');
      return [];
    }

  // uses global resolveUserId / resolveProfileId from utils/id-resolver.js

    const offerId = getStoredOfferId();
    const farmerId = localStorage.getItem('bookingFarmerId') || '';
    
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const params = { date: dateStr };
      if (offerId) {
        params.offer_id = offerId;
        params.product_id = offerId;
      }
      else if (farmerId) params.farmer_id = farmerId;

      const json = await window.api.getAllSlots(params);
      const slots = json.data || [];

      if (DEBUG_BOOKING) console.log('[booking-step1] Slots from API:', slots);

      return slots.filter(slot => {
        if (!slot.start_date || !slot.end_date) return true;
        const d = new Date(date);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return dStr >= slot.start_date && dStr <= slot.end_date;
      }).map((slot) => {
        const slotOfferId = slot.offer_id || slot.product_id;
        return {
          id:          slot.slot_id || slot.id,
          time:        `${(slot.time_start||'').slice(0,5)}-${(slot.time_end||'').slice(0,5)}`,
          available:   (slot.capacity || 0) - (slot.booked_count || 0),
          capacity:    slot.capacity || 0,
          offer_id:    slotOfferId,
          product_id:  slotOfferId,
          slot_name:   slot.slot_name || '',
          start_date:  slot.start_date,
          end_date:    slot.end_date,
          farmerName:  profileName(firstRelation(slot.buy_offers?.profiles) || firstRelation(slot.product?.profiles)),
          productName: slot.buy_offers?.name || slot.product?.name || '',
          buyer_id:    slot.buy_offers?.user_id || slot.product?.user_id || '',
          farmer_id:   farmerId,
        };
      });
    } catch (e) {
      if (DEBUG_BOOKING) console.error('[booking-step1] fetchTimeSlots failed:', e.message);
      return [];
    }
  }

  async function fetchMonthSlots() {
    if (!window.api) return;
    
    const offerId = getStoredOfferId();
    const farmerId = localStorage.getItem('bookingFarmerId') || '';
    
    try {
      // Fetch a wider range or just everything for this product/farmer to show dots
      const params = {};
      if (offerId) {
        params.offer_id = offerId;
        params.product_id = offerId;
      }
      else if (farmerId) params.farmer_id = farmerId;

      const json = await window.api.getAllSlots(params);
      monthSlots = json.data || [];
      if (DEBUG_BOOKING) console.log('[booking-step1] Month slots for dots:', monthSlots.length);
    } catch (e) {
      if (DEBUG_BOOKING) console.error('[booking-step1] fetchMonthSlots failed:', e.message);
    }
  }

  // ================================
  // Utility Functions
  // ================================
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

  function getMonthYearHeader(date) {
    const locale = getCurrentLocale();
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  }

  function formatDateLocale(date) {
    const locale = getCurrentLocale();
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function formatLocalDateValue(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isSameDay(date1, date2) {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  function isPastDate(date) {
    const today = new Date();
    const compareDate = new Date(date);
    
    // Set to start of day for accurate comparison
    today.setHours(0, 0, 0, 0);
    compareDate.setHours(0, 0, 0, 0);
    
    // [FIXED Bug7] ลบกฎ 14 วันออก — เกษตรกรควรจองล่วงหน้าได้ไม่จำกัด
    if (compareDate < today) return true;

    return false;
  }

  function isValidTimeSlot(date, timeRangeStr) {
    if (!date || !timeRangeStr) return false;
    const today = new Date();
    const isToday = isSameDay(date, today);
    if (!isToday) return true; 

    try {
      // หรือเปลี่ยนกฎเป็น: ถ้ายังไม่เลยเวลา "สิ้นสุด" ของรอบนั้น ก็ให้จองได้
      const startTimeStr = timeRangeStr.split('-')[0];
      const [hours, minutes] = startTimeStr.split(':').map(Number);
      
      const slotStartTime = new Date(today);
      slotStartTime.setHours(hours, minutes, 0, 0);

      // ยืดหยุ่น: จองได้ถ้าเวลาห่างไม่เกิน 2 ชม. (เผื่อเครื่องลูกค้านาฬิกาไม่ตรง)
      const bufferTime = new Date(today.getTime() - (2 * 60 * 60 * 1000));
      return slotStartTime >= bufferTime;
    } catch (e) {
      return true;
    }
  }

  // ================================
  // Calendar Rendering
  // ================================
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update month display
    calendarMonth.textContent = getMonthYearHeader(currentDate);

    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);

    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const daysInPrevMonth = prevLastDay.getDate();

    // Clear calendar days (keep weekday headers)
    const weekdayHeaders = calendarDays.querySelectorAll('.calendar-weekday');
    calendarDays.innerHTML = "";
    
    // Re-add weekday headers
    weekdayHeaders.forEach(header => {
      calendarDays.appendChild(header);
    });

    // Previous month's days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dayElement = createDayElement(day, "other-month");
      calendarDays.appendChild(dayElement);
    }

    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayElement = createDayElement(day, "", date);
      calendarDays.appendChild(dayElement);
    }

    // [FIXED Bug5] คำนวณ remaining cells แบบ dynamic แทนการ hardcode 49
    // เดิม: 49 - totalCells อาจเพิ่ม row เกินในบางเดือน (เช่น เดือนที่ขึ้นต้นวันอาทิตย์ + 31 วัน)
    // [FIXED Bug5] คำนวณ remaining cells แบบ dynamic
    const dayCellsAfterHeaders = calendarDays.children.length - 7;
    const remainder = dayCellsAfterHeaders % 7;
    const remainingCells = remainder === 0 ? 0 : 7 - remainder;
    for (let day = 1; day <= remainingCells; day++) {
      const dayElement = createDayElement(day, "other-month");
      calendarDays.appendChild(dayElement);
    }
  }

  function hasSlotsOnDate(date) {
    if (!date || !monthSlots.length) return false;
    const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    return monthSlots.some(slot => {
      // Check if date is within slot range
      if (slot.start_date && slot.end_date) {
        return dStr >= slot.start_date && dStr <= slot.end_date;
      }
      return false;
    });
  }

  function createDayElement(day, className = "", date = null) {
    const dayDiv = document.createElement("div");
    dayDiv.className = `calendar-day ${className}`;
    
    const dayText = document.createElement("span");
    dayText.textContent = day;
    dayDiv.appendChild(dayText);

    if (date) {
      const today = new Date();

      // Check if today
      if (isSameDay(date, today)) {
        dayDiv.classList.add("today");
      }

      // Check if past date (disable)
      if (isPastDate(date)) {
        dayDiv.classList.add("disabled");
      }

      // Check if selected
      if (selectedDate && isSameDay(date, selectedDate)) {
        dayDiv.classList.add("selected");
      }

      // Click handler
      if (!isPastDate(date)) {
        dayDiv.addEventListener("click", () => {
          selectDate(date);
        });

        // Add green dot if has slots
        if (hasSlotsOnDate(date)) {
          const dot = document.createElement("div");
          dot.className = "has-slots-dot";
          dayDiv.appendChild(dot);
        }
      }
    }

    return dayDiv;
  }

  function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    renderTimeSlots();
    checkSubmitButton();
  }

  // ================================
  // Time Slots Rendering
  // ================================
  async function renderTimeSlots() {
    timeSlotsContainer.innerHTML = "";

    if (!selectedDate) {
      timeSlotsContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #999;">
          ${t('please_select_date_first', 'กรุณาเลือกวันที่ก่อน')}
        </div>
      `;
      return;
    }

    // Show loading state
    timeSlotsContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #999;">
        ${t('loading_time_slots', 'กำลังโหลดช่วงเวลา...')}
      </div>
    `;

    // Fetch available time slots for the selected date
    availableTimeSlots = await fetchTimeSlots(selectedDate);

    // Clear loading and render slots
    timeSlotsContainer.innerHTML = "";
    
    if (availableTimeSlots.length === 0) {
      selectedTimeSlot = null;
      checkSubmitButton();
      timeSlotsContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #999;">
          ${t('no_time_slots', 'No time slots available for the selected date')}
        </div>
      `;
      return;
    }

    availableTimeSlots.forEach((slot) => {
      const slotElement = createTimeSlotElement(slot);
      timeSlotsContainer.appendChild(slotElement);
    });
  }

  function createTimeSlotElement(slot) {
    const slotDiv = document.createElement("div");
    slotDiv.className = "timeslot";

    const isExpired = !isValidTimeSlot(selectedDate, slot.time);
    const isFull = slot.available === 0 || isExpired;
    const isSelected = selectedTimeSlot && selectedTimeSlot.id === slot.id;

    if (isFull) {
      slotDiv.classList.add("disabled");
    }

    if (isSelected && !isFull) {
      slotDiv.classList.add("selected");
    } else if (isSelected && isFull) {
      // Deselect if it just became invalid
      selectedTimeSlot = null;
      checkSubmitButton();
    }

    const timeDiv = document.createElement("div");
    timeDiv.className = "timeslot-time";
    timeDiv.textContent = slot.time;

    const statusDiv = document.createElement("div");
    statusDiv.className = `timeslot-status ${isFull ? 'full' : 'available'}`;

    if (isFull) {
      statusDiv.innerHTML = `
        <span class="timeslot-badge full">${t('full', 'เต็ม')}</span>
      `;
    } else {
      statusDiv.textContent = t('remaining_queues', 'เหลือ {n} คิว').replace('{n}', slot.available);
    }

    slotDiv.appendChild(timeDiv);
    slotDiv.appendChild(statusDiv);

    if (!isFull) {
      slotDiv.addEventListener("click", () => {
        selectTimeSlot(slot);
      });
    }

    return slotDiv;
  }

  function selectTimeSlot(slot) {
    selectedTimeSlot = slot;
    renderTimeSlots();
    checkSubmitButton();
  }

  // ================================
  // Submit Button State
  // ================================
  function checkSubmitButton() {
    if (selectedDate && selectedTimeSlot) {
      btnSubmit.disabled = false;
    } else {
      btnSubmit.disabled = true;
    }
  }

  // ================================
  // Navigation
  // ================================
  prevMonth.addEventListener("click", async () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    await fetchMonthSlots();
    renderCalendar();
  });

  nextMonth.addEventListener("click", async () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    await fetchMonthSlots();
    renderCalendar();
  });

  // ================================
  // Back Button - จำหน้าที่มาจากไหน
  // ================================
  btnBack.addEventListener("click", () => {
    const referrer = localStorage.getItem("bookingReferrer") || "../../index.html";
    if (window.navigateWithTransition) window.navigateWithTransition(referrer); else window.location.href = referrer;
  });

  // ================================
  // Submit - บันทึกข้อมูลและไปหน้าถัดไป
  // ================================
  btnSubmit.addEventListener("click", () => {
    if (!selectedDate || !selectedTimeSlot) return;

    // บันทึกข้อมูลลง localStorage
    const bookingData = {
      date:          formatLocalDateValue(selectedDate),
      dateFormatted: formatDateLocale(selectedDate),
      timeSlot:      selectedTimeSlot,
      slot_id:       selectedTimeSlot.id,
      offer_id:      selectedTimeSlot.offer_id || selectedTimeSlot.product_id || null,
      product_id:    selectedTimeSlot.offer_id || selectedTimeSlot.product_id || null,
      farmerName:    selectedTimeSlot.farmerName || localStorage.getItem('bookingFarmerName') || '',
      productName:   selectedTimeSlot.productName || '',
      step: 1,
      timestamp: new Date().toISOString()
    };

    // [FIXED Bug4] buyer_id = Buyer (ล้ง) เจ้าของ product slot
    // ใช้ buyer_id ที่ map ไว้ถูกต้องแล้ว (slot.product.user_id) ไม่ใช่ farmer_id ที่ตั้งชื่อผิด
    const buyerId = selectedTimeSlot.buyer_id || localStorage.getItem('bookingBuyerId') || localStorage.getItem('bookingFarmerId') || null;
    bookingData.buyer_id = buyerId;

    // farmer_id = เกษตรกรที่ login อยู่
    try {
      const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || 'null');
      bookingData.farmer_id = resolveUserId(u?.profile_id, u?.id);
    } catch (_) {}

    localStorage.setItem("bookingStep1", JSON.stringify(bookingData));

    // รวมข้อมูลทั้งหมด
    const existingData = JSON.parse(localStorage.getItem("bookingData") || "{}");
    const updatedData = {
      ...existingData,
      ...bookingData
    };
    localStorage.setItem("bookingData", JSON.stringify(updatedData));

    if (DEBUG_BOOKING) console.log("บันทึกข้อมูล Step 1:", bookingData);

    // ไปหน้าถัดไป
    if (window.navigateWithTransition) window.navigateWithTransition("booking-step2.html"); else window.location.href = "booking-step2.html";
  });

  // ================================
  // Load Previous Data (ถ้ามี)
  // ================================
  function loadPreviousData() {
    const savedData = localStorage.getItem("bookingStep1");
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        
        // Restore selected date
        if (data.date) {
          selectedDate = new Date(data.date);
          currentDate = new Date(selectedDate);
        }

        // Restore selected time slot
        if (data.timeSlot && data.timeSlot.id !== 'fallback_any_time') {
          selectedTimeSlot = data.timeSlot;
        }

        if (DEBUG_BOOKING) console.log("โหลดข้อมูลเดิม:", data);
      } catch (e) {
        console.error("Error loading previous data:", e);
      }
    }
  }

  // ================================
  // Load Header Info from referrer
  // ================================
  function loadHeaderInfo() {
    const params = new URLSearchParams(window.location.search);
    const sellerName = params.get("seller");
    const productName = params.get("product");

    const headerTitle = document.getElementById("headerTitle");
    if (headerTitle) {
      const name = sellerName
        || localStorage.getItem("bookingFarmerName")
        || "";
      if (name) headerTitle.textContent = name;
    }

    // ดึง avatar ของ farmer มาแสดงแทนรูปค่าเริ่มต้น
    const productIcon = document.getElementById("productIcon");
    if (productIcon) {
      const farmerId = localStorage.getItem("bookingFarmerId") || "";
      const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, "");
      const TOKEN_KEY = window.AUTH_TOKEN_KEY || "token";
      const token     = localStorage.getItem(TOKEN_KEY) || "";

      // [FIX] เพิ่มตัวตรวจจับรูปเสีย
      productIcon.onerror = function() {
        if (this.dataset.fallbackApplied) return;
        this.dataset.fallbackApplied = "true";
        this.style.display = "none";
        const name = headerTitle?.textContent || "P";
        const parent = this.parentElement;
        if (parent) {
          const fallback = document.createElement("div");
          fallback.textContent = name.trim().charAt(0).toUpperCase();
          fallback.className = "avatar-fallback"; // ใช้ CSS class หรือ inline style
          fallback.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;background:linear-gradient(135deg, #0B853C, #22c55e);border-radius:inherit;";
          parent.appendChild(fallback);
        }
      };

      if (farmerId && window.api) {
        window.api.getProfileById(farmerId)
          .then(profile => {
            if (profile && profile.avatar) {
              const currentBase = window.api.getBase();
              let avatarUrl = profile.avatar;
              if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
                avatarUrl = currentBase + (avatarUrl.startsWith('/') ? '' : '/') + avatarUrl;
              }
              productIcon.src = avatarUrl;
              productIcon.alt = profile.first_name || t('farmer', 'เกษตรกร');
            } else {
              productIcon.onerror(); 
            }
          })
          .catch(() => {
            productIcon.onerror();
          });
      }
    }
  }

  // ================================
  // Initialize
  // ================================
  async function init() {
    // Parse query params first to sync URL state with localStorage
    const params = new URLSearchParams(window.location.search);
    const urlOfferId = params.get("offer_id") || params.get("offerId") || params.get("product_id") || params.get("productId");
    const urlFarmerId = params.get("farmer_id") || params.get("farmerId") || params.get("uid") || params.get("seller_id");
    const urlFarmerName = params.get("seller") || params.get("farmerName");
    const urlProductName = params.get("product") || params.get("productName");

    if (urlOfferId) {
      setStoredOfferId(urlOfferId);
    }
    if (urlFarmerId) {
      localStorage.setItem('bookingFarmerId', urlFarmerId);
    }
    if (urlFarmerName) {
      localStorage.setItem('bookingFarmerName', urlFarmerName);
    }
    if (urlProductName) {
      localStorage.setItem('bookingProductName', urlProductName);
    }

    // If offer_id is specified in URL, fetch additional info from database
    if (urlOfferId && window.api) {
      try {
        const res = await window.api.getProduct(urlOfferId);
        const product = res.data || res;
        if (product) {
          localStorage.setItem('bookingProductName', product.name || '');
          if (product.user_id) {
            localStorage.setItem('bookingFarmerId', product.user_id);
          }
          const ownerProfile = firstRelation(product.profiles) || firstRelation(product.user?.profiles);
          if (ownerProfile) {
            const name = profileName(ownerProfile);
            localStorage.setItem('bookingFarmerName', name);
          }
        }
      } catch (e) {
        if (DEBUG_BOOKING) console.error('[booking-step1] failed to fetch product info:', e);
      }
    }

    loadHeaderInfo();
    loadPreviousData();
    await fetchMonthSlots();
    renderCalendar();
    renderTimeSlots();
    checkSubmitButton();
  }

  init();

  // ================================
  // Utility: Save referrer when booking from any page
  // ================================
  window.saveBookingReferrer = function(referrerUrl) {
    localStorage.setItem("bookingReferrer", referrerUrl);
  };
});
