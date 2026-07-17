(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;

  const birthDateForm = document.getElementById("birthDateForm");
  const birthDateInput = document.getElementById("birthDateInput");
  const currentBirthDate = document.getElementById("currentBirthDate");
  const birthDatePreview = document.getElementById("birthDatePreview");
  const pageMessage = document.getElementById("pageMessage");

  // Dropdown Selects
  const daySelect = document.getElementById("birthDaySelect");
  const monthSelect = document.getElementById("birthMonthSelect");
  const yearSelect = document.getElementById("birthYearSelect");

  // Setup options
  const lang = localStorage.getItem('lang') || 'th';
  const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';

  // Dynamic localized months using Intl
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2000, i, 15);
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
  });

  const currentYear = new Date().getFullYear();
  const isThai = (lang === 'th');
  const yearOffset = isThai ? 543 : 0;

  // Populate Month Options
  if (monthSelect) {
    months.forEach((name, index) => {
      const opt = document.createElement("option");
      opt.value = String(index + 1).padStart(2, '0');
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
  }

  // Populate Year Options
  if (yearSelect) {
    for (let y = currentYear; y >= currentYear - 100; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y + yearOffset);
      yearSelect.appendChild(opt);
    }
  }

  function updateDays() {
    if (!daySelect || !monthSelect || !yearSelect) return;
    const year = parseInt(yearSelect.value);
    const month = parseInt(monthSelect.value);

    let maxDays = 31;
    if (year && month) {
      maxDays = new Date(year, month, 0).getDate();
    }

    const currentSelectedDay = daySelect.value;

    while (daySelect.options.length > 1) {
      daySelect.remove(1);
    }

    for (let d = 1; d <= maxDays; d++) {
      const opt = document.createElement("option");
      const val = String(d).padStart(2, '0');
      opt.value = val;
      opt.textContent = String(d);
      daySelect.appendChild(opt);
    }

    if (currentSelectedDay && parseInt(currentSelectedDay) <= maxDays) {
      daySelect.value = currentSelectedDay;
    }
  }

  function onSelectChange() {
    updateDays();
    if (!daySelect || !monthSelect || !yearSelect || !birthDateInput) return;
    const d = daySelect.value;
    const m = monthSelect.value;
    const y = yearSelect.value;

    if (d && m && y) {
      birthDateInput.value = `${y}-${m}-${d}`;
    } else {
      birthDateInput.value = "";
    }
    updatePreview();
  }

  daySelect?.addEventListener("change", onSelectChange);
  monthSelect?.addEventListener("change", onSelectChange);
  yearSelect?.addEventListener("change", onSelectChange);

  function showMessage(text, type) {
    if (!pageMessage) return;
    pageMessage.textContent = text;
    pageMessage.classList.remove("is-success", "is-error");
    if (type === "success") pageMessage.classList.add("is-success");
    if (type === "error") pageMessage.classList.add("is-error");
  }

  function updatePreview() {
    if (!birthDateInput || !birthDatePreview) return;
    const value = birthDateInput.value;
    birthDatePreview.textContent = t('birthdate_display_preview', 'ตัวอย่างที่จะแสดง: {date}').replace('{date}', store.formatThaiDate(value));
  }

  function renderFromStore() {
    const data = store.getData();
    if (birthDateInput) birthDateInput.value = data.birthDate;
    if (currentBirthDate) currentBirthDate.textContent = store.formatThaiDate(data.birthDate);

    if (data.birthDate && daySelect && monthSelect && yearSelect) {
      const parts = data.birthDate.split("-");
      if (parts.length === 3) {
        yearSelect.value = parts[0];
        monthSelect.value = parts[1];
        updateDays();
        daySelect.value = parts[2];
      }
    } else {
      if (daySelect) daySelect.value = "";
      if (monthSelect) monthSelect.value = "";
      if (yearSelect) yearSelect.value = "";
      updateDays();
    }

    updatePreview();
  }

  async function hydrate() {
    renderFromStore();
    try {
      await store.syncFromServer();
      renderFromStore();
    } catch (_) {
      // Keep local data when API is unavailable.
    }
  }

  hydrate();

  if (!birthDateForm || !birthDateInput) return;

  birthDateForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const value = birthDateInput.value;
    if (!value) {
      showMessage(t('select_birthdate_error', "กรุณาเลือกวันเดือนปีเกิด"), "error");
      if (daySelect && !daySelect.value) daySelect.focus();
      else if (monthSelect && !monthSelect.value) monthSelect.focus();
      else if (yearSelect && !yearSelect.value) yearSelect.focus();
      return;
    }

    const selectedDate = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      showMessage(t('birthdate_future_error', "วันเกิดต้องไม่เป็นวันในอนาคต"), "error");
      return;
    }

    try {
      await store.updateBirthDate(value);
      showMessage(t('birthdate_saved', "บันทึกวันเดือนปีเกิดเรียบร้อย"), "success");
    } catch (err) {
      showMessage(window.i18nApiMessage?.(err.message, 'birthdate_save_failed') || t('birthdate_save_failed', "บันทึกวันเดือนปีเกิดไม่สำเร็จ"), "error");
      return;
    }

    setTimeout(function () {
      if (window.navigateWithTransition) window.navigateWithTransition("my-account.html"); else window.location.href = "my-account.html";
    }, 650);
  });
})();
