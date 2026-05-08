/**
 * AGRIPRICE - Component Loader (offline-friendly)
 * รองรับทั้ง file:// และ http(s)://
 *
 * Mount ที่รองรับ:
 *  - #bottomNavMount (แนะนำ)
 *  - #bottomNavPlaceholder (legacy)
 *  - #sideMenuMount (แนะนำ)
 *  - #sideMenuPlaceholder (legacy)
 *
 * Active bottom nav:
 *  - ใส่ <body data-active="home|chat|booking|notifications|account|...">
 */
// ===== Favorites Store (shared) =====
window.FavoritesStore = (function () {
  const KEY = "agriprice_favorites_v1";

  function safeParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function read() {
    return safeParse(localStorage.getItem(KEY), []);
  }

  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("favorites:changed", { detail: list }));
    return list;
  }

  function has(id) {
    return read().some(x => String(x.id) === String(id));
  }

  function add(item) {
    const list = read();
    const id = String(item.id || "");
    if (!id) return list;
    if (list.some(x => String(x.id) === id)) return list;
    return write([{ ...item, id, updatedAt: Date.now() }, ...list]);
  }

  function remove(id) {
    const list = read().filter(x => String(x.id) !== String(id));
    return write(list);
  }

  function toggle(item) {
    const id = String(item.id || "");
    if (!id) return { list: read(), active: false };
    if (has(id)) return { list: remove(id), active: false };
    return { list: add(item), active: true };
  }

  return { read, write, has, add, remove, toggle, KEY };
})();

/* ---------------------------
   Helpers
---------------------------- */
function isInPages() {
  return window.location.pathname.includes("/pages/");
}

/**
 * คำนวณ prefix ที่ “ย้อนกลับไป root โปรเจกต์”
 * - root: ""                         (index.html)
 * - pages/: "../"                    (pages/chat.html)
 * - pages/booking/: "../../"         (pages/booking/booking-step1.html)
 */
function getRelativePrefixToRoot() {
  const path = (window.location.pathname || "").replace(/\\/g, "/");
  const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

  const idx = dir.lastIndexOf("/pages/");
  if (idx === -1) return ""; // อยู่ root แล้ว

  const afterPages = dir.substring(idx + "/pages/".length); // เช่น "booking/"
  const depth = afterPages.split("/").filter(Boolean).length; // booking/ => 1

  // ออกจาก pages 1 ชั้น + ออกจากโฟลเดอร์ย่อยใน pages อีก depth ชั้น
  return "../" + "../".repeat(depth);
}

/**
 * คำนวณ prefix ที่ “ไปยังโฟลเดอร์ pages/”
 * - root -> "pages/"
 * - pages/* -> ""                    (อยู่ใน pages แล้ว)
 * - pages/booking/* -> "../"         (ถอยกลับไปที่ pages/)
 */
function getRelativePrefixToPages() {
  const path = (window.location.pathname || "").replace(/\\/g, "/");
  const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

  const idx = dir.lastIndexOf("/pages/");
  if (idx === -1) return "pages/"; // อยู่ root -> ต้องเข้าหน้า pages/

  const afterPages = dir.substring(idx + "/pages/".length);
  const depth = afterPages.split("/").filter(Boolean).length;

  return "../".repeat(depth); // pages/ => depth 0 => "", pages/booking/ => depth 1 => "../"
}

/**
 * โหลด HTML component เข้า mount
 * - ถ้า fetch ใช้ไม่ได้ (file://) จะไม่ throw เพื่อไม่ทำให้หน้าอื่นพัง
 * - รองรับ signature: loadComponent(selector, url) และ loadComponent(selector, url, cb)
 */
async function loadComponent(selector, url, cb) {
  const el = document.querySelector(selector);
  if (!el) return;

  // ถ้ามี inline อยู่แล้ว ให้ใช้เลย
  if (el.innerHTML && el.innerHTML.trim()) {
    if (typeof cb === "function") cb();
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    el.innerHTML = await res.text();
    if (typeof cb === "function") cb();
  } catch (e) {
    // file:// มัก fetch ไม่ได้ -> ทำ fallback แบบ inline เฉพาะ component สำคัญ
    // เพื่อให้ navbar ไม่หายตอนรันบน Capacitor/Android (file://)
    const lowerUrl = String(url || "").toLowerCase();
    if ((selector === "#bottomNavMount" || selector === "#bottomNavPlaceholder") && lowerUrl.includes("bottom-nav")) {
      // Inline bottom nav (เหมือน components/bottom-nav/bottom-nav.html)
      el.innerHTML = `
        <nav class="bottom-nav" id="bottomNav">
          <a href="index.html" class="bottom-nav-item" data-page="home">
            <span class="material-icons-outlined">home</span>
            <span class="nav-label">หน้าแรก</span>
          </a>
          <a href="pages/shared/chat.html" class="bottom-nav-item" data-page="chat">
            <span class="material-icons-outlined">chat_bubble_outline</span>
            <span class="nav-label">แชท</span>
          </a>
          <a href="pages/farmer/booking/booking.html" class="bottom-nav-item" data-page="booking">
            <span class="material-icons-outlined">local_mall</span>
            <span class="nav-label">ประวัติการจอง</span>
          </a>
          <a href="pages/shared/notifications.html" class="bottom-nav-item" data-page="notifications">
            <span class="material-icons-outlined">notifications_none</span>
            <span class="nav-label">แจ้งเตือน</span>
          </a>
          <a href="pages/account/account.html" class="bottom-nav-item" data-page="account">
            <span class="material-icons-outlined">person_outline</span>
            <span class="nav-label">บัญชี</span>
          </a>
        </nav>
      `;
    } else {
      console.info("Component fetch not available or already inlined:", url);
    }
    if (typeof cb === "function") cb();
  }
}

/* ---------------------------
   Bottom Nav helpers
---------------------------- */
function setActiveNavFromBody() {
  const page = document.body?.dataset?.active;
  if (!page) return;

  // delay เล็กน้อย เผื่อเพิ่ง inject
  setTimeout(() => {
    document.querySelectorAll(".bottom-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === page);
    });
  }, 0);
}

/**
 * bottom-nav.html ในโปรเจกต์นี้เขียน href แบบ root-friendly (เช่น index.html, pages/chat.html)
 * ฟังก์ชันนี้จะปรับ path ให้ถูกตามความลึกของหน้า (root/pages/pages/booking)
 */
function fixBottomNavPaths() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  const prefixToRoot = getRelativePrefixToRoot();

  nav.querySelectorAll(".bottom-nav-item").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href) return;

    // ถ้าเป็นลิงก์ภายนอก/anchor/โทร/เมล ไม่แตะ
    if (/^(https?:\/\/|#|tel:|mailto:)/i.test(href)) return;

    // ทำให้เป็น root-friendly ก่อน (ตัด ../ ที่อาจติดมา)
    const normalized = href.replace(/^(\.\.\/)+/g, "");

    // แล้วค่อยใส่ prefix ตามหน้าปัจจุบัน
    a.setAttribute("href", prefixToRoot + normalized);
  });
}

// ปรับลิงก์บางปุ่มใน bottom nav ให้ตรงตาม role (farmer/buyer)
function applyRoleBasedNav() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  let role = "farmer";
  try {
    const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.role) role = String(u.role);
  } catch (_) {}

  const prefixToRoot = getRelativePrefixToRoot();

  // booking: farmer -> pages/farmer/booking/booking.html
  //         buyer  -> pages/buyer/setbooking/booking.html
  const bookingA = nav.querySelector('.bottom-nav-item[data-page="booking"]');
  if (bookingA) {
    const target = role === "buyer"
      ? "pages/buyer/setbooking/booking.html"
      : "pages/farmer/booking/booking.html";
    bookingA.setAttribute("href", prefixToRoot + target);
  }
}

function setActiveBottomNav(pageKey) {
  document.querySelectorAll(".bottom-nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageKey);
  });
}

/* ---------------------------
   Side menu
---------------------------- */
function initSideMenu() {
  const btn = document.getElementById("hamburgerBtn");
  const overlay = document.getElementById("menuOverlay");
  const menu = document.getElementById("sideMenu");
  if (!btn || !overlay || !menu) return;

  btn.addEventListener("click", () => {
    menu.classList.add("active");
    overlay.classList.add("active");
  });
  overlay.addEventListener("click", () => {
    menu.classList.remove("active");
    overlay.classList.remove("active");
  });
}

/* ---------------------------
   Product Card delegation
---------------------------- */
/* ---------------------------
   Product Card delegation (GLOBAL)
   - Favorite -> FavoritesStore (localStorage) + emit favorites:changed
   - Open profile / Booking step1 -> path ถูกทุกระดับ
---------------------------- */
function initProductCardsDelegation() {
  document.addEventListener("click", function (e) {
    // =========================
    // 1) Toggle favorite (ใช้ได้ทั้ง .favorite-btn และ [data-action="toggle-favorite"])
    // =========================
    const favBtn =
      e.target.closest('[data-action="toggle-favorite"]') ||
      e.target.closest(".favorite-btn");

    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();

      const card = favBtn.closest(".product-card");
      if (!card) return;

      // ดึงข้อมูลจาก data- (ดีที่สุด) + fallback จาก data-bind ใน template
      const id =
        card.dataset.sellerId ||
        card.getAttribute("data-seller-id") ||
        "";

      const name =
        card.dataset.sellerName ||
        card.getAttribute("data-seller-name") ||
        card.querySelector('[data-bind="sellerName"]')?.textContent?.trim() ||
        card.querySelector(".seller-name")?.textContent?.trim() ||
        "";

      const sub =
        card.querySelector('[data-bind="sellerSub"]')?.textContent?.trim() ||
        card.querySelector(".seller-sub")?.textContent?.trim() ||
        "";

      const avatarSrc =
        card.querySelector('[data-bind="avatar"]')?.getAttribute("src") ||
        card.querySelector("img")?.getAttribute("src") ||
        "";

      // เก็บ avatar ให้เป็น root-friendly (ตัด ../ ออก)
      const avatar = (avatarSrc || "").replace(/^(\.\.\/)+/g, "");

      const payload = { id, name, sub, avatar };

      // toggle ใน store กลาง (ถ้าไม่มี id ก็ไม่ทำ)
      const { active } = window.FavoritesStore.toggle(payload);

      // update UI
      favBtn.classList.toggle("active", active);

      return;
    }

    // =========================
    // 2) Open profile
    // =========================
    // เปิดโปรไฟล์เฉพาะจุดที่ตั้งใจ (กันปุ่มอื่นที่ใช้ class btn-contact ในหน้า myprofile)
    const openProfileEl = e.target.closest('[data-action="open-profile"], .seller-info');
    if (openProfileEl) {
      e.preventDefault();
      e.stopPropagation();

      const card = openProfileEl.closest(".product-card");
      const name =
        card?.dataset?.sellerName ||
        card?.getAttribute("data-seller-name") ||
        card?.querySelector('[data-bind="sellerName"]')?.textContent?.trim() ||
        card?.querySelector(".seller-name")?.textContent?.trim() ||
        "";

      const pagesPrefix = getRelativePrefixToPages();
      window.location.href = pagesPrefix + "shared/profile.html?seller=" + encodeURIComponent(name);
      return;
    }

    // =========================
    // 3) Booking step1
    // =========================
    // ไปจองคิวเฉพาะปุ่มที่เป็น data-action="book" จริง (กันปุ่ม edit-purchase ที่ใช้ class btn-book)
    const book = e.target.closest('[data-action="book"]');
    if (book) {
      e.preventDefault();
      e.stopPropagation();

      localStorage.setItem("bookingReferrer", window.location.href);

      const pagesPrefix = getRelativePrefixToPages();

      // ปรับเส้นทางตาม role (UI เหมือนกัน แต่ data/flow ต่างกัน)
      let role = "farmer";
      try {
        const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
        const u = raw ? JSON.parse(raw) : null;
        if (u && u.role) role = String(u.role);
      } catch (_) {}

      window.location.href =
        role === "buyer"
          ? pagesPrefix + "buyer/setbooking/booking.html"
          : pagesPrefix + "farmer/booking/booking-step1.html";
      return;
    }

    // =========================
    // 4) Contact (เผื่อไว้)
    // =========================
    const contact = e.target.closest('[data-action="contact"]');
    if (contact) {
      e.preventDefault();
      e.stopPropagation();
      console.log("contact clicked");
      return;
    }
  });

  // =========================
  // Sync favorite state on render (optional helper)
  // ถ้าหน้าไหน render การ์ดใหม่แล้วอยาก sync ให้เรียก window.syncFavoritesUI()
  // =========================
  window.syncFavoritesUI = function syncFavoritesUI() {
    document.querySelectorAll(".product-card").forEach((card) => {
      const id = card.dataset.sellerId || card.getAttribute("data-seller-id") || "";
      const isFav = id ? window.FavoritesStore.has(id) : false;

      const favBtn =
        card.querySelector('[data-action="toggle-favorite"]') ||
        card.querySelector(".favorite-btn");

      if (favBtn) favBtn.classList.toggle("active", !!isFav);
    });
  };

  // อัปเดต UI ทุกครั้งที่ favorites เปลี่ยน (เช่นกดหัวใจจากหน้าอื่น)
  window.addEventListener("favorites:changed", () => {
    window.syncFavoritesUI?.();
  });
}


/* ---------------------------
   Topbar helpers (ใช้ในหน้าใหม่)
---------------------------- */
function wireTopbar(options = {}) {
  const titleEl = document.querySelector("[data-title]");
  const subEl = document.querySelector("[data-subtitle]");
  const backBtn = document.querySelector("[data-back]");

  if (titleEl && options.title) titleEl.textContent = options.title;
  if (subEl && options.subtitle) subEl.textContent = options.subtitle;

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (options.backTo) window.location.href = options.backTo;
      else history.back();
    });
  }
}

/* ---------------------------
   Auto inject components
---------------------------- */
async function autoLoadBottomNav() {
  const mount =
    document.getElementById("bottomNavMount") ||
    document.getElementById("bottomNavPlaceholder");
  if (!mount) return;

  // ✅ ใช้ prefix ตามความลึกจริง (pages/booking ต้อง ../../)
  const url = getRelativePrefixToRoot() + "components/bottom-nav/bottom-nav.html";

  await loadComponent("#" + mount.id, url, () => {
    fixBottomNavPaths();
    applyRoleBasedNav();
    setActiveNavFromBody();
  });
}

async function autoLoadSideMenu() {
  const mount =
    document.getElementById("sideMenuMount") ||
    document.getElementById("sideMenuPlaceholder");
  if (!mount) return;

  // ✅ ใช้ prefix ตามความลึกจริง
  const url = getRelativePrefixToRoot() + "components/side-menu/side-menu.html";

  await loadComponent("#" + mount.id, url, () => {
    initSideMenu();
  });
}

/* ---------------------------
   Init
---------------------------- */
(function initComponents() {
  autoLoadBottomNav();
  autoLoadSideMenu();

  initProductCardsDelegation();

  // เผื่อบางหน้ามี bottom nav inline อยู่แล้ว
  fixBottomNavPaths();
  applyRoleBasedNav();
  setActiveNavFromBody();
})();
