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
    // ถ้า URL เป็น /agriprice_app_merged/agriprice_app/pages/chat.html
    // เราต้องการได้ฐานเป็น /agriprice_app_merged/agriprice_app/
    // ใช้ตำแหน่งของ `/pages/` เพราะโครงสร้างโฟลเดอร์ของโปรเจกต์จะอยู่ก่อนหน้าเสมอ

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
    window.location.href = url.toString();
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
      const next =
        params.get("next") ||
        sessionStorage.getItem(REDIRECT_KEY) ||
        defaultPath ||
        (getProjectBasePath() + "index.html");

      sessionStorage.removeItem(REDIRECT_KEY);
      window.location.href = next;
    },

    logout() {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);
      window.location.href = getProjectBasePath() + "index.html";
    }
  };
})();
