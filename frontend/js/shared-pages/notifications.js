/* js/notifications.js
   - future DB:
     - GET   {API_BASE}/api/notifications
     - PATCH {API_BASE}/api/notifications/:id/read
   - store read/unread in localStorage for now
*/

(function () {
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
  const TOKEN_KEY = (window.AUTH_TOKEN_KEY || "token");

  const listEl = document.getElementById("notiList");
  const emptyEl = document.getElementById("emptyState");

  const btnRefresh = document.getElementById("btnRefresh");
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
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_BASE}/api/notifications`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "โหลดแจ้งเตือนไม่สำเร็จ");
    const raw = Array.isArray(json) ? json : (json.data || []);

    // Map server fields to UI format.
    return raw.map(n => {
      // Build action link by notification type.
      let action = null;
      if (n.type === 'booking') {
        try {
          const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null');
          const role = (u && u.role) ? u.role.toLowerCase() : 'farmer';
          const href = role === 'buyer'
            ? '../buyer/setbooking/booking.html'
            : '../farmer/booking/booking.html';
          action = { label: t('booking_action_view', 'ดูการจอง'), href };
        } catch (_) {}
      } else if (n.type === 'chat') {
        action = { label: t('open_chat', 'เปิดแชต'), href: 'chat.html' };
      } else if (n.type === 'follow') {
        action = { label: t('open_profile', 'เปิดโปรไฟล์'), href: 'profile.html' };
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
      const divider = idx < filtered.length - 1 ? '<div class="noti-divider"></div>' : '';

      return `
        <div class="noti-item ${n.unread ? 'is-unread' : 'is-read'}" data-id="${n.id}" data-act="open">
          <div class="noti-item-icon ${meta.cls}">
            <span class="material-icons-outlined">${meta.icon}</span>
          </div>
          <div class="noti-item-body" data-act="open" data-id="${n.id}">
            <div class="noti-item-title">${escapeHtml(n.title || "")}</div>
            <div class="noti-item-desc">${escapeHtml(n.desc || "")}</div>
            <div class="noti-item-status">${n.unread ? escapeHtml(t('unread', 'ยังไม่อ่าน')) : 'อ่านแล้ว'}</div>
            <div class="noti-item-time">${fmtTime(n.time || Date.now())}</div>
          </div>
          <button class="noti-delete-btn" data-act="delete" data-id="${n.id}" type="button">${escapeHtml(t('delete', 'ลบ'))}</button>
        </div>
        ${divider}`;
    }).join("");
  }

  function setActiveTab(key) {
    document.querySelectorAll(".noti-tab").forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.tab === key);
    });
  }

  function deleteNotification(id) {
    items = items.filter(x => x.id !== id);
    render();
  }

  async function markAsRead(id) {
    const item = items.find(x => x.id === id);
    const wasUnread = !!item?.unread;
    if (!wasUnread) return;
    items = items.map(x => x.id === id ? ({ ...x, unread: false }) : x);
    render();

    if (API_BASE) {
      const token = localStorage.getItem(TOKEN_KEY) || '';
      try {
        await fetch(`${API_BASE}/api/notifications/${id}/read`, {
          method: 'PATCH',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch (_) {}
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
      btnRefresh && (btnRefresh.disabled = true);

      let data = [];
      if (API_BASE) data = await fetchFromApi();
      else data = [];

      items = data;
      render();
    } catch (e) {
      // Fallback to empty list so UI still renders.
      items = [];
      render();
    } finally {
      btnRefresh && (btnRefresh.disabled = false);
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

  if (btnRefresh) btnRefresh.addEventListener("click", refresh);

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

  listEl && listEl.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;

    const act = el.dataset.act;
    const id = el.dataset.id || el.closest('.noti-item')?.dataset.id;

    if (act === "delete") {
      deleteNotification(id);
    } else if (act === "toggleRead") {
      markAsRead(id);
    } else if (act === "open") {
      openAction(id);
    }
  });

  refresh();
  startAutoRefresh();
})();
