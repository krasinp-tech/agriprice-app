/* js/auth/guard.js
  - รองรับกรณีเปิดเว็บอยู่ใน subfolder เช่น /agriprice_fixed/
  - redirect ไป login1 แบบถูกเสมอ
*/

(function () {
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || "token";
  const REDIRECT_KEY = "redirectAfterAuth";

  // path ของไฟล์ login1 ภายในโปรเจกต์ (ไม่ใส่ / นำหน้า)
  const LOGIN1_REL = "pages/auth/login1.html";

  function isLoggedIn() {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  function currentFullPath() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function getProjectBasePath() {
    // ถ้า URL อยู่ใน /.../pages/... ให้ใช้ตำแหน่งนั้นเป็นฐาน

    const path = window.location.pathname;
    const pagesIdx = path.indexOf("/pages/");
    if (pagesIdx !== -1) {
      // รวมเครื่องหมาย / ท้ายสุด
      return path.substring(0, pagesIdx + 1);
    }

    // fallback เดิม ถ้าไม่มี /pages/ ในเส้นทาง
    const parts = path.split("/").filter(Boolean);
    if (parts.length > 0) {
      return "/" + parts[0] + "/";
    }
    return "/";
  }

  function goLogin1(nextPath) {
    const base = getProjectBasePath();
    const url = new URL(base + LOGIN1_REL, window.location.origin);
    url.searchParams.set("next", nextPath);
    if (window.navigateWithTransition) window.navigateWithTransition(url.toString()); else window.location.href = url.toString();
  }

  window.AuthGuard = {
    isLoggedIn,

    requireLogin() {
      if (isLoggedIn()) return true;
      const next = currentFullPath();
      sessionStorage.setItem(REDIRECT_KEY, next);
      goLogin1(next);
      return false;
    },

    redirectAfterLogin(defaultPath) {
      const params = new URLSearchParams(window.location.search);
      const explicit = params.get("next") || sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);

      if (explicit) {
        if (window.navigateWithTransition) window.navigateWithTransition(explicit); else window.location.href = explicit;
        return;
      }

      // หน้าเริ่มต้นตาม role และ tier
      let role = "";
      let tier = "free";
      try {
        const u = JSON.parse(localStorage.getItem("user") || "null");
        role = (u && u.role) ? String(u.role).toLowerCase() : (localStorage.getItem("role") || "").toLowerCase();
        tier = (u && u.tier) ? String(u.tier).toLowerCase() : "free";
      } catch (_) {}

      const base = getProjectBasePath();
      if (role === "buyer") {
        if (tier === "pro") {
          if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + "pages/buyer/Dashboard/Dashboard1.html"); else window.location.href = defaultPath || base + "pages/buyer/Dashboard/Dashboard1.html";
        } else {
          if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + "index.html"); else window.location.href = defaultPath || base + "index.html";
        }
      } else if (role === "farmer") {
        if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + "index.html"); else window.location.href = defaultPath || base + "index.html";
      } else {
        if (window.navigateWithTransition) window.navigateWithTransition(defaultPath || base + "index.html"); else window.location.href = defaultPath || base + "index.html";
      }
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      sessionStorage.removeItem(REDIRECT_KEY);
      if (window.navigateWithTransition) window.navigateWithTransition(getProjectBasePath() + "index.html"); else window.location.href = getProjectBasePath() + "index.html";
    }
  };
})();

