// UI Common Components: alert, loading, empty, confirm

// Alert
window.appNotify = window.appNotify || function (message, type = 'info') {
  let host = document.getElementById('globalAppNotifyHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'globalAppNotifyHost';
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:min(92vw,360px);';
    document.body.appendChild(host);
  }

  const toast = document.createElement('div');
  const palette = {
    success: ['#e8f8ef', '#137a3a'],
    error: ['#fdecec', '#b42318'],
    loading: ['#eef4ff', '#1d4ed8'],
    info: ['#f4f4f5', '#374151'],
  };
  const [bg, fg] = palette[type] || palette.info;

  toast.textContent = String(message);
  toast.style.cssText = [
    'pointer-events:auto',
    'padding:12px 14px',
    'border-radius:14px',
    'box-shadow:0 10px 30px rgba(0,0,0,.12)',
    'font-size:14px',
    'line-height:1.4',
    'background:' + bg,
    'color:' + fg,
    'border:1px solid rgba(0,0,0,.08)',
  ].join(';');

  host.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity .2s ease, transform .2s ease';
    window.setTimeout(() => toast.remove(), 220);
  }, 2400);
};

window.showAlert = function(msg, type = 'info', timeout = 3000) {
  if (window.appNotify) {
    window.appNotify(msg, type);
    return;
  }

  let el = document.getElementById('globalAlert');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalAlert';
    el.className = 'global-alert';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'global-alert ' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, timeout);
};

// Loading Spinner
window.showLoading = function(show = true) {
  let el = document.getElementById('globalLoading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalLoading';
    el.className = 'global-loading';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
};

// Empty State
window.showEmptyState = function(container, msg = 'ไม่มีข้อมูล') {
  if (!container) return;
  let el = container.querySelector('.empty-state');
  if (!el) {
    el = document.createElement('div');
    el.className = 'empty-state';
    container.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
};
window.hideEmptyState = function(container) {
  if (!container) return;
  let el = container.querySelector('.empty-state');
  if (el) el.style.display = 'none';
};

// Confirm Modal
window.showConfirm = function(msg, onConfirm) {
  let el = document.getElementById('globalConfirm');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalConfirm';
    el.className = 'global-confirm';
    el.innerHTML = '<div class="modal"><div class="msg"></div><div class="actions"><button id="confirmYes">ตกลง</button><button id="confirmNo">ยกเลิก</button></div></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.msg').textContent = msg;
  el.style.display = 'flex';
  el.querySelector('#confirmYes').onclick = () => { el.style.display = 'none'; if (onConfirm) onConfirm(true); };
  el.querySelector('#confirmNo').onclick = () => { el.style.display = 'none'; if (onConfirm) onConfirm(false); };
};

// CSS (inject once)
(function injectCss() {
  if (document.getElementById('uiCommonCss')) return;
  const css = `
.global-alert { position:fixed;right:16px;bottom:16px;z-index:99999;padding:12px 14px;border-radius:14px;font-size:14px;line-height:1.4;background:#333;color:#fff;display:none;max-width:min(92vw,360px);box-shadow:0 10px 30px rgba(0,0,0,.12); }
.global-alert.info { background:#333; }
.global-alert.success { background:#2ecc40; }
.global-alert.error { background:#e74c3c; }
.global-loading { position:fixed;top:0;left:0;width:100vw;height:100vh;display:none;align-items:center;justify-content:center;z-index:9998;background:rgba(0,0,0,0.15); }
.global-loading .spinner { width:48px;height:48px;border:6px solid #eee;border-top:6px solid #333;border-radius:50%;animation:spin 1s linear infinite; }
@keyframes spin { 100% { transform:rotate(360deg); } }
.empty-state { text-align:center;color:#888;padding:24px;font-size:18px; }
.global-confirm { position:fixed;top:0;left:0;width:100vw;height:100vh;display:none;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,0.2); }
.global-confirm .modal { background:#fff;padding:24px 20px;border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,0.16); width:min(92vw,360px); }
.global-confirm .msg { font-size:16px; line-height:1.5; }
.global-confirm .actions { margin-top:18px;text-align:right; }
.global-confirm button { margin-left:8px;padding:8px 18px;border:none;border-radius:6px;background:#333;color:#fff;font-size:16px;cursor:pointer; }
.global-confirm button#confirmYes { background:#2ecc40; }
.global-confirm button#confirmNo { background:#e74c3c; }
@media (max-width: 480px) {
  .global-confirm .modal { width:calc(100vw - 24px); padding:20px 16px; }
  .global-confirm .actions { display:flex; gap:8px; }
  .global-confirm button { flex:1; margin-left:0; }
  .global-alert { left:12px; right:12px; bottom:12px; max-width:none; }
}
`;
  const style = document.createElement('style');
  style.id = 'uiCommonCss';
  style.textContent = css;
  document.head.appendChild(style);
})();
