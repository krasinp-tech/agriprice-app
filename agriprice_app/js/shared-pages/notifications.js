/* js/notifications.js
   - default: mock notifications
   - future DB:
     - GET   {API_BASE}/api/notifications
     - PATCH {API_BASE}/api/notifications/:id/read
   - store read/unread in localStorage for now
*/

(function () {
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
  const TOKEN_KEY = (window.AUTH_TOKEN_KEY || "token");
  const STORE_KEY = "agriprice_notifications_v1";

  const listEl = document.getElementById("notiList");
  const emptyEl = document.getElementById("emptyState");

  const btnRefresh = document.getElementById("btnRefresh");
  const unreadBadge = document.getElementById("unreadBadge");

  let filter = "all";
  let items = [];

  function safeParse(s, fallback) {
    try {
      // JSON.parse(null) yields null, which we don't want — prefer fallback.
      if (s === null || s === undefined) return fallback;
      const v = JSON.parse(s);
      return v === null ? fallback : v;
    } catch { return fallback; }
  }

  function mockNotifications() {
    const now = Date.now();
    let role = "farmer";
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
      const u = raw ? JSON.parse(raw) : null;
      if (u && u.role) role = String(u.role);
    } catch (_) {}

    const bookingHref = role === "buyer"
      ? "../pages/buyer/setbooking/booking.html"
      : "../pages/farmer/booking/booking.html";

    return [
      {
        id: "n1",
        type: "price",
        title: "ล้งนี้มีการอัปเดตราคาใหม่",
        desc: "ทุเรียนหมอนทอง เกรด A ปรับขึ้นเป็น 165 บาท/กก.",
        time: now - 6 * 60 * 1000,
        unread: true,
        action: { label: "ดูราคา", href: "../index.html" },
      },
      {
        id: "n2",
        type: "booking",
        title: "อีก 30 นาทีจะถึงคิวของคุณ",
        desc: "โปรดเตรียมสินค้าและเอกสารให้พร้อมก่อนถึงเวลานัดหมาย",
        time: now - 22 * 60 * 1000,
        unread: true,
        action: { label: "ดูการจอง", href: bookingHref },
      },
      {
        id: "n3",
        type: "system",
        title: "อัปเดตระบบสำเร็จ",
        desc: "เพิ่มหน้าแจ้งเตือนแบบแบ่งหมวดหมู่ และทำเครื่องหมายว่าอ่านแล้วได้",
        time: now - 5 * 60 * 60 * 1000,
        unread: false,
        action: null,
      },
      {
        id: "n4",
        type: "price",
        title: "ราคาปรับลงเล็กน้อย",
        desc: "มังคุด เกรดส่งออก ปรับลง 3 บาท/กก. (อัปเดตล่าสุด)",
        time: now - 28 * 60 * 60 * 1000,
        unread: false,
        action: { label: "ดูรายละเอียด", href: "../index.html" },
      },
    ];
  }

  function fmtTime(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "เมื่อสักครู่";
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
    return `${Math.floor(h / 24)} วันที่แล้ว`;
  }

  function getStoreMap() {
    const raw = localStorage.getItem(STORE_KEY);
    const saved = safeParse(raw, []) || [];
    return new Map(saved.map(x => [String(x.id), !!x.unread]));
  }

  function saveStoreState() {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify(items.map(x => ({ id: x.id, unread: !!x.unread })))
    );
  }

  function mergeReadState(list) {
    const map = getStoreMap();
    return list.map(x => map.has(String(x.id)) ? { ...x, unread: map.get(String(x.id)) } : x);
  }

  async function fetchFromApi() {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_BASE}/api/notifications`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "โหลดแจ้งเตือนไม่สำเร็จ");
    return Array.isArray(json) ? json : (json.data || []);
  }

  function iconByType(type) {
    if (type === "price") return { cls: "price", icon: "trending_up" };
    if (type === "booking") return { cls: "booking", icon: "schedule" };
    return { cls: "system", icon: "info" };
  }

  function applyFilter(list) {
    if (filter === "all") return list;
    if (filter === "unread") return list.filter(x => x.unread);
    return list;
  }

  function updateBadges() {
    const unreadCount = items.filter(x => x.unread).length;
    if (unreadBadge) unreadBadge.textContent = unreadCount;
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
      const meta = iconByType(n.type);
      const divider = idx < filtered.length - 1 ? '<div class="noti-divider"></div>' : '';

      return `
        <div class="noti-item" data-id="${n.id}">
          <div class="noti-item-icon ${meta.cls}">
            <span class="material-icons-outlined">${meta.icon}</span>
          </div>
          <div class="noti-item-body">
            <div class="noti-item-title">${escapeHtml(n.title || "")}</div>
            <div class="noti-item-desc">${escapeHtml(n.desc || "")}</div>
            <div class="noti-item-time">${fmtTime(n.time || Date.now())}</div>
          </div>
          <button class="noti-delete-btn" data-act="delete" data-id="${n.id}" type="button">ลบ</button>
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
    saveStoreState();
    render();
  }

  function toggleRead(id) {
    items = items.map(x => x.id === id ? ({ ...x, unread: !x.unread }) : x);
    saveStoreState();
    render();
  }

  function markAllRead() {
    items = items.map(x => ({ ...x, unread: false }));
    saveStoreState();
    render();
  }

  function clearRead() {
    items = items.filter(x => x.unread);
    saveStoreState();
    render();
  }

  function openAction(id) {
    const n = items.find(x => x.id === id);
    if (!n || !n.action || !n.action.href) return;
    window.location.href = n.action.href;
  }

  async function refresh() {
    try {
      btnRefresh && (btnRefresh.disabled = true);

      let data = [];
      if (API_BASE) data = await fetchFromApi();
      else data = mockNotifications();

      items = mergeReadState(data);
      saveStoreState();
      render();
    } catch (e) {
      // fallback: mock เพื่อไม่ให้หน้าว่าง
      items = mergeReadState(mockNotifications());
      saveStoreState();
      render();
    } finally {
      btnRefresh && (btnRefresh.disabled = false);
    }
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

  listEl && listEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === "delete") {
      deleteNotification(id);
    } else if (act === "toggleRead") {
      toggleRead(id);
    } else if (act === "open") {
      openAction(id);
    }
  });

  // init
  refresh();
})();
