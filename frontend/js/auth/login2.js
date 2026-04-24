/* js/login/register/login2.js
   - Login flow with Future DB support
   - If window.API_BASE_URL is set: POST to `${API_BASE_URL}/api/auth/login`
   - Store token/user to localStorage (ready for guards)
   - Redirect via AuthGuard.redirectAfterLogin() to next (query/sessionStorage) or default
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

  // ====== FUTURE CONFIG ======
  const CONFIG = {
    API_BASE: (window.API_BASE_URL || "").replace(/\/$/, ""),
    API_AUTH_PREFIX: (window.API_AUTH_PREFIX || "/api/auth"),
    TOKEN_KEY: (window.AUTH_TOKEN_KEY || "token"),
    USER_KEY: (window.AUTH_USER_KEY || "user"),
    REDIRECT_KEY: "redirectAfterAuth",
  };

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
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("is-loading", !!on);
  }

  function normalizeIdentifier(v) {
    return (v || "").trim();
  }

  function validate() {
    const identifier = normalizeIdentifier(idEl?.value);
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

  function persistAuth(token, user) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user || {}));
    // บันทึก role ให้ components เข้าถึงได้ง่าย
    if (user && user.role) {
      localStorage.setItem("role", String(user.role).toLowerCase());
    } else {
      // ถ้าไม่มี role ให้ล้างค่าเดิม
      localStorage.removeItem("role");
    }
  }

  function redirectAfterLogin() {
    // ใช้ AuthGuard ถ้ามี (แนะนำ)
    if (window.AuthGuard && typeof window.AuthGuard.redirectAfterLogin === "function") {
      window.AuthGuard.redirectAfterLogin();
      return;
    }

    // fallback ถ้า guard ไม่ถูกโหลด
    let next = "";
    try {
      const url = new URL(window.location.href);
      next = url.searchParams.get("next") || "";
    } catch (_) {}

    const stored = sessionStorage.getItem(CONFIG.REDIRECT_KEY);
    const target = next || stored || '../../index.html';

    sessionStorage.removeItem(CONFIG.REDIRECT_KEY);
    if (window.navigateWithTransition) window.navigateWithTransition(target); else window.location.href = target;
  }

  async function loginViaApi(identifier, password) {
    const API = CONFIG.API_BASE + CONFIG.API_AUTH_PREFIX;

    const res = await fetch(API + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone: identifier, password }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(json?.message || "เข้าสู่ระบบไม่สำเร็จ");
    }

    const token = json.token || json.accessToken || json.access_token || json.data?.token;
    const user = json.user || json.profile || json.data?.user;

    if (!token) throw new Error("ไม่พบ token จากเซิร์ฟเวอร์");

    return { token, user: user || { identifier } };
  }

  // ===== Video fallback =====
  function setupVideo() {
    if (!video) return;

    // ให้ autoplay ได้ชัวร์ขึ้น
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

    if (!CONFIG.API_BASE) {
      showError("ไม่พบการตั้งค่า API กรุณาตั้งค่า API_BASE_URL");
      return;
    }

    setLoading(true);
    clearError();

    try {
      const result = await loginViaApi(identifier, password);

      // Login สำเร็จ — บันทึก auth
      persistAuth(result.token, result.user);

      // ขอ Notification permission หลัง login (แบบ native เงียบๆ ถ้าไม่เคยถามมาก่อน)
      try {
        if (window.AgriPermission) {
          const prefs = window.AgriPermission.getPrefs();
          if (!prefs.notification && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            // รอ 800ms ให้หน้าจอ settle ก่อนแสดง permission sheet
            await new Promise(resolve => setTimeout(resolve, 800));
            await window.AgriPermission.requestNotification();
          }
        }
      } catch (_) {}

      // ไปหน้าที่ควรไปหลัง login
      redirectAfterLogin();
    } catch (err) {
      showError(err?.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // init
  setupVideo();
  setupPasswordToggle();
  form && form.addEventListener("submit", onSubmit);
})();

