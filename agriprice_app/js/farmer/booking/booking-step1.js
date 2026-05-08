/**
 * AGRIPRICE - Booking Step 1 JavaScript
 * ฟีเจอร์: ปฏิทินจริง, เลือกช่วงเวลา, บันทึก localStorage
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
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

  // Mock data - รองรับ Database ในอนาคต
  const timeSlots = [
    { id: 1, time: "06:00-08:00", available: 5, capacity: 10 },
    { id: 2, time: "08:00-10:00", available: 2, capacity: 10 },
    { id: 3, time: "10:00-12:00", available: 0, capacity: 10 },
    { id: 4, time: "14:00-16:00", available: 5, capacity: 10 },
    { id: 5, time: "16:00-18:00", available: 3, capacity: 10 }
  ];

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
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
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
  function renderTimeSlots() {
    timeSlotsContainer.innerHTML = "";

    if (!selectedDate) {
      timeSlotsContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #999;">
          กรุณาเลือกวันที่ก่อน
        </div>
      `;
      return;
    }

    timeSlots.forEach((slot) => {
      const slotElement = createTimeSlotElement(slot);
      timeSlotsContainer.appendChild(slotElement);
    });
  }

  function createTimeSlotElement(slot) {
    const slotDiv = document.createElement("div");
    slotDiv.className = "timeslot";

    const isFull = slot.available === 0;
    const isSelected = selectedTimeSlot && selectedTimeSlot.id === slot.id;

    if (isFull) {
      slotDiv.classList.add("disabled");
    }

    if (isSelected) {
      slotDiv.classList.add("selected");
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
    window.location.href = referrer;
  });

  // ================================
  // Submit - บันทึกข้อมูลและไปหน้าถัดไป
  // ================================
  btnSubmit.addEventListener("click", () => {
    if (!selectedDate || !selectedTimeSlot) return;

    // บันทึกข้อมูลลง localStorage (รองรับ Database ในอนาคต)
    const bookingData = {
      date: selectedDate.toISOString(),
      dateFormatted: formatDateThai(selectedDate),
      timeSlot: selectedTimeSlot,
      step: 1,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem("bookingStep1", JSON.stringify(bookingData));

    // รวมข้อมูลทั้งหมด
    const existingData = JSON.parse(localStorage.getItem("bookingData") || "{}");
    const updatedData = {
      ...existingData,
      ...bookingData
    };
    localStorage.setItem("bookingData", JSON.stringify(updatedData));

    console.log("✅ บันทึกข้อมูล Step 1:", bookingData);

    // ไปหน้าถัดไป
    window.location.href = "booking-step2.html";
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

        console.log("📥 โหลดข้อมูลเดิม:", data);
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

    if (sellerName) {
      document.getElementById("headerTitle").textContent = sellerName;
    }

    if (productName) {
      // อาจจะเปลี่ยนรูปสินค้าตาม productName
      console.log("Product:", productName);
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
