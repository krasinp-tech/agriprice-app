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

  const profileName = document.getElementById("maProfileName");
  const profileRole = document.getElementById("maProfileRole");
  const avatarImg = document.getElementById("maAvatarImg");

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
      // Render Identity based on role
      const role = localStorage.getItem("role") || "-";
      const isBuyer = role === "buyer";
      const locationRow = document.getElementById("locationRow");
      const locationValue = document.getElementById("locationValue");
      if (locationRow) {
        locationRow.style.display = isBuyer ? "flex" : "none";
        if (isBuyer && locationValue && data.lat && data.lng) {
          locationValue.textContent = `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`;
        }
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