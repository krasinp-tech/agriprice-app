/* js/notifications.js
   - future DB:
     - GET   {API_BASE}/api/notifications
     - PATCH {API_BASE}/api/notifications/:id/read
   - store read/unread in localStorage for now
*/

(function () {
  const getApiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, "");
  const TOKEN_KEY = (window.AUTH_TOKEN_KEY || "token");

  const listEl = document.getElementById("notiList");
  const emptyEl = document.getElementById("emptyState");

  const unreadBadge = document.getElementById("unreadBadge");

  let filter = "all";
  let items = [];
  let refreshTimer = null;
  let refreshInFlight = false;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function currentLocale() {
    const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
    if (lang === 'en') return 'en-US';
    if (lang === 'zh') return 'zh-CN';
    return 'th-TH';
  }

  function safeParse(s, fallback) {
    try {
      // JSON.parse(null) yields null, which we don't want; prefer fallback.
      if (s === null || s === undefined) return fallback;
      const v = JSON.parse(s);
      return v === null ? fallback : v;
    } catch { return fallback; }
  }


  function fmtTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('just_now', 'เมื่อสักครู่');
    if (m < 60) return `${m} ${t('minutes_ago', 'นาทีที่แล้ว')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t('hours_ago', 'ชั่วโมงที่แล้ว')}`;
    return `${Math.floor(h / 24)} ${t('days_ago', 'วันที่แล้ว')}`;
  }

  async function fetchFromApi() {
    if (!window.api) throw new Error("API client not ready");
    const json = await window.api.getNotifications();
    if (!json) {
      // api-client returns null when auth is invalid (e.g. 401 redirect flow)
      throw new Error(t('session_expired', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'));
    }
    const raw = Array.isArray(json) ? json : (Array.isArray(json.data) ? json.data : []);

    // Map server fields to UI format.
    return raw.map(n => {
      const metaRaw = n.metadata ?? n.meta ?? n.payload ?? n.data ?? null;
      const meta = typeof metaRaw === 'string' ? safeParse(metaRaw, {}) : (metaRaw || {});
      const descText = String(n.description || n.desc || '');
      const bookingNoFromDesc = descText.match(/\bBK-[A-Z0-9-]+\b/i)?.[0] || '';

      const roomId = String(
        n.room_id ||
        n.roomId ||
        meta.room_id ||
        meta.roomId ||
        ''
      );
      const targetUserId = String(
        n.target_user_id ||
        n.targetUserId ||
        meta.target_user_id ||
        meta.targetUserId ||
        ''
      );
      const bookingNo = String(
        n.booking_no ||
        n.bookingNo ||
        meta.booking_no ||
        meta.bookingNo ||
        bookingNoFromDesc ||
        ''
      );

      // Build action link by notification type.
      let action = null;
      if (n.type === 'booking') {
        try {
          const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || 'null');
          const role = (u && u.role) ? u.role.toLowerCase() : 'farmer';
          const href = role === 'buyer'
            ? (bookingNo ? `../buyer/setbooking/booking-information.html?bid=${encodeURIComponent(bookingNo)}` : '../buyer/setbooking/booking.html')
            : (bookingNo ? `../farmer/booking/booking-step4.html?bid=${encodeURIComponent(bookingNo)}` : '../farmer/booking/booking.html');
          action = { label: t('booking_action_view', 'ดูการจอง'), href };
        } catch (_) {}
      } else if (n.type === 'chat') {
        const chatQs = [];
        if (roomId) chatQs.push(`chatId=${encodeURIComponent(roomId)}`);
        if (targetUserId) chatQs.push(`targetId=${encodeURIComponent(targetUserId)}`);
        action = { label: t('open_chat', 'เปิดแชต'), href: `chat.html${chatQs.length ? '?' + chatQs.join('&') : ''}` };
      } else if (n.type === 'follow') {
        action = { label: t('open_profile', 'เปิดโปรไฟล์'), href: targetUserId ? `profile.html?uid=${encodeURIComponent(targetUserId)}` : 'profile.html' };
      }
      // Support both notification_id and id.
      const nid = String(n.notification_id || n.id || '');
      return {
        id:     nid,
        type:   n.type   || 'system',
        title:  n.title  || t('notification_default_title', 'แจ้งเตือน'),
        desc:   n.description || n.desc || '',
        time:   n.created_at ? new Date(n.created_at).getTime() : Date.now(),
        unread: !n.is_read,
        action,
      };
    }).filter(n => n.id && n.id !== 'undefined'); // Drop records without valid id.
  }

  function iconByType(item) {
    const type = String(item?.type || '').toLowerCase();
    const content = `${String(item?.title || '')} ${String(item?.desc || '')}`.toLowerCase();

    if (type.includes('chat') || type.includes('message') || /แชต|ข้อความ|chat|message/.test(content)) {
      return { cls: 'chat', icon: 'forum' };
    }
    if (type.includes('follow') || /ติดตาม|follower|follow/.test(content)) {
      return { cls: 'follow', icon: 'person_add' };
    }
    if (type.includes('price') || /ราคา|price/.test(content)) {
      return { cls: 'price', icon: 'sell' };
    }
    if (type.includes('booking') || /จอง|คิว|booking|queue/.test(content)) {
      if (/ยกเลิก|cancel/.test(content)) return { cls: 'cancel', icon: 'event_busy' };
      if (/สำเร็จ|success|confirmed|ยืนยัน/.test(content)) return { cls: 'success', icon: 'check_circle' };
      return { cls: 'booking', icon: 'event_available' };
    }
    if (/เตือน|ด่วน|warning|alert/.test(content)) {
      return { cls: 'warning', icon: 'warning_amber' };
    }
    return { cls: 'system', icon: 'notifications' };
  }

  function applyFilter(list) {
    if (filter === "all") return list;
    if (filter === "unread") return list.filter(x => x.unread);
    return list;
  }

  function updateBadges() {
    const unreadCount = items.filter(x => x.unread).length;
    if (unreadBadge) unreadBadge.textContent = unreadCount;
    if (unreadBadge) unreadBadge.style.display = unreadCount > 0 ? 'inline-grid' : 'none';
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function render() {
    updateBadges();

    const filtered = applyFilter(items);

    if (!filtered.length) {
      listEl.innerHTML = "";
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    listEl.innerHTML = filtered.map((n, idx) => {
      const meta = iconByType(n);

      return `
        <div class="noti-item-container" data-id="${n.id}">
          <button class="noti-delete-btn" data-act="delete" data-id="${n.id}" type="button">
            <span class="material-icons-outlined">delete</span>
            <span>${escapeHtml(t('delete', 'ลบ'))}</span>
          </button>
          <div class="noti-item ${n.unread ? 'is-unread' : 'is-read'}" data-id="${n.id}" data-act="open">
            <div class="noti-item-icon ${meta.cls}">
              <span class="material-icons-outlined">${meta.icon}</span>
            </div>
            <div class="noti-item-body">
              <div class="noti-item-title">${escapeHtml(n.title || "")}</div>
              <div class="noti-item-desc">${escapeHtml(n.desc || "")}</div>
              <div class="noti-item-footer">
                <div class="noti-item-time">${fmtTime(n.time || Date.now())}</div>
                <div class="noti-item-status">${n.unread ? escapeHtml(t('unread', 'ยังไม่อ่าน')) : escapeHtml(t('read', 'อ่านแล้ว'))}</div>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");
    
    initSwipeToDelete();
  }

  // ----------------------------
  // Swipe to Delete Controller
  // ----------------------------
  function initSwipeToDelete() {
    const items = document.querySelectorAll('.noti-item-container');
    const DELETE_BTN_WIDTH = 80;
    
    items.forEach(container => {
      const item = container.querySelector('.noti-item');
      let startX = 0;
      let currentX = 0;
      let isSwiping = false;
      let isOpen = false;

      container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        item.style.transition = 'none';
        isSwiping = true;
      }, { passive: true });

      container.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const x = e.touches[0].clientX;
        let diff = x - startX;
        
        if (isOpen) diff -= DELETE_BTN_WIDTH;
        if (diff > 0) diff = 0;
        if (diff < -DELETE_BTN_WIDTH - 20) diff = -DELETE_BTN_WIDTH - 20;
        
        currentX = diff;
        item.style.transform = `translateX(${diff}px)`;
      }, { passive: true });

      container.addEventListener('touchend', () => {
        isSwiping = false;
        item.style.transition = 'transform 0.2s ease-out';
        
        if (currentX < -DELETE_BTN_WIDTH / 2) {
          item.style.transform = `translateX(-${DELETE_BTN_WIDTH}px)`;
          isOpen = true;
        } else {
          item.style.transform = 'translateX(0)';
          isOpen = false;
        }
      });
      
      container.addEventListener('click', (e) => {
        if (isOpen && !e.target.closest('.noti-delete-btn')) {
          e.preventDefault();
          e.stopPropagation();
          item.style.transform = 'translateX(0)';
          isOpen = false;
        }
      });
    });
  }

  function setActiveTab(key) {
    document.querySelectorAll(".noti-tab").forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.tab === key);
    });
  }

  async function deleteNotification(id) {
    if (!id) return;
    const previous = items.slice();
    items = items.filter(x => x.id !== id);
    render();
    if (window.api?.deleteNotification) {
      try {
        await window.api.deleteNotification(id);
      } catch (e) {
        items = previous;
        render();
        const msg = e?.message || t('delete_notification_failed', 'ลบแจ้งเตือนไม่สำเร็จ');
        if (window.appNotify) window.appNotify(msg, 'error');
        else console.error(msg);
      }
    }
  }

  async function markAsRead(id) {
    const item = items.find(x => x.id === id);
    const wasUnread = !!item?.unread;
    if (!wasUnread) return;
    items = items.map(x => x.id === id ? ({ ...x, unread: false }) : x);
    render();

    if (wasUnread) {
      if (window.api) {
        try {
          await window.api.markRead(id);
        } catch (_) {}
      }
    }
  }

  function clearRead() {
    items = items.filter(x => x.unread);
    render();
  }

  async function openAction(id) {
    await markAsRead(id);
    const n = items.find(x => x.id === id);
    if (!n || !n.action || !n.action.href) return;
    if (window.navigateWithTransition) window.navigateWithTransition(n.action.href); else window.location.href = n.action.href;
  }

  async function refresh() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try {
      let data = await fetchFromApi();

      items = data;
      render();
    } catch (e) {
      // Fallback to empty list so UI still renders.
      items = [];
      render();
      const msg = e?.message || t('load_notifications_failed', 'โหลดการแจ้งเตือนไม่สำเร็จ');
      if (window.appNotify) window.appNotify(msg, 'error');
      else console.error(msg);
    } finally {
      refreshInFlight = false;
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, 10000);
  }

  function stopAutoRefresh() {
    if (!refreshTimer) return;
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // events
  const tabButtons = document.querySelectorAll(".noti-tab");
  tabButtons.forEach(tab => {
    tab.addEventListener("click", () => {
      filter = tab.dataset.tab || "all";
      setActiveTab(filter);
      render();
    });
  });

  window.addEventListener('i18n:updated', () => {
    render();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoRefresh();
    else {
      refresh();
      startAutoRefresh();
    }
  });

  window.addEventListener('focus', () => {
    refresh();
  });

  listEl && listEl.addEventListener("click", async (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;

    const act = el.dataset.act;
    const id = el.dataset.id || el.closest('.noti-item')?.dataset.id;

    if (act === "delete") {
      await deleteNotification(id);
    } else if (act === "toggleRead") {
      await markAsRead(id);
    } else if (act === "open") {
      await openAction(id);
    }
  });

  refresh();
  startAutoRefresh();

  // [Pull-to-Refresh] Connect to global-anim utility
  if (window.initPullToRefresh) {
    window.initPullToRefresh(refresh);
  }
})();
