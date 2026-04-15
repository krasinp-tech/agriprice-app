(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

  const emailForm = document.getElementById("emailForm");
  const emailInput = document.getElementById("emailInput");
  const clearEmailBtn = document.getElementById("clearEmailBtn");
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
    if (emailInput) emailInput.value = data.email;
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

  if (clearEmailBtn && emailInput) {
    clearEmailBtn.addEventListener("click", function () {
      emailInput.value = "";
      showMessage("ลบอีเมลแล้ว กดบันทึกเพื่อยืนยัน", "success");
      emailInput.focus();
    });
  }

  if (!emailForm || !emailInput) return;

  emailForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const value = emailInput.value.trim();
    if (value) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isValid) {
        showMessage("รูปแบบอีเมลไม่ถูกต้อง", "error");
        emailInput.focus();
        return;
      }
    }

    try {
      await store.updateEmail(value);
      showMessage("บันทึกอีเมลเรียบร้อย", "success");
    } catch (err) {
      showMessage(err.message || "บันทึกอีเมลไม่สำเร็จ", "error");
      return;
    }

    setTimeout(function () {
      if (window.navigateWithTransition) window.navigateWithTransition("my-account.html"); else window.location.href = "my-account.html";
    }, 650);
  });
})();

