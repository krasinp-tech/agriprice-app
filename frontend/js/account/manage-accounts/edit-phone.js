(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;

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
      showMessage(t('phone_required', "กรุณากรอกหมายเลขโทรศัพท์"), "error");
      phoneInput.focus();
      return;
    }

    const digits = value.replace(/\D/g, "");
    const isValid = /^0\d{9}$/.test(digits) || /^66\d{9}$/.test(digits);
    if (!isValid) {
      showMessage(t('invalid_phone_format', "รูปแบบหมายเลขโทรศัพท์ไม่ถูกต้อง"), "error");
      phoneInput.focus();
      return;
    }

    try {
      await store.updatePhone(value);
      showMessage(t('phone_saved', "บันทึกหมายเลขโทรศัพท์เรียบร้อย"), "success");
    } catch (err) {
      const msg = err.message || t('phone_save_failed', "บันทึกหมายเลขโทรศัพท์ไม่สำเร็จ");
      showMessage(msg, "error");
      return;
    }

    setTimeout(function () {
      if (window.navigateWithTransition) window.navigateWithTransition("my-account.html"); else window.location.href = "my-account.html";
    }, 650);
  });
})();
