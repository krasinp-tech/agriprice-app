(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

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
      statusPill.textContent = isDisabled ? "ปิดใช้งาน" : "ใช้งานปกติ";
      statusPill.classList.toggle("is-disabled", isDisabled);
    }

    if (statusDescription) {
      statusDescription.textContent = isDisabled
        ? "บัญชีถูกปิดใช้งานชั่วคราว คุณยังสามารถเปิดใช้งานได้ทุกเมื่อ"
        : "บัญชีของคุณกำลังใช้งานตามปกติ";
    }

    if (deactivateBtn) deactivateBtn.disabled = isDisabled;
    if (reactivateBtn) reactivateBtn.disabled = !isDisabled;
  }

  function isConfirmed() {
    if (confirmActionCheck && confirmActionCheck.checked) return true;
    showMessage(statusMessage, "กรุณาติ๊กยืนยันก่อนดำเนินการ", "error");
    return false;
  }

  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", function () {
      clearMessages();
      if (!isConfirmed()) return;

      store.setData({ accountStatus: "disabled" });
      renderStatus();
      showMessage(statusMessage, "ปิดใช้งานบัญชีเรียบร้อย", "success");
    });
  }

  if (reactivateBtn) {
    reactivateBtn.addEventListener("click", function () {
      clearMessages();
      if (!isConfirmed()) return;

      store.setData({ accountStatus: "active" });
      renderStatus();
      showMessage(statusMessage, "เปิดใช้งานบัญชีเรียบร้อย", "success");
    });
  }

  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", function () {
      clearMessages();

      if (!isConfirmed()) return;

      const keyword = deleteKeywordInput ? deleteKeywordInput.value.trim() : "";
      if (keyword !== "DELETE") {
        showMessage(deleteMessage, "กรุณาพิมพ์คำว่า DELETE ให้ถูกต้อง", "error");
        if (deleteKeywordInput) deleteKeywordInput.focus();
        return;
      }

      const accepted = window.confirm("ยืนยันลบบัญชีถาวรหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้");
      if (!accepted) return;

      store.resetData();

      try {
        const authTokenKey = window.AUTH_TOKEN_KEY || "token";
        localStorage.removeItem(authTokenKey);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
      } catch (_) {}

      showMessage(deleteMessage, "ลบบัญชีเรียบร้อย กำลังพากลับหน้าแรก...", "success");

      setTimeout(function () {
        window.location.href = "../../../index.html";
      }, 900);
    });
  }

  renderStatus();
})();
