(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

  const birthDateForm = document.getElementById("birthDateForm");
  const birthDateInput = document.getElementById("birthDateInput");
  const currentBirthDate = document.getElementById("currentBirthDate");
  const birthDatePreview = document.getElementById("birthDatePreview");
  const pageMessage = document.getElementById("pageMessage");

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
    birthDatePreview.textContent = `ตัวอย่างที่จะแสดง: ${store.formatThaiDate(value)}`;
  }

  function renderFromStore() {
    const data = store.getData();
    if (birthDateInput) birthDateInput.value = data.birthDate;
    if (currentBirthDate) currentBirthDate.textContent = store.formatThaiDate(data.birthDate);
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

  if (birthDateInput) {
    birthDateInput.addEventListener("input", updatePreview);
  }

  if (!birthDateForm || !birthDateInput) return;

  birthDateForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const value = birthDateInput.value;
    if (!value) {
      showMessage("กรุณาเลือกวันเดือนปีเกิด", "error");
      birthDateInput.focus();
      return;
    }

    const selectedDate = new Date(`${value}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
      showMessage("วันเกิดต้องไม่เป็นวันในอนาคต", "error");
      birthDateInput.focus();
      return;
    }

    try {
      await store.updateBirthDate(value);
      showMessage("บันทึกวันเดือนปีเกิดเรียบร้อย", "success");
    } catch (err) {
      showMessage(err.message || "บันทึกวันเดือนปีเกิดไม่สำเร็จ", "error");
      return;
    }

    setTimeout(function () {
      if (window.navigateWithTransition) window.navigateWithTransition("my-account.html"); else window.location.href = "my-account.html";
    }, 650);
  });
})();

