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

  const data = store.getData();
  if (birthDateInput) birthDateInput.value = data.birthDate;
  if (currentBirthDate) currentBirthDate.textContent = store.formatThaiDate(data.birthDate);
  updatePreview();

  if (birthDateInput) {
    birthDateInput.addEventListener("input", updatePreview);
  }

  if (!birthDateForm || !birthDateInput) return;

  birthDateForm.addEventListener("submit", function (event) {
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
      showMessage("วันเกิดต้องไม่เป็นวันที่ในอนาคต", "error");
      birthDateInput.focus();
      return;
    }

    store.setData({ birthDate: value });
    showMessage("บันทึกวันเดือนปีเกิดเรียบร้อย", "success");

    setTimeout(function () {
      window.location.href = "my-account.html";
    }, 650);
  });
})();
