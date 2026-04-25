/**
 * permission-manager.js — AgriPrice Pure Native Permission v3
 *
 * ตัด Custom UI ออกทั้งหมด และเรียกใช้ Native System Dialog โดยตรง
 */
(function () {
  'use strict';

  if (window.AgriPermission) return; 

  const isNative = () => !!(window.Capacitor && window.Capacitor.isNative);
  const getPlugin = (name) => window.Capacitor?.Plugins?.[name] || null;

  const PREF_KEY = 'agri_perm_v3';
  const getPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; } };
  const setPref  = (k, v) => { const p = getPrefs(); p[k] = v; try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (_) {} };

  function toast(msg) {
    if (window.appNotify) { window.appNotify(msg, 'info'); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ════════════════════════════════════════════
     1. GPS / Location (Direct Native Call)
  ════════════════════════════════════════════ */
  async function requestLocation(options = {}) {
    if (isNative()) {
      const Geo = getPlugin('Geolocation');
      if (!Geo) return { granted: false };
      try {
        const result = await Geo.requestPermissions({ permissions: ['location'] });
        const granted = result.location === 'granted';
        if (granted) {
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
          return { granted: true, position: pos };
        }
        return { granted: false };
      } catch (e) { return { granted: false }; }
    }
    // Browser fallback
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ granted: false });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ granted: true, position: pos }),
        () => resolve({ granted: false }),
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  /* ════════════════════════════════════════════
     2. Notifications (Direct Native Call)
  ════════════════════════════════════════════ */
  async function requestNotification() {
    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (!Notif) return { granted: false };
      try {
        const result = await Notif.requestPermissions();
        const granted = result.display === 'granted';
        return { granted };
      } catch (e) { return { granted: false }; }
    }
    if (!('Notification' in window)) return { granted: false };
    const res = await Notification.requestPermission();
    return { granted: res === 'granted' };
  }

  /* ════════════════════════════════════════════
     3. Camera (Direct Native Call)
  ════════════════════════════════════════════ */
  async function requestCamera() {
    if (isNative()) {
      const Cam = getPlugin('Camera');
      if (!Cam) return { granted: false };
      try {
        const result = await Cam.requestPermissions({ permissions: ['camera', 'photos'] });
        return { granted: result.camera === 'granted' || result.photos === 'granted' };
      } catch (e) { return { granted: false }; }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      return { granted: true };
    } catch (e) { return { granted: false }; }
  }

  async function requestAll() {
    await requestLocation();
    await requestNotification();
  }

  async function showNotification(title, body, extras = {}) {
    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (Notif) {
        try {
          await Notif.schedule({
            notifications: [{ title, body, id: Date.now(), schedule: { at: new Date(Date.now() + 100) }, ...extras }]
          });
        } catch (_) {}
      }
    } else if (Notification.permission === 'granted') {
      new Notification(title, { body, ...extras });
    }
  }

  window.AgriPermission = {
    requestLocation,
    requestNotification,
    showNotification,
    requestCamera,
    requestAll,
    getPrefs,
    isNative,
  };
})();
