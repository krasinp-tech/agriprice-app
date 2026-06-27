(function() {
  "use strict";

  const api = window.api || {};

  async function loadSettings() {
    try {
      let responseData;
      if (api.getNotificationSettings) {
        responseData = await api.getNotificationSettings();
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem('token');
        const res = await fetch(currentBase + "/api/notification-settings", {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        responseData = await res.json();
      }
      
      const s = responseData?.data || responseData?.settings || responseData;
      
      const pushBookingEl = document.getElementById('pushBooking');
      const pushChatEl = document.getElementById('pushChat');
      const emailNewsEl = document.getElementById('emailNews');
      const pushSystemEl = document.getElementById('pushSystem');

      if (s) {
        // Dual-key strategy: check both user-saved settings keys and backend default keys
        const bookingVal = s.push_booking !== undefined ? s.push_booking : (s.booking !== undefined ? s.booking : true);
        const chatVal = s.push_chat !== undefined ? s.push_chat : (s.chat !== undefined ? s.chat : true);
        const emailVal = s.email_news !== undefined ? s.email_news : (s.promo !== undefined ? s.promo : false);
        const systemVal = s.push_system !== undefined ? s.push_system : (s.system !== undefined ? s.system : true);

        if (pushBookingEl) pushBookingEl.checked = !!bookingVal;
        if (pushChatEl) pushChatEl.checked = !!chatVal;
        if (emailNewsEl) emailNewsEl.checked = !!emailVal;
        if (pushSystemEl) pushSystemEl.checked = !!systemVal;
      }

      // Add auto-save listeners on change
      [pushBookingEl, pushChatEl, emailNewsEl, pushSystemEl].forEach(el => {
        el?.addEventListener('change', saveSettings);
      });
    } catch (err) {
      console.error('[NotifySettings] Load failed:', err);
    }
  }

  async function saveSettings() {
    const pushBooking = document.getElementById('pushBooking')?.checked || false;
    const pushChat = document.getElementById('pushChat')?.checked || false;
    const emailNews = document.getElementById('emailNews')?.checked || false;
    const pushSystem = document.getElementById('pushSystem')?.checked || false;

    // Build settings with both client-side and server-side keys
    const settings = {
      // Client-side keys
      push_booking: pushBooking,
      push_chat: pushChat,
      email_news: emailNews,
      push_system: pushSystem,
      // Server-side database keys
      booking: pushBooking,
      chat: pushChat,
      promo: emailNews,
      system: pushSystem
    };

    try {
      if (api.saveNotificationSettings) {
        const role = api.getRole ? api.getRole() : (localStorage.getItem('role') || 'user');
        await api.saveNotificationSettings(settings, role);
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role') || 'user';
        await fetch(currentBase + "/api/notification-settings", {
          method: 'PATCH',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings, role })
        });
      }
      
      const successMsg = window.i18nT ? window.i18nT('save_success', 'บันทึกการตั้งค่าแล้ว') : 'บันทึกการตั้งค่าแล้ว';
      if (window.showToast) {
        window.showToast(successMsg, 'success');
      }
    } catch (err) {
      console.error('[NotifySettings] Save failed:', err);
      const errorMsg = window.i18nT ? window.i18nT('error_occurred', 'ไม่สามารถบันทึกได้') : 'ไม่สามารถบันทึกได้';
      if (window.showToast) {
        window.showToast(errorMsg, 'error');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
  });
})();
