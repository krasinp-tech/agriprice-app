/**
 * guard.js
 * ระบบ "ยามเฝ้าประตู" ของแอป
 * ทำหน้าที่ตรวจสอบว่าผู้ใช้ได้เข้าสู่ระบบ (Login) หรือยัง
 * หากยังไม่ได้ Login จะทำการส่งผู้ใช้กลับไปยังหน้า Login โดยอัตโนมัติ เพื่อความปลอดภัย
 */
/* js/auth/guard.js
  - รองรับกรณีเปิดเว็บอยู่ใน subfolder เช่น /agriprice_fixed/
  - redirect ไป login1 แบบถูกเสมอ
*/

(function () {
  const KEYS = window.STORAGE_KEYS || { TOKEN: 'token', ROLE: 'role', USER_DATA: 'user_data' };
  const REDIRECT_KEY = "redirectAfterAuth";

  // path ของไฟล์ login1 ภายในโปรเจกต์ (ไม่ใส่ / นำหน้า)
  const LOGIN1_REL = "pages/auth/login1.html";

  function isLoggedIn() {
    if (window.Auth && window.Auth.isLoggedIn) return window.Auth.isLoggedIn();
    return !!localStorage.getItem(KEYS.TOKEN);
  }

  function currentFullPath() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function getProjectBasePath() {
    const path = window.location.pathname;
    const pagesIdx = path.indexOf("/pages/");
    if (pagesIdx !== -1) {
      return path.substring(0, pagesIdx + 1);
    }
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
    if (window.navigateWithTransition) window.navigateWithTransition(url.toString()); 
    else window.location.href = url.toString();
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
        if (window.navigateWithTransition) window.navigateWithTransition(explicit); 
        else window.location.href = explicit;
        return;
      }

      // หน้าเริ่มต้นตาม role และ tier
      let role = "";
      let tier = "free";
      try {
        const u = JSON.parse(localStorage.getItem(KEYS.USER_DATA) || "null");
        role = (u && u.role) ? String(u.role).toLowerCase() : (localStorage.getItem(KEYS.ROLE) || "").toLowerCase();
        tier = (u && u.tier) ? String(u.tier).toLowerCase() : "free";
      } catch (err) {}

      const base = getProjectBasePath();
      
      // ลำดับความสำคัญ: 1. defaultPath (ถ้าส่งมา) -> 2. หน้าที่เหมาะสมตามสิทธิ์ -> 3. index.html
      let finalTarget = defaultPath;
      
      if (!finalTarget) {
        if (role === "buyer" && tier === "pro") {
          finalTarget = base + "pages/buyer/Dashboard/Dashboard1.html";
        } else {
          finalTarget = base + "index.html";
        }
      }

      if (window.navigateWithTransition) window.navigateWithTransition(finalTarget); 
      else window.location.href = finalTarget;
    },

    logout() {
      if (window.Auth && window.Auth.logout) {
        window.Auth.logout(false); // logout without immediate redirect
      } else {
        localStorage.removeItem(KEYS.TOKEN);
        localStorage.removeItem(KEYS.USER_DATA);
        localStorage.removeItem(KEYS.ROLE);
      }
      sessionStorage.removeItem(REDIRECT_KEY);
      const base = getProjectBasePath();
      if (window.navigateWithTransition) window.navigateWithTransition(base + "index.html"); 
      else window.location.href = base + "index.html";
    }
  };
})();
