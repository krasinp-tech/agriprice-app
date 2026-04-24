/**
 * permission-manager.js — AgriPrice Native Permission UI v2
 *
 * ใช้ Capacitor Plugin API เมื่อรันบน native Android/iOS
 * Fallback ไปที่ browser API เฉพาะเมื่อทดสอบบน browser (dev mode)
 *
 * Capacitor plugins ที่ต้องติดตั้ง:
 *   @capacitor/geolocation
 *   @capacitor/camera
 *   @capacitor/local-notifications
 *
 * Usage:
 *   AgriPermission.requestLocation()        // GPS
 *   AgriPermission.requestNotification()    // Notifications
 *   AgriPermission.requestCamera()          // Camera / Gallery
 */
(function () {
  'use strict';

  if (window.AgriPermission) return; // singleton guard

  /* ────────────────────────────────────────────
     ตรวจว่ารันบน native (Capacitor) หรือเปล่า
  ──────────────────────────────────────────── */
  const isNative = () =>
    !!(window.Capacitor && window.Capacitor.isNative);

  /* ────────────────────────────────────────────
     CSS (inject once) — bottom-sheet UI
  ──────────────────────────────────────────── */
  const STYLE_ID = 'agri-perm-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .agri-perm-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(15, 23, 42, 0.52);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0 0 env(safe-area-inset-bottom, 12px) 0;
        opacity: 0;
        transition: opacity 0.22s ease;
        pointer-events: none;
      }
      .agri-perm-overlay.show {
        opacity: 1;
        pointer-events: auto;
      }
      .agri-perm-sheet {
        width: min(96vw, 420px);
        background: #ffffff;
        border-radius: 24px 24px 20px 20px;
        padding: 28px 24px 24px;
        box-shadow: 0 -2px 40px rgba(15,23,42,0.16);
        transform: translateY(48px);
        transition: transform 0.30s cubic-bezier(0.22, 1, 0.36, 1);
        margin-bottom: 8px;
      }
      .agri-perm-overlay.show .agri-perm-sheet {
        transform: translateY(0);
      }
      .agri-perm-drag-handle {
        width: 40px;
        height: 4px;
        background: #e2e8f0;
        border-radius: 2px;
        margin: -14px auto 20px;
      }
      .agri-perm-icon-wrap {
        width: 68px;
        height: 68px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 18px;
        font-size: 34px;
      }
      .agri-perm-icon-wrap.location  { background: linear-gradient(135deg,#e8f5e9,#c8e6c9); }
      .agri-perm-icon-wrap.notify    { background: linear-gradient(135deg,#e3f2fd,#bbdefb); }
      .agri-perm-icon-wrap.camera    { background: linear-gradient(135deg,#fce4ec,#f8bbd9); }
      .agri-perm-title {
        font-family: 'Inter', sans-serif;
        font-size: 19px;
        font-weight: 700;
        color: #0f172a;
        text-align: center;
        margin: 0 0 10px;
        line-height: 1.3;
      }
      .agri-perm-desc {
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        color: #475569;
        text-align: center;
        line-height: 1.7;
        margin: 0 0 10px;
      }
      .agri-perm-desc strong { color: #0f172a; font-weight: 600; }
      .agri-perm-hint {
        font-size: 12px;
        color: #94a3b8;
        text-align: center;
        margin: 0 0 22px;
        line-height: 1.5;
      }
      .agri-perm-actions {
        display: flex;
        gap: 10px;
      }
      .agri-perm-btn {
        flex: 1;
        min-height: 50px;
        border-radius: 14px;
        border: none;
        font-family: 'Inter', 'Sarabun', sans-serif;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.12s ease, opacity 0.12s ease;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
      }
      .agri-perm-btn:active { transform: scale(0.97); opacity: 0.88; }
      .agri-perm-btn.deny  { background: #f1f5f9; color: #64748b; }
      .agri-perm-btn.allow {
        background: linear-gradient(135deg, #0B853C 0%, #16a34a 100%);
        color: #fff;
        box-shadow: 0 4px 16px rgba(11,133,60,0.30);
      }
      .agri-perm-btn.allow-notify {
        background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%);
        color: #fff;
        box-shadow: 0 4px 16px rgba(21,101,192,0.30);
      }
      .agri-perm-btn.allow-camera {
        background: linear-gradient(135deg, #b71c1c 0%, #e53935 100%);
        color: #fff;
        box-shadow: 0 4px 16px rgba(183,28,28,0.28);
      }
    `;
    document.head.appendChild(style);
  }

  /* ────────────────────────────────────────────
     Helper: bottom-sheet UI
  ──────────────────────────────────────────── */
  function showSheet(config) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'agri-perm-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');

      overlay.innerHTML = `
        <div class="agri-perm-sheet">
          <div class="agri-perm-drag-handle"></div>
          <div class="agri-perm-icon-wrap ${config.iconClass}">${config.icon}</div>
          <h2 class="agri-perm-title">${config.title}</h2>
          <p class="agri-perm-desc">${config.desc}</p>
          ${config.hint ? `<p class="agri-perm-hint">${config.hint}</p>` : ''}
          <div class="agri-perm-actions">
            <button class="agri-perm-btn deny" id="agriPermDeny" type="button">ไม่อนุญาต</button>
            <button class="agri-perm-btn allow ${config.allowClass || ''}" id="agriPermAllow" type="button">${config.allowLabel || 'อนุญาต'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));

      function close(allowed) {
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); resolve(allowed); }, 300);
      }

      overlay.querySelector('#agriPermDeny').addEventListener('click', () => close(false));
      overlay.querySelector('#agriPermAllow').addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    });
  }

  /* ────────────────────────────────────────────
     localStorage preference
  ──────────────────────────────────────────── */
  const PREF_KEY = 'agri_perm_v2';
  const getPrefs = () => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; } };
  const setPref  = (k, v) => { const p = getPrefs(); p[k] = v; try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (_) {} };

  /* ────────────────────────────────────────────
     Toast helper
  ──────────────────────────────────────────── */
  function toast(msg, type) {
    if (window.appNotify) { window.appNotify(msg, type || 'info'); return; }
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;z-index:99998;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:Inter,sans-serif;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ────────────────────────────────────────────
     Capacitor plugin lazy-loader
  ──────────────────────────────────────────── */
  const getPlugin = (name) => window.Capacitor?.Plugins?.[name] || null;

  /* ════════════════════════════════════════════
     1. GPS / Location
  ════════════════════════════════════════════ */
  async function requestLocation(options = {}) {
    const prefs = getPrefs();

    // ─── Native (Capacitor) ───────────────────
    if (isNative()) {
      const Geo = getPlugin('Geolocation');
      if (!Geo) return { granted: false, reason: 'plugin_missing' };

      // ตรวจสถานะก่อน
      try {
        const status = await Geo.checkPermissions();
        if (status.location === 'granted') {
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
          return { granted: true, position: pos };
        }
        if (status.location === 'denied' && !options.force) {
          toast('⚙️ กรุณาเปิดสิทธิ์ตำแหน่งในการตั้งค่าแอป', 'info');
          return { granted: false, reason: 'native_denied' };
        }
      } catch (_) {}

      // แสดง pre-permission UI ก่อน
      const allowed = await showSheet({
        iconClass: 'location', icon: '📍',
        title: 'อนุญาตเข้าถึงตำแหน่ง?',
        desc: '<strong>AGRIPRICE</strong> ต้องการตำแหน่งของคุณเพื่อแสดงผู้รับซื้อใกล้เคียงและเรียงลำดับตามระยะทาง',
        hint: 'ตำแหน่งของคุณใช้ภายในแอปเท่านั้น ไม่ถูกส่งออกไปภายนอก',
        allowClass: 'allow', allowLabel: '✓ อนุญาต',
      });

      if (!allowed) { setPref('location', 'denied'); return { granted: false, reason: 'user_denied' }; }

      // Request native permission
      try {
        const result = await Geo.requestPermissions({ permissions: ['location'] });
        if (result.location === 'granted') {
          setPref('location', 'granted');
          const pos = await Geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
          return { granted: true, position: pos };
        }
        toast('⚙️ กรุณาเปิดสิทธิ์ตำแหน่งในการตั้งค่าแอป', 'info');
        setPref('location', 'denied');
        return { granted: false, reason: 'native_denied' };
      } catch (e) {
        return { granted: false, reason: 'error', error: e };
      }
    }

    // ─── Browser fallback (dev only) ──────────
    if (prefs.location === 'denied' && !options.force) return { granted: false, reason: 'user_denied' };

    const allowed = await showSheet({
      iconClass: 'location', icon: '📍',
      title: 'อนุญาตเข้าถึงตำแหน่ง?',
      desc: '<strong>AGRIPRICE</strong> ต้องการตำแหน่งของคุณเพื่อแสดงผู้รับซื้อใกล้เคียง',
      hint: '', allowClass: 'allow', allowLabel: '✓ อนุญาต',
    });

    if (!allowed) { setPref('location', 'denied'); return { granted: false, reason: 'user_denied' }; }

    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve({ granted: false, reason: 'not_supported' }); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => { setPref('location', 'granted'); resolve({ granted: true, position: pos }); },
        () => { setPref('location', 'denied'); resolve({ granted: false, reason: 'denied' }); },
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  /* ════════════════════════════════════════════
     2. Notifications
  ════════════════════════════════════════════ */
  async function requestNotification(options = {}) {
    const prefs = getPrefs();

    // ─── Native (Capacitor) ───────────────────
    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (!Notif) return { granted: false, reason: 'plugin_missing' };

      try {
        const status = await Notif.checkPermissions();
        if (status.display === 'granted') return { granted: true, reason: 'already_granted' };
        if (status.display === 'denied' && !options.force) {
          toast('⚙️ กรุณาเปิดการแจ้งเตือนในการตั้งค่าแอป', 'info');
          return { granted: false, reason: 'native_denied' };
        }
      } catch (_) {}

      if (prefs.notification === 'denied' && !options.force) return { granted: false, reason: 'user_denied' };

      const allowed = await showSheet({
        iconClass: 'notify', icon: '🔔',
        title: 'เปิดรับการแจ้งเตือน?',
        desc: '<strong>AGRIPRICE</strong> จะแจ้งเตือนเมื่อมีการจองใหม่ ข้อความใหม่ หรืออัปเดตราคาสินค้าสำคัญ',
        hint: 'ปิดได้ตลอดเวลาที่ การตั้งค่า → แจ้งเตือน',
        allowClass: 'allow allow-notify', allowLabel: '🔔 เปิดแจ้งเตือน',
      });

      if (!allowed) { setPref('notification', 'denied'); return { granted: false, reason: 'user_denied' }; }

      try {
        const result = await Notif.requestPermissions();
        const granted = result.display === 'granted';
        setPref('notification', granted ? 'granted' : 'denied');
        if (!granted) toast('⚙️ กรุณาเปิดการแจ้งเตือนในการตั้งค่าแอป', 'info');
        return { granted, reason: granted ? 'granted' : 'native_denied' };
      } catch (e) {
        return { granted: false, reason: 'error', error: e };
      }
    }

    // ─── Browser fallback (dev only) ──────────
    if (!('Notification' in window)) return { granted: false, reason: 'not_supported' };
    if (Notification.permission === 'granted') return { granted: true, reason: 'already_granted' };
    if (prefs.notification === 'denied' && !options.force) return { granted: false, reason: 'user_denied' };

    const allowed = await showSheet({
      iconClass: 'notify', icon: '🔔',
      title: 'เปิดรับการแจ้งเตือน?',
      desc: '<strong>AGRIPRICE</strong> จะแจ้งเตือนเมื่อมีการจองใหม่และข้อความใหม่',
      hint: '', allowClass: 'allow allow-notify', allowLabel: '🔔 เปิดแจ้งเตือน',
    });

    if (!allowed) { setPref('notification', 'denied'); return { granted: false, reason: 'user_denied' }; }

    try {
      const r = await Notification.requestPermission();
      const granted = r === 'granted';
      setPref('notification', granted ? 'granted' : 'denied');
      return { granted };
    } catch (e) {
      return { granted: false, reason: 'error', error: e };
    }
  }

  /* ════════════════════════════════════════════
     3. Camera / Gallery
  ════════════════════════════════════════════ */
  async function requestCamera(options = {}) {
    const prefs = getPrefs();

    // ─── Native (Capacitor) ───────────────────
    if (isNative()) {
      const Cam = getPlugin('Camera');
      if (!Cam) return { granted: false, reason: 'plugin_missing' };

      try {
        const status = await Cam.checkPermissions();
        const camOk = status.camera === 'granted';
        const galOk = status.photos === 'granted';
        if (camOk && galOk) return { granted: true, reason: 'already_granted' };
      } catch (_) {}

      if (prefs.camera === 'denied' && !options.force) {
        toast('⚙️ กรุณาเปิดสิทธิ์กล้องในการตั้งค่าแอป', 'info');
        return { granted: false, reason: 'user_denied' };
      }

      const allowed = await showSheet({
        iconClass: 'camera', icon: '📷',
        title: 'อนุญาตใช้งานกล้อง?',
        desc: '<strong>AGRIPRICE</strong> ต้องการเข้าถึงกล้องและคลังรูปภาพ เพื่อให้คุณถ่ายและส่งรูปภาพ',
        hint: '',
        allowClass: 'allow allow-camera', allowLabel: '📷 อนุญาต',
      });

      if (!allowed) { setPref('camera', 'denied'); return { granted: false, reason: 'user_denied' }; }

      try {
        const result = await Cam.requestPermissions({ permissions: ['camera', 'photos'] });
        const granted = result.camera === 'granted' || result.photos === 'granted';
        setPref('camera', granted ? 'granted' : 'denied');
        if (!granted) toast('⚙️ กรุณาเปิดสิทธิ์กล้องในการตั้งค่าแอป', 'info');
        return { granted };
      } catch (e) {
        return { granted: false, reason: 'error', error: e };
      }
    }

    // ─── Browser fallback (dev only) ──────────
    if (prefs.camera === 'denied' && !options.force) {
      toast('⚙️ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์', 'info');
      return { granted: false, reason: 'user_denied' };
    }

    const allowed = await showSheet({
      iconClass: 'camera', icon: '📷',
      title: 'อนุญาตใช้งานกล้อง?',
      desc: '<strong>AGRIPRICE</strong> ต้องการเข้าถึงกล้องเพื่อส่งรูปภาพ',
      hint: '', allowClass: 'allow allow-camera', allowLabel: '📷 อนุญาต',
    });

    if (!allowed) { setPref('camera', 'denied'); return { granted: false, reason: 'user_denied' }; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setPref('camera', 'granted');
      return { granted: true };
    } catch (e) {
      setPref('camera', 'denied');
      return { granted: false, reason: 'denied', error: e };
    }
  }

  /* ════════════════════════════════════════════
     4. Request All (onboarding)
  ════════════════════════════════════════════ */
  async function requestAll() {
    const loc = await requestLocation();
    const prefs = getPrefs();
    if (!prefs.notification) {
      await new Promise(r => setTimeout(r, 600));
      await requestNotification();
    }
    return { location: loc };
  }

  async function showNotification(title, body, extras = {}) {
    if (isNative()) {
      const Notif = getPlugin('LocalNotifications');
      if (Notif) {
        try {
          await Notif.schedule({
            notifications: [
              {
                title: title,
                body: body,
                id: new Date().getTime(),
                schedule: { at: new Date(Date.now() + 100) },
                ...extras
              }
            ]
          });
        } catch (_) {}
      }
    } else {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body, ...extras });
      }
    }
  }

  /* ────────────────────────────────────────────
     Export
  ──────────────────────────────────────────── */
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
