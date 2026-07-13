/* js/global-anim.js - UI Utilities & Global Effects */
(function() {
  "use strict";

  if (window.__AGRIPRICE_GLOBAL_ANIM_READY) return;
  window.__AGRIPRICE_GLOBAL_ANIM_READY = true;

  // Hide bottom nav inside iframe to avoid duplicate bars
  if (window.self !== window.top) {
    const iframeStyle = document.createElement('style');
    iframeStyle.textContent = `
      #bottomNavMount, .bottom-nav {
        display: none !important;
      }
      body {
        padding-bottom: 0 !important;
        margin-bottom: 0 !important;
        height: auto !important;
      }
    `;
    document.head.appendChild(iframeStyle);
  }

  const supportsViewTransition = ('startViewTransition' in document);

  // --- Inject Custom Toast & Alert Modal Styles ---
  const style = document.createElement('style');
  style.textContent = `
    /* ── Toast Styles ── */
    .agri-toast-container {
      position: fixed;
      top: calc(20px + var(--safe-top, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 11000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: calc(100% - 32px);
      max-width: 380px;
      pointer-events: none;
    }
    .agri-toast {
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 16px;
      padding: 14px 18px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 12px;
      color: #0f172a;
      font-size: 14px;
      font-weight: 700;
      pointer-events: auto;
      animation: toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      transition: all 0.3s ease;
    }
    .agri-toast.fade-out {
      opacity: 0;
      transform: translateY(-20px) scale(0.9);
    }
    .agri-toast span.material-icons-outlined {
      font-size: 20px;
      flex-shrink: 0;
    }
    .agri-toast.success span.material-icons-outlined { color: #0b853c; }
    .agri-toast.error span.material-icons-outlined { color: #ff3b30; }
    .agri-toast.info span.material-icons-outlined { color: #007aff; }

    [data-theme="dark"] .agri-toast {
      background: rgba(30, 41, 59, 0.9);
      border-color: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }

    @keyframes toastIn {
      from { opacity: 0; transform: translateY(-20px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Custom Alert Dialog ── */
    .agri-alert-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 10000;
      display: grid;
      place-items: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      padding: 24px;
    }
    .agri-alert-backdrop.open {
      opacity: 1;
      pointer-events: all;
    }
    .agri-alert-dialog {
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 24px;
      padding: 28px 24px 0 24px;
      width: 100%;
      max-width: 320px;
      text-align: center;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
      transform: scale(0.9);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
    }
    .agri-alert-backdrop.open .agri-alert-dialog {
      transform: scale(1);
    }
    .agri-alert-icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      margin: 0 auto 16px;
    }
    .agri-alert-icon-wrap.success {
      background: rgba(11, 133, 60, 0.1);
      color: #0b853c;
    }
    .agri-alert-icon-wrap.error {
      background: rgba(255, 59, 48, 0.1);
      color: #ff3b30;
    }
    .agri-alert-icon-wrap.info {
      background: rgba(0, 122, 255, 0.1);
      color: #007aff;
    }
    .agri-alert-icon-wrap span {
      font-size: 28px;
    }
    .agri-alert-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
      letter-spacing: -0.5px;
    }
    .agri-alert-message {
      font-size: 14px;
      line-height: 1.5;
      color: #475569;
      margin: 0 0 24px;
      font-weight: 500;
    }

    .agri-alert-footer {
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      margin-left: -24px;
      margin-right: -24px;
    }

    .agri-alert-btn {
      width: 100%;
      height: 52px;
      border: none;
      background: transparent;
      color: #0B853C;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
      transition: background 0.2s;
      outline: none;
    }
    .agri-alert-btn:active {
      background: rgba(15, 23, 42, 0.05);
    }

    [data-theme="dark"] .agri-alert-dialog {
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
    }
    [data-theme="dark"] .agri-alert-title {
      color: #f8fafc;
    }
    [data-theme="dark"] .agri-alert-footer {
      border-top-color: rgba(255, 255, 255, 0.08);
    }
    [data-theme="dark"] .agri-alert-btn {
      color: #22c55e;
    }
    [data-theme="dark"] .agri-alert-btn:active {
      background: rgba(255, 255, 255, 0.05);
    }
    /* Confirm Dialog styles */
    .agri-alert-footer.confirm-footer {
      display: flex;
    }
    .agri-alert-footer.confirm-footer .agri-alert-btn {
      width: 50%;
    }
    .agri-alert-footer.confirm-footer .cancel-btn {
      border-right: 1px solid rgba(15, 23, 42, 0.08);
      color: #ff3b30;
      font-weight: 700;
    }
    [data-theme="dark"] .agri-alert-footer.confirm-footer .cancel-btn {
      border-right-color: rgba(255, 255, 255, 0.08);
      color: #ef4444;
    }
    .agri-alert-footer.confirm-footer .confirm-btn {
      color: #0B853C;
    }
    [data-theme="dark"] .agri-alert-footer.confirm-footer .confirm-btn {
      color: #22c55e;
    }

    /* ── Page Transition Animations ── */
    @view-transition {
      navigation: auto;
    }
    html {
      background-color: var(--html-bg, #F7F9FA) !important;
    }
    body {
      opacity: 0;
      background-color: var(--html-bg, #F7F9FA) !important;
      transition: opacity 0.12s ease-in-out !important;
    }
    body.page-ready {
      opacity: 1 !important;
    }
    body.page-exit {
      opacity: 0 !important;
    }
  `;

  const savedTheme = localStorage.getItem('agriprice_theme') || 'light';
  const bgColor = savedTheme === 'dark' ? '#121212' : '#F7F9FA';
  document.documentElement.style.setProperty('--html-bg', bgColor);

  document.head.appendChild(style);

  // Trigger page-ready fade-in when DOM is ready
  const makePageReady = () => {
    if (document.body) document.body.classList.add('page-ready');
  };

  // Failsafe: force fade-in after 300ms in case DOMContentLoaded is delayed
  setTimeout(makePageReady, 300);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makePageReady);
  } else {
    makePageReady();
  }

  // 1. Toast Notification System
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.agri-toast-container');
    const container = existing || document.createElement('div');
    if (!existing) {
      container.className = 'agri-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `agri-toast ${type}`;
    const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');

    toast.innerHTML = `
      <span class="material-icons-outlined">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  // 2. Alert/Modal Replacement System
  function showCustomAlert(message, titleOrType = 'แจ้งเตือน', typeOrCallback = null, callback = null) {
    let title = 'แจ้งเตือน';
    let type = 'info';
    let cb = null;

    // Smart parameter parsing
    if (['success', 'error', 'info'].includes(titleOrType)) {
      type = titleOrType;
      if (type === 'success') title = 'สำเร็จ';
      else if (type === 'error') title = 'เกิดข้อผิดพลาด';
      else title = 'แจ้งเตือน';
      if (typeof typeOrCallback === 'function') {
        cb = typeOrCallback;
      }
    } else {
      title = titleOrType;
      if (typeof typeOrCallback === 'string') {
        type = typeOrCallback;
      } else if (typeof typeOrCallback === 'function') {
        cb = typeOrCallback;
      }
      if (typeof callback === 'function') {
        cb = callback;
      }
    }

    const activeAlert = document.getElementById('agri-custom-alert');
    if (activeAlert) activeAlert.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'agri-custom-alert';
    backdrop.className = 'agri-alert-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'agri-alert-dialog';

    const icon = type === 'success' ? 'check_circle' : (type === 'error' ? 'error' : 'info');

    dialog.innerHTML = `
      <div class="agri-alert-icon-wrap ${type}">
        <span class="material-icons-outlined">${icon}</span>
      </div>
      <h3 class="agri-alert-title">${title}</h3>
      <p class="agri-alert-message">${message}</p>
      <div class="agri-alert-footer">
        <button class="agri-alert-btn">ตกลง</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Lock scroll
    document.body.style.overflow = 'hidden';

    // Animate open
    setTimeout(() => {
      backdrop.classList.add('open');
    }, 10);

    const dismiss = () => {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => {
        backdrop.remove();
        if (cb) cb();
      }, 300);
    };

    dialog.querySelector('.agri-alert-btn').addEventListener('click', dismiss);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) dismiss();
    });
  }

  // Custom Confirm Dialog
  function showCustomConfirm(message, callback) {
    const activeConfirm = document.getElementById('agri-custom-confirm');
    if (activeConfirm) activeConfirm.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'agri-custom-confirm';
    backdrop.className = 'agri-alert-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'agri-alert-dialog';

    dialog.innerHTML = `
      <div class="agri-alert-icon-wrap info">
        <span class="material-icons-outlined">help_outline</span>
      </div>
      <h3 class="agri-alert-title">ยืนยัน</h3>
      <p class="agri-alert-message">${message}</p>
      <div class="agri-alert-footer confirm-footer">
        <button class="agri-alert-btn cancel-btn">ยกเลิก</button>
        <button class="agri-alert-btn confirm-btn">ตกลง</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      backdrop.classList.add('open');
    }, 10);

    const dismiss = (result) => {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => {
        backdrop.remove();
        if (callback) callback(result);
      }, 300);
    };

    dialog.querySelector('.cancel-btn').addEventListener('click', () => dismiss(false));
    dialog.querySelector('.confirm-btn').addEventListener('click', () => dismiss(true));

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) dismiss(false);
    });
  }

  // Global override for window.alert()
  window.alert = function(message) {
    showCustomAlert(message);
  };

  window.showToast = showToast;
  window.showAlert = showCustomAlert;
  window.showConfirm = showCustomConfirm;
  window.appNotify = showToast; // standard alias

  // 3. Page Transitions
  window.navigateWithTransition = function(url) {
    if (document.body) {
      document.body.classList.remove('page-ready');
      document.body.classList.add('page-exit');
    }
    setTimeout(() => {
      window.location.href = url;
    }, 120); // match the 0.12s fade out
  };

  // 4. Haptics (Native Vibration)
  window.triggerHaptic = async function(type = 'light') {
    if (window.Capacitor && window.Capacitor.isPluginAvailable('Haptics')) {
      try {
        const { Haptics, ImpactStyle } = window.Capacitor.Plugins;
        if (type === 'light') await Haptics.impact({ style: ImpactStyle.Light });
        else if (type === 'medium') await Haptics.impact({ style: ImpactStyle.Medium });
        else if (type === 'heavy') await Haptics.impact({ style: ImpactStyle.Heavy });
        else if (type === 'success') await Haptics.notification({ type: 'SUCCESS' });
        else if (type === 'error') await Haptics.notification({ type: 'ERROR' });
      } catch (e) {}
    }
  };

  // Auto-bind to buttons for premium feel
  document.addEventListener('click', (e) => {
    if (e.target.closest('button, .bottom-nav-item, .cat-item, .product-item')) {
      window.triggerHaptic('light');
    }
  });

  // Global click handler to capture relative links and animate them
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return; // Only left clicks

    const anchor = e.target.closest('a[href]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || anchor.getAttribute('target') === '_blank') return;

    // Ignore external or non-http links
    if (/^(mailto:|tel:|javascript:|https?:\/\/)/i.test(href)) return;

    // Support Auth Guard logic on bottom nav: let components.js handle redirects if not logged in
    const isBottomNav = anchor.closest('.bottom-nav-item');
    if (isBottomNav) {
      const pageKey = isBottomNav.dataset.page;
      const protectedPages = ['chat', 'booking', 'notifications', 'account'];
      if (protectedPages.includes(pageKey)) {
        const tokenKey = window.AUTH_TOKEN_KEY || 'token';
        const isLoggedIn = window.AuthGuard ? window.AuthGuard.isLoggedIn() : !!localStorage.getItem(tokenKey);
        if (!isLoggedIn) return; // let components.js handle it
      }
    }

    // Check if the link target is the same page to prevent reloading
    try {
      const targetUrl = new URL(anchor.href, window.location.origin);
      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) {
        e.preventDefault();
        return;
      }
    } catch (_) {}

    // Intercept and navigate smoothly!
    e.preventDefault();
    window.navigateWithTransition(href);
  });

})();
