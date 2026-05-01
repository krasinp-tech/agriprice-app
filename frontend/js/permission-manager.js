/**
 * permission-manager.js — AgriPrice Pure Native Permission v3
 * 
 * [Mobile Feature] ไฟล์นี้จัดการเรื่องการขอสิทธิ์เข้าถึง (Permissions) บนมือถือทั้งหมด
 * เช่น GPS, กล้องถ่ายรูป, และแจ้งเตือน
 * จุดเด่น: 
 * 1. เรียกใช้ Native System Dialog (ของ iOS/Android) ได้โดยตรงผ่าน Capacitor
 * 2. มีระบบ "Deny Memory" จำได้ว่าผู้ใช้เคยกดปฏิเสธไปแล้ว จะไม่เด้งกวนใจซ้ำอีก (UX Best Practice)
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
     1. GPS / Location (หาตำแหน่งพิกัดเพื่อจัดเรียงใกล้สุด)
  ════════════════════════════════════════════ */
  async function requestLocation(options = {}) {
    const prefs = getPrefs();
    
    // หากเคยปฏิเสธไปแล้ว จะไม่เด้งถามอีก (Deny Memory)
    if (prefs.loc_denied) return { granted: false };

    // กรณีรันเป็นแอปบนมือถือจริงๆ (Native Capacitor)
    if (isNative()) {
      const Geo = getPlugin('Geolocation');
      if (!Geo) return { granted: false };
      try {
        // เช็คสิทธิ์ปัจจุบันก่อนว่าเคยอนุญาตไว้แล้วหรือไม่
        const perm = await Geo.checkPermissions();
        if (perm.location === 'granted') {
          // ถ้ามีสิทธิ์แล้ว ดึงพิกัด (Lat, Lng) มาใช้งานทันที
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
          return { granted: true, position: pos };
        }
        if (perm.location === 'denied') {
          setPref('loc_denied', true);
          return { granted: false };
        }

        // กรณีต้องขอสิทธิ์ใหม่จาก OS
        const result = await Geo.requestPermissions({ permissions: ['location'] });
        const granted = result.location === 'granted';
        if (granted) {
          setPref('loc_denied', false);
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
          return { granted: true, position: pos };
        } else {
          setPref('loc_denied', true); // จำว่าผู้ใช้ปฏิเสธ
          return { granted: false };
        }
      } catch (e) { return { granted: false }; }
    }
    
    // กรณีรันบนเว็บ (Browser Fallback) PWA
    if (navigator.permissions) {
       try {
         const perm = await navigator.permissions.query({ name: 'geolocation' });
         if (perm.state === 'denied') {
            setPref('loc_denied', true);
            return { granted: false };
         }
       } catch(e) {}
    }
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ granted: false });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
            setPref('loc_denied', false);
            resolve({ granted: true, position: pos });
        },
        (err) => {
            // Error code 1 = PERMISSION_DENIED
            if (err.code === 1) {
                setPref('loc_denied', true);
            }
            resolve({ granted: false });
        },
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  /* ════════════════════════════════════════════
     2. Notifications (แจ้งเตือนสถานะคิว)
  ════════════════════════════════════════════ */
  async function requestNotification() {
    const prefs = getPrefs();
    if (prefs.notif_denied) return { granted: false };

    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (!Notif) return { granted: false };
      try {
        const perm = await Notif.checkPermissions();
        if (perm.display === 'granted') return { granted: true };
        if (perm.display === 'denied') {
            setPref('notif_denied', true);
            return { granted: false };
        }

        const result = await Notif.requestPermissions();
        const granted = result.display === 'granted';
        if (!granted) setPref('notif_denied', true);
        else setPref('notif_denied', false);
        return { granted };
      } catch (e) { return { granted: false }; }
    }
    
    if (!('Notification' in window)) return { granted: false };
    if (Notification.permission === 'denied') {
        setPref('notif_denied', true);
        return { granted: false };
    }
    const res = await Notification.requestPermission();
    if (res === 'denied') setPref('notif_denied', true);
    else setPref('notif_denied', false);
    return { granted: res === 'granted' };
  }

  /* ════════════════════════════════════════════
     3. Camera (ขอสิทธิ์กล้องเพื่อใช้แสกน QR Code)
  ════════════════════════════════════════════ */
  async function requestCamera() {
    const prefs = getPrefs();
    if (prefs.cam_denied) return { granted: false };

    if (isNative()) {
      const Cam = getPlugin('Camera');
      if (!Cam) return { granted: false };
      try {
        const perm = await Cam.checkPermissions();
        if (perm.camera === 'granted' || perm.photos === 'granted') return { granted: true };
        if (perm.camera === 'denied' && perm.photos === 'denied') {
            setPref('cam_denied', true);
            return { granted: false };
        }

        const result = await Cam.requestPermissions({ permissions: ['camera', 'photos'] });
        const granted = result.camera === 'granted' || result.photos === 'granted';
        if (!granted) setPref('cam_denied', true);
        else setPref('cam_denied', false);
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
