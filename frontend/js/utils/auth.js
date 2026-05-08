/**
 * AGRIPRICE - Auth Utilities
 * Shared logic for session, role and token management.
 */
(function() {
  "use strict";

  const Auth = {
    /**
     * Get current user role
     * @returns {string} 'buyer', 'farmer', 'admin', or 'guest'
     */
    getRole() {
      try {
        const role = localStorage.getItem(window.STORAGE_KEYS?.ROLE || 'role');
        return String(role || 'guest').toLowerCase();
      } catch (err) {
        if (window.AGRIPRICE_DEBUG) console.warn('[Auth]', 'Error getting role:', err);
        return 'guest';
      }
    },

    /**
     * Get auth token
     * @returns {string|null}
     */
    getToken() {
      try {
        return localStorage.getItem(window.STORAGE_KEYS?.TOKEN || 'token');
      } catch (err) {
        if (window.AGRIPRICE_DEBUG) console.warn('[Auth]', 'Error getting token:', err);
        return null;
      }
    },

    /**
     * Check if user is logged in
     * @returns {boolean}
     */
    isLoggedIn() {
      return !!this.getToken() && this.getRole() !== 'guest';
    },

    /**
     * Clear session and redirect to login
     */
    logout(redirect = true) {
      try {
        const keys = window.STORAGE_KEYS || {
          TOKEN: 'token',
          ROLE: 'role',
          USER_DATA: 'user_data'
        };

        localStorage.removeItem(keys.TOKEN);
        localStorage.removeItem(keys.ROLE);
        localStorage.removeItem(keys.USER_DATA);
        // keep theme for UX
        
        if (redirect) {
          // Calculate project base path to redirect to index.html correctly
          const path = window.location.pathname;
          const pagesIdx = path.indexOf("/pages/");
          const base = pagesIdx !== -1 ? path.substring(0, pagesIdx + 1) : "/";
          window.location.href = base + "index.html";
        }
      } catch (err) {
        if (window.AGRIPRICE_DEBUG) console.error('[Auth]', 'Logout failed:', err);
      }
    }
  };

  // Export
  window.Auth = Auth;
})();
