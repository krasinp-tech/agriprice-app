// Global animation helper for fade-slide and modal-fade
/**
 * [Frontend Logic] ไฟล์ควบคุมพฤติกรรมของแอป (App-like Behavior)
 * ทำให้หน้าเว็บ HTML ทำตัวเหมือนแอปมือถือ (Native App) จริงๆ
 */
(function(){
  if (!window.__AGRIPRICE_APP_BEHAVIOR_READY) {
    try {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
    } catch (_) {}

    const setViewportVar = () => {
      const vh = (window.innerHeight || document.documentElement.clientHeight || 0) * 0.01;
      document.documentElement.style.setProperty('--app-vh', `${vh}px`);
    };

    setViewportVar();
    window.addEventListener('resize', setViewportVar, { passive: true });
    window.addEventListener('orientationchange', setViewportVar, { passive: true });

    const isEditableTarget = (target) => {
      if (!target || !target.closest) return false;
      return !!target.closest('input, textarea, [contenteditable="true"], .allow-select');
    };

    // [UX] ป้องกันไม่ให้ผู้ใช้กดค้างเพื่อ Copy/Select Text เหมือนหน้าเว็บปกติ (ยกเว้นช่องกรอกข้อความ)
    // ทำให้รู้สึกเหมือนกำลังกดแอปจริงๆ
    document.addEventListener('contextmenu', (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    });

    document.addEventListener('selectstart', (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    });

    document.addEventListener('copy', (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    });

    document.addEventListener('dragstart', (e) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    });

    // [UX] ป้องกันการซูมหน้าจอ (Zoom) ด้วยนิ้ว เพื่อไม่ให้ UI พังบน iOS
    // iOS gesture zoom prevention
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((evt) => {
      document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
    });

    // Multi-touch zoom prevention
    document.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });

    // Double-tap zoom prevention
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 280 && !isEditableTarget(e.target)) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });

    // Prevent browser zoom shortcuts (desktop/PWA keyboard)
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', 'c', 'x'].includes(e.key.toLowerCase()) && !isEditableTarget(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });

    const isPwaContext = () => {
      return !!(
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator?.standalone === true ||
        document.referrer.startsWith('android-app://')
      );
    };

    const isCordovaContext = () => !!window.cordova;
    const shouldForcePortrait = () => isPwaContext() || isCordovaContext();

    const isStrictRoute = () => {
      const path = String(window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
      return /\/pages\/(auth|account|buyer\/setbooking|farmer\/booking)\//.test(path);
    };

    // Best-effort portrait lock, only for PWA/Cordova runtime.
    const lockPortrait = async () => {
      if (!shouldForcePortrait()) return;
      try {
        if (window.screen?.orientation && typeof window.screen.orientation.lock === 'function') {
          await window.screen.orientation.lock('portrait-primary');
          return;
        }
      } catch (_) {}

      // Cordova fallback APIs (plugin-dependent)
      try {
        if (window.screen?.orientation?.lockToPortrait) {
          window.screen.orientation.lockToPortrait();
          return;
        }
      } catch (_) {}

      try {
        if (window.cordova?.plugins?.screenorientation?.lock) {
          window.cordova.plugins.screenorientation.lock('portrait');
        }
      } catch (_) {}
    };

    if (isCordovaContext()) {
      document.addEventListener('deviceready', () => {
        lockPortrait();
      }, { once: true });
    }

    lockPortrait();
    window.addEventListener('orientationchange', lockPortrait, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) lockPortrait();
    });

    if (shouldForcePortrait() && isStrictRoute()) {
      document.documentElement.classList.add('app-strict-mode');
    }

    document.documentElement.classList.add('app-like-mode');
    window.__AGRIPRICE_APP_BEHAVIOR_READY = true;
  }

  // [UX] ระบบ Page Transition เปลี่ยนหน้าจอแบบมี Animation เฟดเข้า-ออก
  if (!window.__AGRIPRICE_NATIVE_NAV_READY) {
    const LEAVE_MS = 180;

    window.navigateWithTransition = function navigateWithTransition(url, options = {}) {
      if (!url) return;
      const rawUrl = String(url);
      if (/^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) {
        window.location.href = rawUrl;
        return;
      }

      let nextUrl;
      try {
        nextUrl = new URL(rawUrl, window.location.href);
      } catch (_) {
        window.location.href = rawUrl;
        return;
      }

      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) {
        window.location.href = nextUrl.href;
        return;
      }

      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
        if (nextUrl.hash) window.location.hash = nextUrl.hash;
        return;
      }

      if (options.skipTransition) {
        window.location.href = nextUrl.href;
        return;
      }

      document.body.classList.remove('page-enter');
      document.body.classList.add('page-leave');
      window.setTimeout(() => {
        window.location.href = nextUrl.href;
      }, LEAVE_MS);
    };

    if (document.body) {
      document.body.classList.remove('page-leave');
      document.body.classList.add('page-enter');
      window.setTimeout(() => document.body.classList.remove('page-enter'), 260);
    }

    document.addEventListener('click', (e) => {
      if (e.defaultPrevented && !e.__agripriceHandled) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // [UX] Haptic Feedback: สั่นเบาๆ เมื่อผู้ใช้กดปุ่ม เพื่อให้รู้สึกเหมือนใช้แอป Native
      const isInteractive = e.target.closest('a[href], button, .menu-item, .card-actions, .bottom-nav-item, [data-action]');
      if (isInteractive && navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
      }

      const anchor = e.target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      e.preventDefault();
      window.navigateWithTransition(nextUrl.href);
    });

    window.__AGRIPRICE_NATIVE_NAV_READY = true;
  }

  function animateOnLoad() {
    document.querySelectorAll('.fade-slide').forEach(el => {
      if (!el.classList.contains('show')) {
        setTimeout(() => el.classList.add('show'), 60);
      }
    });
    document.querySelectorAll('.modal-fade').forEach(el => {
      // Modal will be shown/hidden by JS, so .show is handled elsewhere
      // This ensures modal-content animates when .show is toggled
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateOnLoad);
  } else {
    animateOnLoad();
  }

  // MutationObserver: trigger animation for new .fade-slide elements
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains('fade-slide')) {
            setTimeout(() => node.classList.add('show'), 60);
          }
          // Also check descendants
          node.querySelectorAll && node.querySelectorAll('.fade-slide').forEach(el => {
            if (!el.classList.contains('show')) {
              setTimeout(() => el.classList.add('show'), 60);
            }
          });
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

