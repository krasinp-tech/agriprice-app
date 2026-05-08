/**
 * 🌙 AGRIPRICE - Premium Global Controller
 * - Theme Engine (Dark/Light)
 * - Page Transitions
 * - Pull to Refresh
 * - Haptic Feedback
 */

/* 1. THEME ENGINE - Run immediately to prevent white flash */
(function () {
  window.__AGRIPRICE_LOAD_THEME = function () {
    const savedTheme = localStorage.getItem('agriprice_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let themeToApply = savedTheme || (systemDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', themeToApply);

    // Status Bar Color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeToApply === 'dark' ? '#000000' : '#0B853C');
    }
  };
  window.__AGRIPRICE_LOAD_THEME();

  // Real-time sync across tabs/windows
  window.addEventListener('storage', (e) => {
    if (e.key === 'agriprice_theme') {
      window.__AGRIPRICE_LOAD_THEME();
    }
  });
})();

/* 2. MAIN UI CONTROLLER */
(function () {
  if (window.__AGRIPRICE_APP_READY) return;

  // Viewport Height Fix for iOS
  const setVH = () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);

  // Native-like Scroll & Zoom Prevention
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  document.addEventListener('gesturestart', e => e.preventDefault());

  // Haptic Feedback
  document.addEventListener('click', (e) => {
    const isAction = e.target.closest('a, button, .menu-item, .bottom-nav-item');
    if (isAction && navigator.vibrate) {
      try { navigator.vibrate(15); } catch (_) { }
    }
  });

  // Page Transitions
  // 🚀 [Redo V5 - Ultra Stable] Native Navigation with View Transition support
  window.AgriPriceRouter = {
    // Gets the absolute path to the frontend root (e.g., "/frontend/" or "/")
    getAppPath() {
      const path = window.location.pathname.replace(/\\/g, "/");
      const match = path.match(/^(.*?\/)pages\//);
      if (match) return match[1];

      // Fallback: up to the last slash
      return path.substring(0, path.lastIndexOf("/") + 1);
    },

    resolveAsset(path) {
      if (!path) return "";
      const pathStr = String(path);

      // 1. External or Absolute URLs
      if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:|javascript:|\/)/i.test(pathStr)) {
        return pathStr;
      }

      // 2. Root-relative paths (starting with 'pages/')
      if (pathStr.startsWith('pages/')) {
        const appPath = this.getAppPath();
        const cleaned = pathStr.replace(/^\/+/, "");
        const final = (appPath.endsWith("/") ? appPath : appPath + "/") + cleaned;
        console.log("[AgriPriceRouter] Root-relative resolve:", pathStr, "->", final);
        return final;
      }

      // 3. Directory-relative paths (everything else)
      // Resolve relative to the current directory
      const currentDir = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/") + 1);
      const final = currentDir + pathStr;
      console.log("[AgriPriceRouter] Directory-relative resolve:", pathStr, "->", final);
      return final;
    },

    async navigate(url, options = {}) {
      if (!url || url.startsWith('javascript:') || url.startsWith('#')) return;

      const resolvedPath = this.resolveAsset(url);
      const absoluteUrl = new URL(resolvedPath, window.location.origin).href;

      console.log("[AgriPriceRouter] Navigating to:", absoluteUrl);

      if (absoluteUrl === window.location.href && !options.force) return;

      if (!options.skipTransition) {
        document.body.classList.add('page-leave');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      window.location.href = absoluteUrl;
    },

    // Simplified reinit for standard page loads
    reinitPage() {
      if (window.i18nInit) window.i18nInit();
      if (window.autoLoadBottomNav) window.autoLoadBottomNav();
      if (window.__AGRIPRICE_LOAD_THEME) window.__AGRIPRICE_LOAD_THEME();
    }
  };

  // Re-run theme on every real load
  window.__AGRIPRICE_LOAD_THEME();

  // Replace the old function with the new router for compatibility
  window.navigateWithTransition = (url) => window.AgriPriceRouter.navigate(url);

  // Native navigation handles Back/Forward buttons automatically.
  // No popstate listener needed for MPA mode.

  // Pull to Refresh Utility
  window.initPullToRefresh = function (onRefresh) {
    let startY = 0;
    let isPulling = false;
    const threshold = 80;

    let indicator = document.getElementById('ptr-ui');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'ptr-ui';
      indicator.style.cssText = 'position:fixed;top:-60px;left:0;right:0;height:60px;display:flex;align-items:center;justify-content:center;z-index:9999;transition:transform 0.2s;opacity:0;';
      indicator.innerHTML = '<div style="width:36px;height:36px;background:var(--bg-card);border-radius:50%;box-shadow:var(--shadow-md);display:flex;align-items:center;justify-content:center;color:var(--primary);"><span class="material-icons-outlined">sync</span></div>';
      document.body.appendChild(indicator);
    }

    const icon = indicator.querySelector('span');

    document.addEventListener('touchstart', e => {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!isPulling) return;
      let diff = (e.touches[0].pageY - startY) * 0.4;
      if (diff > 0) {
        indicator.style.opacity = '1';
        indicator.style.transform = `translateY(${Math.min(diff, 100)}px)`;
        icon.style.transform = `rotate(${diff * 2}deg)`;
        if (diff > 10) e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (!isPulling) return;
      isPulling = false;
      let diff = (indicator.getBoundingClientRect().top + 60);
      if (diff >= threshold) {
        icon.style.animation = 'btnSpin 0.8s linear infinite';
        Promise.resolve(onRefresh()).finally(() => {
          setTimeout(() => {
            indicator.style.transform = 'translateY(0)';
            indicator.style.opacity = '0';
            icon.style.animation = 'none';
          }, 500);
        });
      } else {
        indicator.style.transform = 'translateY(0)';
        indicator.style.opacity = '0';
      }
    });
  };

  // Button Loading State
  window.setBtnLoading = function (btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.dataset.text = btn.innerHTML;
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      if (btn.dataset.text) btn.innerHTML = btn.dataset.text;
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  };

  // 🛡️ Global Alert Override - Premium Mobile Experience
  // This replaces all native browser alert() calls with our custom toast
  const nativeAlert = window.alert;
  window.alert = function (message) {
    if (window.appNotify) {
      // Determine if it's an error or info based on keywords
      const msg = String(message).toLowerCase();
      const type = (msg.includes('error') || msg.includes('ผิดพลาด') || msg.includes('ไม่สำเร็จ')) ? 'error' : 'info';
      window.appNotify(message, type);
    } else {
      nativeAlert(message);
    }
  };

  // --- Premium Notification Toast Implementation ---
  window.appNotify = window.appNotify || function (message, type = 'info') {
    let host = document.getElementById('globalAppNotifyHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'globalAppNotifyHost';
      host.style.cssText = 'position:fixed;left:16px;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;align-items:center;';
      document.body.appendChild(host);
    }

    const toast = document.createElement('div');
    const palette = {
      success: ['#0B853C', '#ffffff', 'check_circle'],
      error: ['#2C2C2E', '#ffffff', 'error_outline'],
      loading: ['#0B66FF', '#ffffff', 'sync'],
      info: ['#2C2C2E', '#ffffff', 'info'],
    };
    const [bg, fg, icon] = palette[type] || palette.info;

    toast.innerHTML = `<span class="material-icons-outlined" style="font-size:20px; ${type === 'loading' ? 'animation:btnSpin 1s linear infinite;' : ''}">${icon}</span>
                       <span style="flex:1;">${String(message)}</span>`;

    toast.style.cssText = [
      'pointer-events:auto',
      'padding:12px 20px',
      'border-radius:20px',
      'box-shadow:0 12px 32px rgba(0,0,0,.25)',
      'font-size:15px',
      'font-weight:500',
      'line-height:1.4',
      'background:' + bg,
      'color:' + fg,
      'border:none',
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
      'opacity:0',
      'transform:translateY(20px) scale(0.9)',
      'transition:all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      'max-width:min(92vw, 400px)',
      'display:flex',
      'align-items:center',
      'gap:12px'
    ].join(';');

    host.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0) scale(1)';
    });

    const duration = type === 'loading' ? 10000 : 3500;
    const timer = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      window.setTimeout(() => toast.remove(), 400);
    }, duration);

    toast.onclick = () => {
      window.clearTimeout(timer);
      toast.style.opacity = '0';
      window.setTimeout(() => toast.remove(), 400);
    };
  };

  window.__AGRIPRICE_APP_READY = true;
})();

/* 3. CORDOVA & NATIVE HANDLING */
document.addEventListener('deviceready', () => {
  if (window.AGRIPRICE_DEBUG) console.log('[Native] Device Ready');

  // Handle Android Back Button
  document.addEventListener('backbutton', (e) => {
    e.preventDefault();

    // 1. Check if any modal is open - if so, close it first
    const openModal = document.querySelector('.modal:not([hidden]), .logout-modal[style*="flex"]');
    if (openModal && openModal.style.display !== 'none') {
      if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: Closing modal');
      const closeBtn = openModal.querySelector('.modal-close, #logoutCancelBtn, .btn-outline');
      if (closeBtn) closeBtn.click();
      else openModal.style.display = 'none';
      return;
    }

    // 2. Navigation history
    if (window.history.length > 1) {
      if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: History back');
      window.history.back();
    } else {
      // If at the root, exit app
      if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: Exit app');
      if (navigator.app && navigator.app.exitApp) {
        navigator.app.exitApp();
      }
    }
  }, false);
}, false);
