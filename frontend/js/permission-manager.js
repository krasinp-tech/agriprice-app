/**
 * permission-manager.js - AgriPrice native permission manager.
 * Requests OS permissions on demand and always checks the current native state
 * before trusting cached denial flags.
 */
(function () {
  'use strict';

  if (window.AgriPermission) return;

  const isNative = () => {
    const cap = window.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    const platform = typeof cap.getPlatform === 'function' ? cap.getPlatform() : '';
    return platform === 'android' || platform === 'ios' || !!cap.isNative;
  };

  const getPlugin = (name) => window.Capacitor?.Plugins?.[name] || null;
  const isGranted = (value) => value === true || value === 'granted';

  const PREF_KEY = 'agri_perm_v3';
  const getPrefs = () => {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (_) { return {}; }
  };
  const setPref = (key, value) => {
    const prefs = getPrefs();
    prefs[key] = value;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (_) {}
  };

  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;

  function toast(message) {
    if (window.showToast) {
      window.showToast(message, 'info');
      return;
    }

    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;z-index:99998;box-shadow:0 8px 24px rgba(0,0,0,.25);';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function locationSettingsToast() {
    toast(t('permission_location_toast', 'Please enable location permission in device settings'));
  }

  function cameraSettingsToast() {
    toast(t('permission_camera_toast', 'Please enable camera permission in device settings'));
  }

  async function requestLocation() {
    const prefs = getPrefs();

    if (isNative()) {
      const Geo = getPlugin('Geolocation');
      if (!Geo) return { granted: false };

      try {
        const current = Geo.checkPermissions ? await Geo.checkPermissions() : {};
        const currentlyGranted = isGranted(current.location) || isGranted(current.coarseLocation);
        if (currentlyGranted) {
          setPref('loc_denied', false);
          const position = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
          return { granted: true, position };
        }

        const result = Geo.requestPermissions
          ? await Geo.requestPermissions({ permissions: ['location'] })
          : {};
        const granted = isGranted(result.location) || isGranted(result.coarseLocation);
        setPref('loc_denied', !granted);

        if (!granted) {
          locationSettingsToast();
          return { granted: false };
        }

        const position = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
        return { granted: true, position };
      } catch (_) {
        return { granted: false };
      }
    }

    if (prefs.loc_denied) {
      locationSettingsToast();
      return { granted: false };
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ granted: false });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPref('loc_denied', false);
          resolve({ granted: true, position });
        },
        (err) => {
          if (err.code === 1) setPref('loc_denied', true);
          resolve({ granted: false });
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    });
  }

  async function requestNotification() {
    const prefs = getPrefs();

    if (isNative()) {
      const LocalNotifications = getPlugin('LocalNotifications');
      const PushNotifications = getPlugin('PushNotifications');
      if (!LocalNotifications && !PushNotifications) return { granted: false };

      try {
        let localGranted = false;
        if (LocalNotifications) {
          const current = LocalNotifications.checkPermissions ? await LocalNotifications.checkPermissions() : {};
          localGranted = isGranted(current.display);
          if (!localGranted && LocalNotifications.requestPermissions) {
            const result = await LocalNotifications.requestPermissions();
            localGranted = isGranted(result.display);
          }
        }

        let pushGranted = false;
        if (PushNotifications) {
          const current = PushNotifications.checkPermissions ? await PushNotifications.checkPermissions() : {};
          pushGranted = isGranted(current.receive);
          if (!pushGranted && PushNotifications.requestPermissions) {
            const result = await PushNotifications.requestPermissions();
            pushGranted = isGranted(result.receive);
          }
        }

        const granted = PushNotifications ? pushGranted : localGranted;
        setPref('notif_denied', !granted);
        return { granted, localGranted, pushGranted };
      } catch (_) {
        return { granted: false };
      }
    }

    if (!('Notification' in window)) return { granted: false };
    if (Notification.permission === 'granted') {
      setPref('notif_denied', false);
      return { granted: true };
    }
    if (Notification.permission === 'denied' || prefs.notif_denied) {
      setPref('notif_denied', true);
      return { granted: false };
    }

    const result = await Notification.requestPermission();
    setPref('notif_denied', result === 'denied');
    return { granted: result === 'granted' };
  }

  async function requestCamera() {
    const prefs = getPrefs();

    if (isNative()) {
      const Camera = getPlugin('Camera');
      if (!Camera) return { granted: false };

      try {
        const current = Camera.checkPermissions ? await Camera.checkPermissions() : {};
        if (isGranted(current.camera)) {
          setPref('cam_denied', false);
          return { granted: true };
        }

        const result = Camera.requestPermissions
          ? await Camera.requestPermissions({ permissions: ['camera'] })
          : {};
        const granted = isGranted(result.camera);
        setPref('cam_denied', !granted);

        if (!granted) cameraSettingsToast();
        return { granted };
      } catch (_) {
        return { granted: false };
      }
    }

    if (prefs.cam_denied) {
      cameraSettingsToast();
      return { granted: false };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      setPref('cam_denied', false);
      return { granted: true };
    } catch (_) {
      setPref('cam_denied', true);
      return { granted: false };
    }
  }

  window.AgriPermission = {
    requestLocation,
    requestNotification,
    requestCamera,
    getPrefs,
    isNative,
  };
})();
