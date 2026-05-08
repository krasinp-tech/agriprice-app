(function () {
  "use strict";

  const store = window.AccountManageStore;
  if (!store) return;

  const passwordForm = document.getElementById("passwordForm");
  const currentPasswordInput = document.getElementById("currentPasswordInput");
  const newPasswordInput = document.getElementById("newPasswordInput");
  const confirmPasswordInput = document.getElementById("confirmPasswordInput");
  const pageMessage = document.getElementById("pageMessage");

  function showMessage(text, type) {
    if (!pageMessage) return;
    pageMessage.textContent = text;
    pageMessage.classList.remove("is-success", "is-error");
    if (type === "success") pageMessage.classList.add("is-success");
    if (type === "error") pageMessage.classList.add("is-error");
  }

  if (!passwordForm || !currentPasswordInput || !newPasswordInput || !confirmPasswordInput) return;

  passwordForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const currentPassword = currentPasswordInput.value.trim();
    const newPassword = newPasswordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage("กรุณากรอกข้อมูลให้ครบทุกช่อง", "error");
      return;
    }

    if (newPassword.length < 8) {
      showMessage("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร", "error");
      newPasswordInput.focus();
      return;
    }

    if (newPassword === currentPassword) {
      showMessage("รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม", "error");
      newPasswordInput.focus();
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน", "error");
      confirmPasswordInput.focus();
      return;
    }

    store.setData({ passwordUpdatedAt: new Date().toISOString() });
    passwordForm.reset();
    showMessage("บันทึกรหัสผ่านใหม่เรียบร้อย", "success");

    setTimeout(function () {
      window.location.href = "my-account.html";
    }, 700);
  });
})();
