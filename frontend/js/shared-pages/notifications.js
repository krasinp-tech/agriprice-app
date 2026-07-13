/* js/shared-pages/notifications.js */
(function() {
  "use strict";

  let ALL_NOTIFICATIONS = [];
  let CURRENT_TAB = 'all';

  function getRelativePrefixToRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../" + "../".repeat(depth);
  }

  const prefixRoot = getRelativePrefixToRoot();

  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    const normalized = String(p).replace(/^\/+/g, "").replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
    return prefixRoot + normalized;
  }

  function getApi() {
    return window.api || {};
  }

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function escapeHtml(s) {
    if (window.AgriPriceUI) return window.AgriPriceUI.escapeHtml(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatRelativeTime(dt) {
    const now = new Date();
    const then = new Date(dt);
    if (isNaN(then.getTime())) return dt;

    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return t('just_now', 'เมื่อสักครู่');
    if (diff < 3600) return `${Math.floor(diff/60)} ${t('minutes_ago', 'นาทีที่แล้ว')}`;
    if (diff < 86400) return `${Math.floor(diff/3600)} ${t('hours_ago', 'ชั่วโมงที่แล้ว')}`;
    return `${Math.floor(diff/86400)} ${t('days_ago', 'วันที่แล้ว')}`;
  }

  const getIconClass = (type) => {
    switch(String(type).toLowerCase()) {
      case 'price': return 'price';
      case 'booking': return 'booking';
      case 'message': return 'message';
      case 'system': return 'system';
      default: return 'system';
    }
  };

  const getIconName = (type) => {
    switch(String(type).toLowerCase()) {
      case 'price': return 'trending_up';
      case 'booking': return 'event_available';
      case 'message': return 'chat_bubble_outline';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  async function loadNotifications() {
    const listMount = document.getElementById('notificationListMount');
    const emptyState = document.getElementById('emptyState');
    if (!listMount) return;

    try {
      // Show shimmers
      listMount.innerHTML = `
        <div class="skeleton-card"><div class="skeleton skeleton-avatar"></div><div class="skeleton-card-content"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div></div>
        <div class="skeleton-card"><div class="skeleton skeleton-avatar"></div><div class="skeleton-card-content"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div></div>
      `;

      const api = getApi();
      if (!api.getNotifications) throw new Error('Notification API is not ready');

      const res = await api.getNotifications();
      const rows = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      ALL_NOTIFICATIONS = rows.map((n) => ({
        ...n,
        id: n.id || n.notification_id,
      }));
      
      refreshUI();
    } catch (err) {
      console.error('[Notifications] Load Error:', err);
      listMount.innerHTML = `<p style="text-align:center; padding:20px; color:red;">${t('error_loading', 'เกิดข้อผิดพลาดในการโหลดข้อมูล')}</p>`;
    }
  }

  function refreshUI() {
    const listMount = document.getElementById('notificationListMount');
    const emptyState = document.getElementById('emptyState');
    const unreadBadge = document.getElementById('unreadBadge');

    // Filter by tab
    const filtered = CURRENT_TAB === 'unread' 
      ? ALL_NOTIFICATIONS.filter(n => !n.is_read) 
      : ALL_NOTIFICATIONS;

    // Update unread count
    const unreadCount = ALL_NOTIFICATIONS.filter(n => !n.is_read).length;
    if (unreadBadge) {
      unreadBadge.textContent = unreadCount;
      unreadBadge.style.display = unreadCount > 0 ? 'grid' : 'none';
    }

    if (filtered.length === 0) {
      if (emptyState) emptyState.hidden = false;
      listMount.innerHTML = '';
      return;
    }

    if (emptyState) emptyState.hidden = true;
    renderNotifications(filtered, listMount);
  }

  function renderNotifications(items, mount) {
    mount.innerHTML = items.map((n, index) => {
      const type = n.type || 'system';
      const isUnread = !n.is_read;
      const id = n.id || n.notification_id;
      const html = `
        <div class="noti-item ${isUnread ? 'is-unread' : ''}" data-id="${escapeHtml(id)}" style="cursor:pointer; ${isUnread ? 'background: rgba(30,158,108,0.04);' : ''}">
          <div class="noti-item-icon ${getIconClass(type)}">
            <span class="material-icons-outlined">${getIconName(type)}</span>
          </div>
          <div class="noti-item-body">
            <div class="noti-item-title">${escapeHtml(n.title)}</div>
            <div class="noti-item-desc">${escapeHtml(n.message || n.content || n.description)}</div>
            <div class="noti-item-time">${formatRelativeTime(n.created_at)}</div>
          </div>
          ${isUnread ? `<div class="noti-unread-dot" style="width:8px; height:8px; background:var(--brand); border-radius:50%; margin-left:8px;"></div>` : ''}
        </div>
        ${index < items.length - 1 ? '<div class="noti-divider"></div>' : ''}
      `;
      return html;
    }).join('');

    // Attach click events
    mount.querySelectorAll('.noti-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const noti = ALL_NOTIFICATIONS.find(x => String(x.id || x.notification_id) === String(id));
        
        if (noti && !noti.is_read) {
          try {
            const api = getApi();
            if (api.markRead) await api.markRead(id);
            else await api.call('PATCH', `/api/notifications/${id}/read`);
            noti.is_read = true;
            refreshUI();
          } catch (err) {
            console.error('[Notifications] Mark read failed:', err);
          }
        }
        
        // Handle deep linking if available
        if (noti && noti.link) {
          const resolvedLink = resolveToRootUrl(noti.link);
          if (window.navigateWithTransition) {
            window.navigateWithTransition(resolvedLink);
          } else {
            window.location.href = resolvedLink;
          }
        }
      });
    });
  }

  async function markAllRead() {
    try {
      const hasUnread = ALL_NOTIFICATIONS.some(n => !n.is_read);
      if (!hasUnread) return;

      const api = getApi();
      if (!api.markAllRead) throw new Error('Notification API is not ready');

      await api.markAllRead();
      ALL_NOTIFICATIONS.forEach(n => n.is_read = true);
      refreshUI();
      if (window.showToast) window.showToast(t('all_marked_read', 'อ่านทั้งหมดแล้ว'), 'success');
    } catch (err) {
      console.error('[Notifications] Mark all read failed:', err);
    }
  }

  function init() {
    // Tab switching
    document.querySelectorAll('.noti-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.noti-tab').forEach(t => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        CURRENT_TAB = tab.dataset.tab;
        refreshUI();
      });
    });

    // Header buttons
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.onclick = () => loadNotifications();

    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) markAllReadBtn.onclick = () => markAllRead();

    loadNotifications();
  }

  window.loadNotifications = loadNotifications;
  window.addEventListener('agriprice:notifications-refresh', loadNotifications);

  document.addEventListener('DOMContentLoaded', init);
})();
