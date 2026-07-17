/* js/shared-pages/notifications.js */
(function() {
  "use strict";

  let ALL_NOTIFICATIONS = [];
  let CURRENT_TAB = 'all';
  let SWIPE_GLOBAL_CLEANUPS = [];

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

  function t(key, fallback, params) {
    if (window.i18nT) return window.i18nT(key, fallback, params);
    return fallback || key;
  }

  const NOTIFICATION_TITLE_KEYS = {
    'มีการจองคิวใหม่': 'notification_new_booking_title',
    'มีการยกเลิกการจองคิว': 'notification_booking_cancelled_title',
    'การจองคิวของคุณถูกยกเลิก': 'notification_your_booking_cancelled_title',
    'ยืนยันการจองคิวสำเร็จ': 'notification_booking_confirmed_title',
    'คิวจองผลผลิตเสร็จสิ้น': 'notification_booking_completed_title',
    'การจองคิวถูกปฏิเสธ': 'notification_booking_rejected_title',
    'เช็คอินคิวสำเร็จ': 'notification_checkin_success_title'
  };

  const NOTIFICATION_DETAIL_KEYS = {
    'ถูกยกเลิกโดยเกษตรกร': 'notification_cancelled_by_farmer_detail',
    'ถูกยกเลิกโดยผู้รับซื้อ': 'notification_cancelled_by_buyer_detail',
    'ได้รับการยืนยันจากผู้รับซื้อแล้ว': 'notification_confirmed_by_buyer_detail',
    'ดำเนินการชั่งน้ำหนักและลงบันทึกเสร็จสิ้นแล้ว': 'notification_completed_detail',
    'ถูกปฏิเสธโดยผู้รับซื้อ': 'notification_rejected_by_buyer_detail',
    'ได้รับการเช็คอินแล้ว': 'notification_checked_in_detail'
  };

  function translateNotificationText(value, field) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    if (field === 'title' && NOTIFICATION_TITLE_KEYS[raw]) {
      return t(NOTIFICATION_TITLE_KEYS[raw], raw);
    }

    const newBooking = raw.match(/^เลขที่\s+(.+?)\s+\((.+?)\)$/);
    if (newBooking) {
      return t('notification_new_booking_detail', raw, {
        booking: newBooking[1],
        queue: newBooking[2]
      });
    }

    const bookingDetail = raw.match(/^คิวเลขที่\s+(.+?)\s+\(ใบจองเลขที่\s+(.+?)\)\s+(.+)$/);
    if (bookingDetail && NOTIFICATION_DETAIL_KEYS[bookingDetail[3]]) {
      return t(NOTIFICATION_DETAIL_KEYS[bookingDetail[3]], raw, {
        queue: bookingDetail[1],
        booking: bookingDetail[2]
      });
    }

    // Also supports future rows that store an i18n key instead of display text.
    return t(raw, raw);
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

      if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = 'none';
      }

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
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.style.display = 'flex';
      }
      listMount.innerHTML = '';
      return;
    }

    if (emptyState) {
      emptyState.hidden = true;
      emptyState.style.display = 'none';
    }
    renderNotifications(filtered, listMount);
  }

  function renderNotifications(items, mount) {
    mount.innerHTML = items.map((n, index) => {
      const type = n.type || 'system';
      const isUnread = !n.is_read;
      const id = n.id || n.notification_id;
      const html = `
        <div class="noti-item-wrapper" data-id="${escapeHtml(id)}">
          <!-- Underlay buttons -->
          <div class="noti-item-underlay-left" style="background: #22c55e;">
            <span class="material-icons-outlined">done_all</span>
            <span>${isUnread ? t('mark_read', 'อ่านแล้ว') : t('mark_unread', 'ยังไม่อ่าน')}</span>
          </div>
          <div class="noti-item-underlay-right" style="background: #ef4444;">
            <span class="material-icons-outlined">delete</span>
            <span>${t('delete', 'ลบ')}</span>
          </div>
          <!-- Main Noti Item -->
          <div class="noti-item ${isUnread ? 'is-unread' : ''}" data-id="${escapeHtml(id)}" style="cursor:pointer; ${isUnread ? 'background: rgba(30,158,108,0.04);' : ''}">
            <div class="noti-item-icon ${getIconClass(type)}">
              <span class="material-icons-outlined">${getIconName(type)}</span>
            </div>
            <div class="noti-item-body">
              <div class="noti-item-title">${escapeHtml(translateNotificationText(n.title, 'title'))}</div>
              <div class="noti-item-desc">${escapeHtml(translateNotificationText(n.message || n.content || n.description, 'detail'))}</div>
              <div class="noti-item-time">${formatRelativeTime(n.created_at)}</div>
            </div>
            ${isUnread ? `<div class="noti-unread-dot" style="width:8px; height:8px; background:var(--brand); border-radius:50%; margin-left:8px;"></div>` : ''}
          </div>
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
        if (noti && noti.is_read === false) {
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

    bindSwipeActions();
  }

  function bindSwipeActions() {
    const listMount = document.getElementById('notificationListMount');
    if (!listMount) return;
    SWIPE_GLOBAL_CLEANUPS.forEach(cleanup => cleanup());
    SWIPE_GLOBAL_CLEANUPS = [];

    listMount.querySelectorAll('.noti-item-wrapper').forEach(wrapper => {
      const item = wrapper.querySelector('.noti-item');
      const underlayLeft = wrapper.querySelector('.noti-item-underlay-left');
      const underlayRight = wrapper.querySelector('.noti-item-underlay-right');

      function updateUnderlays(x) {
        if (underlayLeft) underlayLeft.style.display = x > 0 ? 'flex' : 'none';
        if (underlayRight) underlayRight.style.display = x < 0 ? 'flex' : 'none';
      }

      function resetSwipe() {
        currentX = 0;
        activeSwipe = 0;
        item.style.transform = 'translateX(0)';
        item.dataset.swipeOpen = 'false';
        updateUnderlays(0);
      }

      function settleSwipe() {
        let nextX = 0;
        if (currentX > 40) nextX = 76;
        else if (currentX < -40) nextX = -76;

        currentX = nextX;
        activeSwipe = nextX;
        item.style.transform = `translateX(${nextX}px)`;
        item.dataset.swipeOpen = nextX !== 0 ? 'true' : 'false';
        updateUnderlays(nextX);
      }

      function suppressNextClick() {
        item.dataset.swipeSuppress = 'true';
        setTimeout(() => {
          if (item.dataset.swipeSuppress === 'true') item.dataset.swipeSuppress = '';
        }, 350);
      }

      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let isDragging = false;
      let isHorizontal = false;
      let movedDuringGesture = false;
      let activeSwipe = 0; // -76 for left (delete), 76 for right (read)

      item.addEventListener('click', (e) => {
        if (item.dataset.swipeSuppress === 'true' || activeSwipe !== 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          item.dataset.swipeSuppress = '';
          item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          resetSwipe();
        }
      }, true);

      // Touch events for mobile
      item.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = activeSwipe;
        isDragging = true;
        isHorizontal = false;
        movedDuringGesture = false;
        item.style.transition = 'none';
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        // Detect horizontal swipe
        if (!isHorizontal && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isHorizontal = true;
        }

        if (isHorizontal) {
          movedDuringGesture = true;
          currentX = diffX + activeSwipe;
          // Clamp swipe distance
          if (currentX > 84) currentX = 84;
          if (currentX < -84) currentX = -84;
          item.style.transform = `translateX(${currentX}px)`;
          updateUnderlays(currentX);
        }
      }, { passive: true });

      item.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        settleSwipe();
        if (movedDuringGesture) suppressNextClick();
      });

      // Mouse drag events for testing / desktop
      let isMouseDragging = false;
      item.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        currentX = activeSwipe;
        isMouseDragging = true;
        movedDuringGesture = false;
        item.style.transition = 'none';
      });

      const handleMouseMove = (e) => {
        if (!isMouseDragging) return;
        const diffX = e.clientX - startX;
        if (Math.abs(diffX) > 4) movedDuringGesture = true;
        currentX = diffX + activeSwipe;
        if (currentX > 84) currentX = 84;
        if (currentX < -84) currentX = -84;
        item.style.transform = `translateX(${currentX}px)`;
        updateUnderlays(currentX);
      };
      window.addEventListener('mousemove', handleMouseMove);
      SWIPE_GLOBAL_CLEANUPS.push(() => window.removeEventListener('mousemove', handleMouseMove));

      const handleMouseUp = () => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        settleSwipe();
        if (movedDuringGesture) suppressNextClick();
      };
      window.addEventListener('mouseup', handleMouseUp);
      SWIPE_GLOBAL_CLEANUPS.push(() => window.removeEventListener('mouseup', handleMouseUp));

      // Close swiped state on body interaction elsewhere
      const handleDocumentClick = (e) => {
        if (!wrapper.contains(e.target) && activeSwipe !== 0) {
          item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          resetSwipe();
        }
      };
      document.addEventListener('click', handleDocumentClick);
      SWIPE_GLOBAL_CLEANUPS.push(() => document.removeEventListener('click', handleDocumentClick));

      // Left Action: Toggle Read/Unread
      wrapper.querySelector('.noti-item-underlay-left')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const notiId = wrapper.dataset.id;
        const noti = ALL_NOTIFICATIONS.find(x => String(x.id || x.notification_id) === String(notiId));
        if (noti) {
          try {
            const api = getApi();
            const isUnread = !noti.is_read;
            if (isUnread) {
              if (api.markRead) await api.markRead(notiId);
              else await api.call('PATCH', `/api/notifications/${notiId}/read`);
              noti.is_read = true;
            } else {
              if (api.markUnread) await api.markUnread(notiId);
              else await api.call('PATCH', `/api/notifications/${notiId}/unread`);
              noti.is_read = false;
            }
            resetSwipe();
            refreshUI();
          } catch(err) {
            console.error('[Notifications] Mark read/unread failed:', err);
          }
        }
      });

      // Right Action: Delete Notification
      wrapper.querySelector('.noti-item-underlay-right')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const notiId = wrapper.dataset.id;
        const confirmMsg = t('confirm_delete_notification', 'คุณต้องการลบการแจ้งเตือนนี้ใช่หรือไม่?');
        const showConfirm = window.showConfirm;

        showConfirm(confirmMsg, async (confirmed) => {
          if (confirmed) {
            try {
              const api = getApi();
              if (api.deleteNotification) await api.deleteNotification(notiId);
              else await api.call('DELETE', `/api/notifications/${notiId}`);
              // Animation height collapse
              wrapper.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
              wrapper.style.height = '0';
              wrapper.style.margin = '0';
              wrapper.style.opacity = '0';
              wrapper.style.padding = '0';
              // Hide adjacent divider
              const nextEl = wrapper.nextElementSibling;
              if (nextEl && nextEl.classList.contains('noti-divider')) {
                nextEl.style.display = 'none';
              }
              setTimeout(() => {
                loadNotifications();
              }, 350);
            } catch(err) {
              console.error('[Notifications] Delete failed:', err);
              if (window.showToast) window.showToast(t('error_delete_notification', 'ลบการแจ้งเตือนไม่สำเร็จ'), 'error');
            }
          } else {
            resetSwipe();
          }
        }, {
          variant: 'danger',
          title: t('delete_notification', 'ลบการแจ้งเตือน'),
          confirmText: t('delete', 'ลบ')
        });
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

  function deleteReadNotifications() {
    const hasRead = ALL_NOTIFICATIONS.some(n => n.is_read);
    if (!hasRead) {
      if (window.showToast) window.showToast(t('no_read_notifications', 'ไม่มีการแจ้งเตือนที่อ่านแล้ว'), 'info');
      return;
    }

    const confirmMsg = t('confirm_delete_all_read', 'คุณต้องการลบการแจ้งเตือนที่อ่านแล้วทั้งหมดใช่หรือไม่?');
    const showConfirm = window.showConfirm;

    showConfirm(confirmMsg, async (confirmed) => {
      if (confirmed) {
        try {
          const api = getApi();
          if (api.deleteReadNotifications) await api.deleteReadNotifications();
          else await api.call('DELETE', '/api/notifications/delete-read');
          // Filter out read notifications from local state
          ALL_NOTIFICATIONS = ALL_NOTIFICATIONS.filter(n => !n.is_read);
          refreshUI();
          if (window.showToast) window.showToast(t('read_notifications_deleted', 'ลบการแจ้งเตือนที่อ่านแล้วสำเร็จ'), 'success');
        } catch (err) {
          console.error('[Notifications] Delete read notifications failed:', err);
          if (window.showToast) window.showToast(t('error_delete_read', 'ลบการแจ้งเตือนที่อ่านแล้วไม่สำเร็จ'), 'error');
        }
      }
    }, {
      variant: 'danger',
      title: t('delete_read_notifications', 'ลบการแจ้งเตือนที่อ่านแล้ว'),
      confirmText: t('delete_all', 'ลบทั้งหมด')
    });
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

    const deleteReadBtn = document.getElementById('deleteReadBtn');
    if (deleteReadBtn) deleteReadBtn.onclick = () => deleteReadNotifications();

    loadNotifications();
  }

  window.loadNotifications = loadNotifications;
  window.addEventListener('agriprice:notifications-refresh', loadNotifications);

  document.addEventListener('DOMContentLoaded', init);
})();
