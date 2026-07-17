(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;

  const statusPill = document.getElementById("statusPill");
  const statusDescription = document.getElementById("statusDescription");
  const confirmActionCheck = document.getElementById("confirmActionCheck");
  const deactivateBtn = document.getElementById("deactivateBtn");
  const reactivateBtn = document.getElementById("reactivateBtn");
  const statusMessage = document.getElementById("statusMessage");

  const deleteKeywordInput = document.getElementById("deleteKeywordInput");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  const deleteMessage = document.getElementById("deleteMessage");

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove("is-success", "is-error");
    if (type === "success") el.classList.add("is-success");
    if (type === "error") el.classList.add("is-error");
  }

  function clearMessages() {
    showMessage(statusMessage, "", "");
    showMessage(deleteMessage, "", "");
  }

  function renderStatus() {
    const data = store.getData();
    const isDisabled = data.accountStatus === "disabled";

    if (statusPill) {
      statusPill.textContent = isDisabled ? t('disabled_status', 'ปิดใช้งาน') : t('active_status', 'ใช้งานปกติ');
      statusPill.classList.toggle("is-disabled", isDisabled);
    }

    if (statusDescription) {
      statusDescription.textContent = isDisabled
        ? t('account_disabled_desc', "บัญชีถูกปิดใช้งานชั่วคราว คุณยังสามารถเปิดใช้งานได้ทุกเมื่อ")
        : t('account_active_desc', "บัญชีของคุณกำลังใช้งานตามปกติ");
    }

    if (deactivateBtn) deactivateBtn.disabled = isDisabled;
    if (reactivateBtn) reactivateBtn.disabled = !isDisabled;
  }

  async function hydrate() {
    try {
      await store.syncFromServer();
    } catch (_) {
      // Keep local fallback when API is unavailable.
    }
    renderStatus();
  }

  function isConfirmed() {
    if (confirmActionCheck && confirmActionCheck.checked) return true;
    showMessage(statusMessage, t('confirm_action_required', "กรุณาติ๊กยืนยันก่อนดำเนินการ"), "error");
    return false;
  }

  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", async function () {
      clearMessages();
      if (!isConfirmed()) return;

      deactivateBtn.disabled = true;
      try {
        await store.setAccountStatus("disabled");
        renderStatus();
        if (confirmActionCheck) confirmActionCheck.checked = false;
        window.AgriPresence?.stop?.();
        showMessage(statusMessage, t('account_deactivated_success', "ปิดใช้งานบัญชีเรียบร้อย"), "success");
      } catch (err) {
        renderStatus();
        showMessage(statusMessage, window.i18nApiMessage?.(err.message, 'account_deactivate_failed') || t('account_deactivate_failed', "ปิดใช้งานบัญชีไม่สำเร็จ"), "error");
      }
    });
  }

  if (reactivateBtn) {
    reactivateBtn.addEventListener("click", async function () {
      clearMessages();
      if (!isConfirmed()) return;

      reactivateBtn.disabled = true;
      try {
        await store.setAccountStatus("active");
        renderStatus();
        if (confirmActionCheck) confirmActionCheck.checked = false;
        window.AgriPresence?.refresh?.();
        showMessage(statusMessage, t('account_reactivated_success', "เปิดใช้งานบัญชีเรียบร้อย"), "success");
      } catch (err) {
        renderStatus();
        showMessage(statusMessage, window.i18nApiMessage?.(err.message, 'account_reactivate_failed') || t('account_reactivate_failed', "เปิดใช้งานบัญชีไม่สำเร็จ"), "error");
      }
    });
  }

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async function () {
      clearMessages();

      if (!isConfirmed()) return;

      const keyword = deleteKeywordInput ? deleteKeywordInput.value.trim() : "";
      if (keyword !== "DELETE") {
        showMessage(deleteMessage, t('delete_keyword_error', "กรุณาพิมพ์คำว่า DELETE ให้ถูกต้อง"), "error");
        if (deleteKeywordInput) deleteKeywordInput.focus();
        return;
      }

      const runDelete = async () => {
        deleteAccountBtn.disabled = true;
        try {
          await store.deleteAccount("user_requested_delete");
        } catch (err) {
          deleteAccountBtn.disabled = false;
          showMessage(deleteMessage, window.i18nApiMessage?.(err.message, 'account_delete_failed') || t('account_delete_failed', "ลบบัญชีไม่สำเร็จ"), "error");
          return;
        }

        window.AgriPresence?.stop?.();

        try {
          await window.firebase?.auth?.().signOut?.();
        } catch (_) {}

        try {
          window.api?.clearAuth?.();
          localStorage.clear();
          sessionStorage.clear();
        } catch (_) {}

        try {
          if (window.caches) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
          }
        } catch (_) {}

        showMessage(deleteMessage, t('account_deleted_redirecting', "ลบบัญชีเรียบร้อย กำลังพากลับหน้าแรก..."), "success");

        setTimeout(function () {
          if (window.navigateWithTransition) window.navigateWithTransition("../../../index.html"); else window.location.href = "../../../index.html";
        }, 900);
      };

      const msg = t('account_delete_confirm', "ยืนยันลบบัญชีถาวรหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้");
      if (window.showConfirm) {
        window.showConfirm(msg, (agreed) => {
          if (agreed) runDelete();
        }, {
          variant: 'danger',
          title: t('delete_account', 'ลบบัญชี'),
          confirmText: t('delete_account', 'ลบบัญชี')
        });
      } else {
        window.showAlert?.(msg, 'info');
      }
    });
  }

  hydrate();
})();
