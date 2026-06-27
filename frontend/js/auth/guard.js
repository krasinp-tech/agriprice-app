/* js/auth/guard.js
  - รองรับกรณีเปิดเว็บอยู่ใน subfolder เช่น /agriprice_fixed/
  - redirect ไป login1 แบบถูกเสมอ
*/

(function () {
  const REDIRECT_KEY = "redirectAfterAuth";
  const LOGIN1_REL = "pages/auth/login1.html";

  function isLoggedIn() {
    if (window.api && window.api.isLoggedIn) return window.api.isLoggedIn();
    
    // fallback logic if api not yet loaded or doesn't have the method
    const KEYS = window.STORAGE_KEYS || { TOKEN: 'token', ROLE: 'role' };
    const token = localStorage.getItem(KEYS.TOKEN);
    const role = String(localStorage.getItem(KEYS.ROLE) || 'guest').toLowerCase();
    
    return !!token && role !== 'guest' && role !== 'null' && role !== 'undefined';
  }

  function getProjectBasePath() {
    const path = window.location.pathname;
    const pagesIdx = path.indexOf("/pages/");
    if (pagesIdx !== -1) return path.substring(0, pagesIdx + 1);
    const lastSlash = path.lastIndexOf("/");
    return path.substring(0, lastSlash + 1);
  }

  function goLogin1(nextPath) {
    const base = getProjectBasePath();
    const loginUrl = base + LOGIN1_REL;
    const url = new URL(loginUrl, window.location.origin);
    if (nextPath) {
      // Ensure nextPath is relative to root if it contains the base
      let cleanNext = nextPath;
      if (nextPath.startsWith(window.location.origin)) {
        cleanNext = nextPath.substring(window.location.origin.length);
      }
      url.searchParams.set("next", cleanNext);
    }
    
    if (window.navigateWithTransition) window.navigateWithTransition(url.toString()); 
    else window.location.href = url.toString();
  }

  window.AuthGuard = {
    isLoggedIn,

    requireLogin() {
      if (isLoggedIn()) return true;
      const next = window.location.pathname + window.location.search;
      sessionStorage.setItem(REDIRECT_KEY, next);
      goLogin1(next);
      return false;
    },

    redirectAfterLogin(defaultPath) {
      const params = new URLSearchParams(window.location.search);
      const explicit = params.get("next") || sessionStorage.getItem(REDIRECT_KEY);
      sessionStorage.removeItem(REDIRECT_KEY);

      if (explicit && explicit !== 'undefined' && explicit !== 'null') {
        // Safe navigation to the explicit target
        const target = explicit.startsWith('/') ? explicit : (getProjectBasePath() + explicit);
        if (window.navigateWithTransition) window.navigateWithTransition(target); 
        else window.location.href = target;
        return;
      }

      const role = window.api ? window.api.getRole() : 'guest';
      const user = window.api ? window.api.getUser() : null;
      const tier = String(user?.tier || 'free').toLowerCase();
      const base = getProjectBasePath();
      
      let finalTarget = defaultPath || base + "index.html";
      
      // Smart redirect based on role
      if (!defaultPath) {
        if (role === "buyer" && tier === "pro") {
          finalTarget = base + "pages/buyer/Dashboard/Dashboard1.html";
        }
      }

      if (window.navigateWithTransition) window.navigateWithTransition(finalTarget); 
      else window.location.href = finalTarget;
    },

    logout() {
      if (window.api && window.api.clearAuth) {
        window.api.clearAuth();
      }
      sessionStorage.removeItem(REDIRECT_KEY);
      const base = getProjectBasePath();
      if (window.navigateWithTransition) window.navigateWithTransition(base + "index.html"); 
      else window.location.href = base + "index.html";
    }
  };
})();
