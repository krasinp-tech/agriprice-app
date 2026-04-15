(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

  const phoneValue = document.getElementById("phoneValue");
  const emailValue = document.getElementById("emailValue");
  const birthDateValue = document.getElementById("birthDateValue");
  const accountStateValue = document.getElementById("accountStateValue");

  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function render() {
    const data = store.getData();

    setText(phoneValue, store.maskPhone(data.phone));
    setText(emailValue, store.maskEmail(data.email));
    setText(birthDateValue, store.formatThaiDate(data.birthDate));

    if (accountStateValue) {
      const isDisabled = data.accountStatus === "disabled";
      accountStateValue.textContent = isDisabled ? "ปิดใช้งานอยู่" : "ใช้งานปกติ";
    }
  }

  async function hydrate() {
    render();
    try {
      await store.syncFromServer();
      render();
    } catch (_) {
      // Keep local cached data when API is unavailable.
    }
  }

  hydrate();
  window.addEventListener("pageshow", hydrate);
})();