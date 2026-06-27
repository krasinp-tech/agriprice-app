(function() {
  "use strict";

  const api = window.api || {};

  async function registerPush() {
    try {
      // Simplified: Assume Capacitor or similar plugin is used
      const token = "mock_push_token_" + Math.random().toString(36).slice(2);
      
      if (api.updatePushToken) {
        await api.updatePushToken(token);
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const authToken = localStorage.getItem('token');
        if (!authToken) return;
        
        await fetch(currentBase + '/api/notifications/push-token', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      }
      console.log('[Push] Token registered');
    } catch (err) {
      console.error('[Push] Registration failed:', err);
    }
  }

  window.AgriPushManager = {
    forceRegister: registerPush
  };
})();
