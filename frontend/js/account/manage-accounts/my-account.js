(function () {
  "use strict";

  // [FIX] Trigger entry animation immediately so page doesn't stay hidden
  requestAnimationFrame(() => {
    const shell = document.querySelector('.ma-shell');
    if (shell) shell.classList.add('show');
  });

  const store = window.AccountManageStore;
  if (!store) {
    console.error("[MyAccount] AccountManageStore not found.");
    return;
  }

  const phoneValue = document.getElementById("phoneValue");
  const emailValue = document.getElementById("emailValue");
  const birthDateValue = document.getElementById("birthDateValue");
  const accountStateValue = document.getElementById("accountStateValue");



  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }



  function render() {
    try {
      const data = store.getData();

      setText(phoneValue, store.maskPhone(data.phone));
      setText(emailValue, store.maskEmail(data.email));
      setText(birthDateValue, store.formatThaiDate(data.birthDate));

      if (accountStateValue) {
        const isDisabled = data.accountStatus === "disabled";
        const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
        accountStateValue.textContent = isDisabled ? t('disabled_status', "ปิดใช้งานอยู่") : t('active_status', "ใช้งานปกติ");
      }

    } catch (e) {
      console.error("[MyAccount] Render error:", e);
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