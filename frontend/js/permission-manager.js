/**
 * permission-manager.js — AgriPrice Pure Native Permission v3
 * Refactored to call Native OS Dialogs directly (No Soft Prompts).
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
    if (window.showToast) { window.showToast(msg, 'info'); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  const t_helper = (k, f) => window.i18nT ? window.i18nT(k, f) : f;

  /* ════════════════════════════════════════════
     1. GPS / Location
  ════════════════════════════════════════════ */
  async function requestLocation() {
    const prefs = getPrefs();
    if (prefs.loc_denied) {
      toast(t_helper('permission_location_toast', 'กรุณาเปิดสิทธิ์ตำแหน่งในการตั้งค่าเครื่อง'));
      return { granted: false };
    }

    if (isNative()) {
      const Geo = getPlugin('Geolocation');
      if (!Geo) return { granted: false };
      try {
        const perm = await Geo.checkPermissions();
        if (perm.location === 'granted') {
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
          return { granted: true, position: pos };
        }
        
        // Trigger Native OS Dialog directly
        const result = await Geo.requestPermissions({ permissions: ['location'] });
        const granted = result.location === 'granted';
        setPref('loc_denied', !granted);
        if (granted) {
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
          return { granted: true, position: pos };
        }
        return { granted: false };
      } catch (e) { return { granted: false }; }
    }
    
    // Browser fallback
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ granted: false });
      navigator.geolocation.getCurrentPosition(
        (pos) => { setPref('loc_denied', false); resolve({ granted: true, position: pos }); },
        (err) => { if (err.code === 1) setPref('loc_denied', true); resolve({ granted: false }); },
        { timeout: 5000, maximumAge: 300000 }
      );
    });
  }

  /* ════════════════════════════════════════════
     2. Notifications
  ════════════════════════════════════════════ */
  async function requestNotification() {
    const prefs = getPrefs();
    if (prefs.notif_denied) return { granted: false };

    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (!Notif) return { granted: false };
      try {
        // Trigger Native OS Dialog directly
        const result = await Notif.requestPermissions();
        const granted = result.display === 'granted';
        setPref('notif_denied', !granted);
        return { granted };
      } catch (e) { return { granted: false }; }
    }
    
    if (!('Notification' in window)) return { granted: false };
    const res = await Notification.requestPermission();
    setPref('notif_denied', res === 'denied');
    return { granted: res === 'granted' };
  }

  /* ════════════════════════════════════════════
     3. Camera
  ════════════════════════════════════════════ */
  async function requestCamera() {
    const prefs = getPrefs();
    if (prefs.cam_denied) {
      toast(t_helper('permission_camera_toast', 'กรุณาเปิดสิทธิ์กล้องถ่ายรูปในการตั้งค่าเครื่อง'));
      return { granted: false };
    }

    if (isNative()) {
      const Cam = getPlugin('Camera');
      if (!Cam) return { granted: false };
      try {
        // Trigger Native OS Dialog directly
        const result = await Cam.requestPermissions({ permissions: ['camera'] });
        const granted = result.camera === 'granted';
        setPref('cam_denied', !granted);
        return { granted };
      } catch (e) { return { granted: false }; }
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setPref('cam_denied', false);
      return { granted: true };
    } catch (e) { 
        setPref('cam_denied', true);
        return { granted: false }; 
    }
  }

  window.AgriPermission = {
    requestLocation,
    requestNotification,
    requestCamera,
    getPrefs,
    isNative
  };
})();
