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
  let availableTimeSlots = []; // Fetched from API

  // ================================
  // API Functions
  // ================================
  async function fetchTimeSlots(date) {
    if (!date) return [];

    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
    const token = localStorage.getItem(TOKEN_KEY) || '';

    if (!API_BASE || !token) {
      if (DEBUG_BOOKING) console.warn('[booking-step1] Missing API_BASE_URL or token');
      return [];
    }

    try {
      const dateStr  = date.toISOString().split('T')[0];
      const farmerId = localStorage.getItem('bookingFarmerId')  || '';
      const productId= localStorage.getItem('bookingProductId') || '';
      const params   = new URLSearchParams({ date: dateStr });

      // filter เฉพาะ product ที่กดจองมา ไม่เอา slot ของ product อื่นมาปน
      if (productId) {
        params.set('product_id', productId);
      } else if (farmerId) {
        params.set('farmer_id', farmerId);
      }

      const res = await fetch(`${API_BASE}/api/product-slots?${params.toString()}`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();

      return (json.data || []).map((slot) => ({
        id:          slot.slot_id || slot.id,
        time:        `${(slot.time_start||'').slice(0,5)}-${(slot.time_end||'').slice(0,5)}`,
        available:   (slot.capacity || 0) - (slot.booked_count || 0),
        capacity:    slot.capacity || 0,
        product_id:  slot.product_id,
        slot_name:   slot.slot_name || '',
        start_date:  slot.start_date,
        end_date:    slot.end_date,
        farmerName:  slot.product?.profiles
          ? `${slot.product.profiles.first_name||''} ${slot.product.profiles.last_name||''}`.trim()
          : '',
        productName: slot.product?.name || '',
        farmer_id:   slot.product?.user_id || farmerId,
      }));
    } catch (e) {
      if (DEBUG_BOOKING) console.warn('[booking-step1] fetchTimeSlots failed:', e.message);
      return [];
    }
  }

  // ================================
  // Utility Functions
  // ================================
  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  function getThaiYear(year) {
    return year + 543;
  }

  function formatDateThai(date) {
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = getThaiYear(date.getFullYear());
    return `${day} ${month} ${year}`;
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
    
    if (compareDate < today) return true;
    
    // [RULE] Can only book up to 14 days in advance for the presentation
    const maxFutureDate = new Date(today);
    maxFutureDate.setDate(today.getDate() + 14);
    if (compareDate > maxFutureDate) return true;

    return false;
  }

  function isValidTimeSlot(date, timeRangeStr) {
    if (!date || !timeRangeStr) return false;
    const today = new Date();
    const isToday = isSameDay(date, today);
    if (!isToday) return true; // Future day is always fine for time

    try {
      // timeRangeStr format: "08:00-09:00"
      const startTimeStr = timeRangeStr.split('-')[0];
      const [hours, minutes] = startTimeStr.split(':').map(Number);
      
      const slotStartTime = new Date(today);
      slotStartTime.setHours(hours, minutes, 0, 0);

      // Book at least 1 hour in advance
      const minAdvanceTime = new Date(today.getTime() + (1 * 60 * 60 * 1000));
      return slotStartTime >= minAdvanceTime;
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
    calendarMonth.textContent = `${thaiMonths[month]} ${getThaiYear(year)}`;

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

    // Next month's days to fill grid
    const totalCells = calendarDays.children.length;
    const remainingCells = 49 - totalCells; // 7 headers + 42 days = 49
    for (let day = 1; day <= remainingCells; day++) {
      const dayElement = createDayElement(day, "other-month");
      calendarDays.appendChild(dayElement);
    }
  }

  function createDayElement(day, className = "", date = null) {
    const dayDiv = document.createElement("div");
    dayDiv.className = `calendar-day ${className}`;
    dayDiv.textContent = day;

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
          กรุณาเลือกวันที่ก่อน
        </div>
      `;
      return;
    }

    // Show loading state
    timeSlotsContainer.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #999;">
        กำลังโหลดช่วงเวลา...
      </div>
    `;

    // Fetch available time slots for the selected date
    availableTimeSlots = await fetchTimeSlots(selectedDate);

    // Clear loading and render slots
    timeSlotsContainer.innerHTML = "";
    
    if (availableTimeSlots.length === 0) {
      timeSlotsContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #999;">
          ไม่มีช่วงเวลาว่างในวันนี้
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
        <span class="timeslot-badge full">เต็ม</span>
      `;
    } else {
      statusDiv.textContent = `เหลือ ${slot.available} คิว`;
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
  prevMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
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
      date:          selectedDate.toISOString(),
      dateFormatted: formatDateThai(selectedDate),
      timeSlot:      selectedTimeSlot,
      slot_id:       selectedTimeSlot.id,
      product_id:    selectedTimeSlot.product_id || null,
      farmerName:    selectedTimeSlot.farmerName || localStorage.getItem('bookingFarmerName') || '',
      productName:   selectedTimeSlot.productName || '',
      step: 1,
      timestamp: new Date().toISOString()
    };

    // buyer_id = ล้ง/ผู้รับซื้อที่เกษตรกรจะไปส่ง
    const buyerId = selectedTimeSlot.product_id ? selectedTimeSlot.farmer_id : localStorage.getItem('bookingFarmerId') || null;
    bookingData.buyer_id = buyerId;

    // farmer_id = เกษตรกรที่ login อยู่
    try {
      const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null');
      bookingData.farmer_id = u?.id || null;
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
        if (data.timeSlot) {
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
      const API_BASE  = (window.API_BASE_URL || "").replace(/\/$/, "");
      const TOKEN_KEY = window.AUTH_TOKEN_KEY || "token";
      const token     = localStorage.getItem(TOKEN_KEY) || "";

      if (farmerId && API_BASE) {
        fetch(API_BASE + "/api/profiles/" + encodeURIComponent(farmerId), {
          headers: token ? { "Authorization": "Bearer " + token } : {},
        })
          .then(r => r.ok ? r.json() : null)
          .then(profile => {
            if (profile && profile.avatar) {
              productIcon.src = profile.avatar;
              productIcon.alt = profile.first_name || "เกษตรกร";
            } else {
              // ไม่มี avatar ให้แสดง initials แทน
              const name = (profile && profile.first_name) || headerTitle?.textContent || "?";
              productIcon.style.display = "none";
              const parent = productIcon.parentElement;
              if (parent) {
                const fallback = document.createElement("div");
                fallback.textContent = name.charAt(0).toUpperCase();
                fallback.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;background:rgba(255,255,255,0.3);border-radius:inherit;";
                parent.appendChild(fallback);
              }
            }
          })
          .catch(() => {}); // ถ้า fetch ไม่ได้ให้คงรูปเดิมไว้
      }
    }
  }

  // ================================
  // Initialize
  // ================================
  function init() {
    loadHeaderInfo();
    loadPreviousData();
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
