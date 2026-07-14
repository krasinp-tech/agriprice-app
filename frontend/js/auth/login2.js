/* js/login/register/login2.js
   - Unified Login flow using window.api and window.AuthGuard
*/

(function () {
  const form = document.getElementById("loginForm");
  const idEl = document.getElementById("identifier");
  const pwEl = document.getElementById("password");
  const togglePwdBtn = document.getElementById("togglePwd");

  const errBox = document.getElementById("formError");
  const idHelp = document.getElementById("idHelp");
  const pwHelp = document.getElementById("pwHelp");

  const btn = document.getElementById("loginBtn");

  const video = document.getElementById("loginVideo");
  const fallback = document.getElementById("mediaFallback");

  function showError(msg) {
    if (!errBox) return;
    errBox.textContent = msg || "เกิดข้อผิดพลาด";
    errBox.classList.add("is-show");
  }
  function clearError() {
    if (!errBox) return;
    errBox.textContent = "";
    errBox.classList.remove("is-show");
  }

  function setLoading(on) {
    if (window.setBtnLoading) {
      window.setBtnLoading(btn, on);
    } else if (btn) {
      btn.disabled = !!on;
      btn.classList.toggle("is-loading", !!on);
    }
  }

  function validate() {
    const identifier = (idEl?.value || "").trim();
    const password = (pwEl?.value || "").trim();

    if (idHelp) idHelp.textContent = "";
    if (pwHelp) pwHelp.textContent = "";
    clearError();

    let ok = true;

    if (!identifier) {
      if (idHelp) idHelp.textContent = "กรุณากรอกอีเมลหรือเบอร์โทรศัพท์";
      ok = false;
    }
    if (!password) {
      if (pwHelp) pwHelp.textContent = "กรุณากรอกรหัสผ่าน";
      ok = false;
    }

    return { ok, identifier, password };
  }

  // ===== Video fallback =====
  function setupVideo() {
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("error", () => {
      if (fallback) fallback.classList.add("is-show");
    });
    video.play().catch(() => {
      if (fallback) fallback.classList.add("is-show");
    });
  }

  // ===== Toggle password =====
  function setupPasswordToggle() {
    if (!togglePwdBtn || !pwEl) return;
    togglePwdBtn.addEventListener("click", () => {
      pwEl.type = (pwEl.type === "password") ? "text" : "password";
    });
  }

  // ===== Submit =====
  async function onSubmit(e) {
    e.preventDefault();

    const { ok, identifier, password } = validate();
    if (!ok) return;

    if (!window.api || !window.api.login) {
      showError("ระบบ API ยังไม่พร้อมใช้งาน");
      return;
    }

    setLoading(true);
    clearError();

    try {
      // 1. Call unified login API
      const result = await window.api.login(identifier, password);

      if (!result.token) {
        throw new Error(result.message || "ไม่ได้รับ Token จากเซิร์ฟเวอร์");
      }

      // 2. Persist using unified logic (handled inside api.login, but we ensure state)
      if (window.api.persistAuth) {
        window.api.persistAuth(result.token, result.user);
      }

      // 3. Request permissions quietly
      try {
        if (window.AgriPermission?.requestNotification) {
          await new Promise(resolve => setTimeout(resolve, 800));
          await window.AgriPermission.requestNotification();
        }
      } catch (_) {}

      if (window.showToast) window.showToast("เข้าสู่ระบบสำเร็จ", "success");

      // 4. Unified Redirect
      setTimeout(() => {
        if (window.AuthGuard && window.AuthGuard.redirectAfterLogin) {
          window.AuthGuard.redirectAfterLogin();
        } else {
          window.location.href = '../../index.html';
        }
      }, 600);

    } catch (err) {
      if (window.appNotify) {
        window.appNotify(err?.message || "เข้าสู่ระบบไม่สำเร็จ", "error");
      } else {
        showError(err?.message || "เข้าสู่ระบบไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }

  // init
  setupVideo();
  setupPasswordToggle();
  form && form.addEventListener("submit", onSubmit);
})();
