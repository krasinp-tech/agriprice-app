/**
 * global-anim.js
 * ไฟล์ควบคุม "เอนิเมชั่น" และ "ประสบการณ์ผู้ใช้" (UX) ในระดับภาพรวม
 * จัดการเรื่องการเปลี่ยนหน้าให้มีความนุ่มนวล, ระบบ Dark Mode (โหมดกลางคืน),
 * รวมถึงระบบแจ้งเตือน (Toast Notification) และหน้าต่างยืนยัน (Modal Confirmation)
 */
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

  // Catch and suppress the harmless AbortError from View Transitions API
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && event.reason.name === "AbortError") {
      event.preventDefault();
    }
  });

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
  // Replaces all native browser interaction with our custom premium UI
  const nativeAlert = window.alert;
  const nativeConfirm = window.confirm;

  window.alert = function (message) {
    if (window.showAlert) {
      window.showAlert(message);
    } else if (window.appNotify) {
      const msg = String(message).toLowerCase();
      const type = (msg.includes('error') || msg.includes('ผิดพลาด') || msg.includes('ไม่สำเร็จ')) ? 'error' : 'info';
      window.appNotify(message, type);
    } else {
      nativeAlert(message);
    }
  };

  window.confirm = function(message) {
      // confirm is synchronous, but our modal is async. 
      // We should ideally use window.showConfirm(msg, cb) instead.
      // But for compatibility, we log a warning if native confirm is called.
      if (window.showConfirm) {
          console.warn("Native confirm() called. Please use window.showConfirm(msg, callback) for better UX.");
          return nativeConfirm(message);
      }
      return nativeConfirm(message);
  };

  // --- Premium Notification Toast Implementation ---
  window.appNotify = function (message, type = 'info') {
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
      warning: ['#F59E0B', '#ffffff', 'warning_amber'],
      loading: ['#0B66FF', '#ffffff', 'sync'],
      info: ['#2C2C2E', '#ffffff', 'info'],
    };
    const [bg, fg, icon] = palette[type] || palette.info;

    toast.innerHTML = `<span class="material-icons-outlined" style="font-size:20px; ${type === 'loading' ? 'animation:btnSpin 1s linear infinite;' : ''}">${icon}</span>
                       <span style="flex:1;">${String(message)}</span>`;

    toast.style.cssText = [
      'pointer-events:auto',
      'padding:14px 24px',
      'border-radius:24px',
      'box-shadow:0 20px 48px rgba(0,0,0,.3)',
      'font-size:15px',
      'font-weight:600',
      'line-height:1.4',
      'background:' + bg,
      'color:' + fg,
      'border:none',
      'backdrop-filter:blur(20px)',
      '-webkit-backdrop-filter:blur(20px)',
      'opacity:0',
      'transform:translateY(30px) scale(0.9)',
      'transition:all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
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

    const duration = type === 'loading' ? 10000 : 4000;
    const timer = window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-15px) scale(0.95)';
      window.setTimeout(() => toast.remove(), 500);
    }, duration);

    toast.onclick = () => {
      window.clearTimeout(timer);
      toast.style.opacity = '0';
      window.setTimeout(() => toast.remove(), 400);
    };
  };

  // --- Premium Modal Alert/Confirm ---
  window.showAlert = function(message, type = 'info') {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.3s ease;pointer-events:auto;';
    
    const palette = {
      success: ['rgba(11, 133, 60, 0.15)', '#0B853C', 'check_circle', 'สำเร็จ!'],
      error: ['rgba(239, 68, 68, 0.15)', '#EF4444', 'error_outline', 'เกิดข้อผิดพลาด'],
      info: ['rgba(59, 130, 246, 0.15)', '#3B82F6', 'info', 'แจ้งเตือน'],
    };
    const [bg, color, icon, defaultTitle] = palette[type] || palette.info;

    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-card,#fff);border-radius:28px;padding:40px 24px 32px;width:calc(100% - 48px);max-width:340px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25);transform:scale(0.9) translateY(30px);transition:all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);';
    
    card.innerHTML = `
      <div style="width:80px;height:80px;border-radius:50%;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
        <span class="material-icons-outlined" style="font-size:44px;">${icon}</span>
      </div>
      <h3 style="margin:0 0 12px;font-size:24px;font-weight:900;color:var(--text-main,#111);">${defaultTitle}</h3>
      <p style="margin:0 0 32px;font-size:16px;color:var(--text-muted,#666);line-height:1.6;">${message}</p>
      <button style="width:100%;padding:16px;border:none;border-radius:18px;background:linear-gradient(135deg, var(--primary,#0B853C) 0%, #00C853 100%);color:#fff;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(11, 133, 60, 0.3);transition:transform 0.2s active;">ตกลง (OK)</button>
    `;
    
    const btn = card.querySelector('button');
    const close = () => {
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.9) translateY(20px)';
      setTimeout(() => overlay.remove(), 300);
    };
    btn.onclick = close;
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      card.style.transform = 'scale(1) translateY(0)';
    });
  };

  window.showConfirm = function(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.3s ease;pointer-events:auto;';
    
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-card,#fff);border-radius:32px;padding:40px 24px 28px;width:calc(100% - 40px);max-width:360px;text-align:center;box-shadow:0 30px 70px rgba(0,0,0,0.3);transform:scale(0.85) translateY(40px);transition:all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);';
    
    card.innerHTML = `
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(245, 158, 11, 0.15);color:#F59E0B;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;">
        <span class="material-icons-outlined" style="font-size:40px;">help_outline</span>
      </div>
      <h3 style="margin:0 0 16px;font-size:22px;font-weight:900;color:var(--text-main,#111);">ยืนยันการดำเนินการ</h3>
      <p style="margin:0 0 32px;font-size:16px;color:var(--text-muted,#666);line-height:1.6;white-space:pre-wrap;">${message}</p>
      <div style="display:flex;gap:12px;">
        <button id="cfCancel" style="flex:1;padding:16px;border:1.5px solid var(--border-color,#eee);border-radius:18px;background:transparent;color:var(--text-muted,#666);font-size:16px;font-weight:700;cursor:pointer;">ยกเลิก</button>
        <button id="cfConfirm" style="flex:1.5;padding:16px;border:none;border-radius:18px;background:#ef4444;color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(239, 68, 68, 0.25);">ยืนยัน</button>
      </div>
    `;
    
    const close = (result) => {
      overlay.style.opacity = '0';
      card.style.transform = 'scale(0.9) translateY(20px)';
      setTimeout(() => {
        overlay.remove();
        if (onConfirm) onConfirm(result);
      }, 300);
    };

    card.querySelector('#cfCancel').onclick = () => close(false);
    card.querySelector('#cfConfirm').onclick = () => close(true);
    
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      card.style.transform = 'scale(1) translateY(0)';
    });
  };

  window.__AGRIPRICE_APP_READY = true;
})();

/* 3. CORDOVA & CAPACITOR NATIVE HANDLING */
document.addEventListener('deviceready', () => {
  if (window.AGRIPRICE_DEBUG) console.log('[Native] Device Ready');

  // Handle Android Back Button (Cordova fallback)
  document.addEventListener('backbutton', (e) => {
    e.preventDefault();
    handleBackButton(() => {
      if (navigator.app && navigator.app.exitApp) navigator.app.exitApp();
    });
  }, false);
}, false);

// Capacitor Back Button Handling
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
    handleBackButton(() => {
      if (canGoBack) {
        window.history.back();
      } else {
        window.Capacitor.Plugins.App.exitApp();
      }
    });
  });
} else {
  // If loaded later
  document.addEventListener('DOMContentLoaded', () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.addListener('backButton', ({ canGoBack }) => {
        handleBackButton(() => {
          if (canGoBack) {
            window.history.back();
          } else {
            window.Capacitor.Plugins.App.exitApp();
          }
        });
      });
    }
  });
}

function handleBackButton(exitCallback) {
  // 1. Check if any modal is open - if so, close it first
  const openModal = document.querySelector('.modal:not([hidden]):not(.fade-out), .logout-modal[style*="flex"], .modal.show');
  if (openModal && openModal.style.display !== 'none' && !openModal.hasAttribute('hidden')) {
    if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: Closing modal');
    const closeBtn = openModal.querySelector('.modal-close, #logoutCancelBtn, .btn-outline, #cancelModalBtn');
    if (closeBtn) closeBtn.click();
    else openModal.style.display = 'none';
    return;
  }

  // 2. Navigation history
  if (window.history.length > 1 || window.location.pathname !== '/' && !window.location.pathname.endsWith('index.html')) {
    if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: History back');
    window.history.back();
  } else {
    // If at the root, exit app
    if (window.AGRIPRICE_DEBUG) console.log('[Native] Back pressed: Exit app');
    if (exitCallback) exitCallback();
  }
}

// Global animation helper for fade-slide and modal-fade (Restored Original)
(function(){
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
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
