(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

  const phoneForm = document.getElementById("phoneForm");
  const phoneInput = document.getElementById("phoneInput");
  const currentPhoneValue = document.getElementById("currentPhoneValue");
  const pageMessage = document.getElementById("pageMessage");

  function showMessage(text, type) {
    if (!pageMessage) return;
    pageMessage.textContent = text;
    pageMessage.classList.remove("is-success", "is-error");
    if (type === "success") pageMessage.classList.add("is-success");
    if (type === "error") pageMessage.classList.add("is-error");
  }

  function renderFromStore() {
    const data = store.getData();
    if (currentPhoneValue) currentPhoneValue.textContent = store.maskPhone(data.phone);
    if (phoneInput) phoneInput.value = data.phone;
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

  if (!phoneForm || !phoneInput) return;

  phoneForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const value = phoneInput.value.trim();
    if (!value) {
      showMessage("กรุณากรอกหมายเลขโทรศัพท์", "error");
      phoneInput.focus();
      return;
    }

    const isValid = /^\+?[0-9*][0-9*\s-]{7,20}$/.test(value);
    if (!isValid) {
      showMessage("รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง", "error");
      phoneInput.focus();
      return;
    }

    try {
      await store.updatePhone(value);
      showMessage("บันทึกหมายเลขโทรศัพท์เรียบร้อย", "success");
    } catch (err) {
      showMessage(err.message || "บันทึกหมายเลขโทรศัพท์ไม่สำเร็จ", "error");
      return;
    }

    setTimeout(function () {
      if (window.navigateWithTransition) window.navigateWithTransition("my-account.html"); else window.location.href = "my-account.html";
    }, 650);
  });
})();

