// ===== Favorites Store (shared) =====
window.FavoritesStore = (function () {
  const KEY = "agriprice_favorites_v1";
  const LOG_PREFIX = "[FavoritesStore]";

  function summarizeKinds(list) {
    return (list || []).reduce((acc, item) => {
      const kind = String(item?.kind || "seller");
      acc[kind] = (acc[kind] || 0) + 1;
      return acc;
    }, {});
  }

  function safeParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function read() {
    const value = safeParse(localStorage.getItem(KEY), []);
    return Array.isArray(value) ? value : [];
  }

  function write(list, skipId) {
    localStorage.setItem(KEY, JSON.stringify(list));
    console.log(`${LOG_PREFIX} write`, {
      key: KEY,
      total: Array.isArray(list) ? list.length : 0,
      byKind: summarizeKinds(list),
      skipId: skipId || "",
    });
    window.dispatchEvent(new CustomEvent("favorites:changed", { detail: { list, skipId } }));
    return list;
  }

  function has(id, kind = "any") {
    const targetId = String(id || "");
    const targetKind = String(kind || "any");
    return read().some((x) => {
      const itemId = String(x && x.id || "");
      const itemKind = String(x && x.kind || "seller");
      if (itemId !== targetId) return false;
      if (targetKind === "any") return true;
      return itemKind === targetKind;
    });
  }

  function add(item, skipId) {
    const list = read();
    const id = String(item.id || "");
    const kind = String(item.kind || "seller");
    if (!id) return list;
    if (list.some(x => String(x.id) === id && String(x.kind || "seller") === kind)) return list;
    return write([{ ...item, id, kind, updatedAt: Date.now() }, ...list], skipId);
  }

  function remove(id, skipId, kind = "any") {
    const targetId = String(id || "");
    const targetKind = String(kind || "any");
    const list = read().filter((x) => {
      const itemId = String(x && x.id || "");
      const itemKind = String(x && x.kind || "seller");
      if (itemId !== targetId) return true;
      if (targetKind === "any") return false;
      return itemKind !== targetKind;
    });
    return write(list, skipId);
  }

  function toggle(item) {
    const id = String(item.id || "");
    const kind = String(item.kind || "seller");
    const skipKey = `${kind}:${id}`;
    console.log(`${LOG_PREFIX} toggle:request`, {
      id,
      kind,
      sellerId: item?.sellerId || "",
      productId: item?.productId || "",
      name: item?.name || "",
      sub: item?.sub || "",
    });
    if (!id) return { list: read(), active: false };
    if (has(id, kind)) {
      const result = { list: remove(id, skipKey, kind), active: false };
      console.log(`${LOG_PREFIX} toggle:removed`, {
        id,
        kind,
        total: result.list?.length || 0,
        byKind: summarizeKinds(result.list || []),
      });
      return result;
    }
    const result = { list: add({ ...item, kind }, skipKey), active: true };
    console.log(`${LOG_PREFIX} toggle:added`, {
      id,
      kind,
      total: result.list?.length || 0,
      byKind: summarizeKinds(result.list || []),
    });
    return result;
  }

  return { read, write, has, add, remove, toggle, KEY };
})();

window.appNotify = function appNotify(message, type = "info") {
  if (!message) return;

  let host = document.getElementById("appNotifyHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "appNotifyHost";
    host.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "display:flex",
      "flex-direction:column",
      "gap:8px",
      "pointer-events:none",
      "max-width:min(92vw,360px)",
    ].join(";");
    document.body.appendChild(host);
  }

  const toast = document.createElement("div");
  const palette = {
    success: ["#e8f8ef", "#137a3a"],
    error: ["#fdecec", "#b42318"],
    loading: ["#eef4ff", "#1d4ed8"],
    info: ["#f4f4f5", "#374151"],
  };
  const [bg, fg] = palette[type] || palette.info;

  toast.textContent = String(message);
  toast.style.cssText = [
    "pointer-events:auto",
    "padding:12px 14px",
    "border-radius:14px",
    "box-shadow:0 10px 30px rgba(0,0,0,.12)",
    "font-size:14px",
    "line-height:1.4",
    "background:" + bg,
    "color:" + fg,
    "border:1px solid rgba(0,0,0,.08)",
  ].join(";");

  host.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    toast.style.transition = "opacity .2s ease, transform .2s ease";
    window.setTimeout(() => toast.remove(), 220);
  }, type === "loading" ? 1400 : 2400);
};

function initNativePageTransitions() {
  if (window.__AGRIPRICE_NATIVE_NAV_READY) return;
  window.__AGRIPRICE_NATIVE_NAV_READY = true;

  const LEAVE_MS = 180;

  window.navigateWithTransition = function navigateWithTransition(url, options = {}) {
    if (!url) return;
    const rawUrl = String(url);
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawUrl)) {
      window.location.href = rawUrl;
      return;
    }

    let nextUrl;
    try {
      nextUrl = new URL(rawUrl, window.location.href);
    } catch (_) {
      window.location.href = rawUrl;
      return;
    }

    const currentUrl = new URL(window.location.href);
    if (nextUrl.origin !== currentUrl.origin) {
      window.location.href = nextUrl.href;
      return;
    }

    if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
      if (nextUrl.hash) window.location.hash = nextUrl.hash;
      return;
    }

    const skipTransition = !!options.skipTransition;
    if (skipTransition) {
      window.location.href = nextUrl.href;
      return;
    }

    document.body.classList.remove('page-enter');
    document.body.classList.add('page-leave');

    window.setTimeout(() => {
      window.location.href = nextUrl.href;
    }, LEAVE_MS);
  };

  // Enter transition
  if (document.body) {
    document.body.classList.remove('page-leave');
    document.body.classList.add('page-enter');
    window.setTimeout(() => {
      document.body.classList.remove('page-enter');
    }, 260);
  }

  // Intercept normal link navigation for same-origin pages
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;

    const rawHref = anchor.getAttribute('href') || '';
    if (!rawHref || rawHref.startsWith('#')) return;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

    const nextUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (nextUrl.origin !== currentUrl.origin) return;
    if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

    e.preventDefault();
    window.navigateWithTransition(nextUrl.href);
  });
}


function getRelativePrefixToPages() {
  const path = (window.location.pathname || "").replace(/\\/g, "/");
  const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

  const idx = dir.lastIndexOf("/pages/");
  if (idx === -1) return "pages/";

  const afterPages = dir.substring(idx + "/pages/".length);
  const depth = afterPages.split("/").filter(Boolean).length;

  return "../".repeat(depth);
}

function getRelativePrefixToRoot() {
  const path = (window.location.pathname || "").replace(/\\/g, "/");
  const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

  const idx = dir.lastIndexOf("/pages/");
  if (idx === -1) return "";

  const afterPages = dir.substring(idx + "/pages/".length);
  const depth = afterPages.split("/").filter(Boolean).length;

  return "../" + "../".repeat(depth);
}

async function loadComponent(selector, url, cb) {
  const el = document.querySelector(selector);
  if (!el) return;

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
    const lowerUrl = String(url || "").toLowerCase();
    if ((selector === "#bottomNavMount" || selector === "#bottomNavPlaceholder") && lowerUrl.includes("bottom-nav")) {
      el.innerHTML = `
        <nav class="bottom-nav" id="bottomNav">
          <a href="index.html" class="bottom-nav-item" data-page="home">
            <span class="material-icons-outlined">home</span>
            <span class="nav-label" data-i18n="nav_home">หน้าแรก</span>
          </a>
          <a href="pages/shared/chat.html" class="bottom-nav-item" data-page="chat">
            <span class="material-icons-outlined">chat_bubble_outline</span>
            <span class="nav-label" data-i18n="nav_chat">แชท</span>
          </a>
          <a href="pages/farmer/booking/booking.html" class="bottom-nav-item" data-page="booking">
            <span class="material-icons-outlined">local_mall</span>
            <span class="nav-label" data-i18n="nav_booking_history">ประวัติการจอง</span>
          </a>
          <a href="pages/shared/notifications.html" class="bottom-nav-item" data-page="notifications">
            <span class="material-icons-outlined">notifications_none</span>
            <span class="nav-label" data-i18n="nav_notifications">แจ้งเตือน</span>
          </a>
          <a href="pages/account/account.html" class="bottom-nav-item" data-page="account">
            <span class="material-icons-outlined">person_outline</span>
            <span class="nav-label" data-i18n="nav_account">บัญชี</span>
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

  setTimeout(() => {
    document.querySelectorAll(".bottom-nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === page);
    });
  }, 0);
}

function fixBottomNavPaths() {
  const nav = document.getElementById("bottomNav");
  if (!nav) return;

  const prefixToRoot = getRelativePrefixToRoot();

  nav.querySelectorAll(".bottom-nav-item").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href) return;

    if (/^(https?:\/\/|#|tel:|mailto:)/i.test(href)) return;

    const normalized = href.replace(/^(\.\.\/)+/g, "");

    a.setAttribute("href", prefixToRoot + normalized);
  });
}

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
   Product Card delegation (GLOBAL)
---------------------------- */
function initProductCardsDelegation() {
  function getCurrentRole() {
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
      const user = raw ? JSON.parse(raw) : null;
      return String(user?.role || "").toLowerCase();
    } catch (_) {
      return "";
    }
  }

  function isBuyerRole() {
    return getCurrentRole() === "buyer";
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("#productCardsMount")) return;
    if (e.target.closest("#searchResultsMount")) return;
    if (e.target.closest("#allFavoritesMount")) return;
    if (e.__agripriceHandled) return;
    const favBtn =
      e.target.closest('[data-action="toggle-favorite"]') ||
      e.target.closest(".favorite-btn");

    if (favBtn) {
      if (isBuyerRole()) {
        favBtn.remove();
        return;
      }

      e.__agripriceHandled = true;
      const card = favBtn.closest(".product-card");
      const productId = card?.dataset?.productId || card?.getAttribute("data-product-id") || "";
      const sellerId = card?.dataset?.sellerId || card?.getAttribute("data-seller-id") || "";
      const favoriteKind = productId ? "product" : "seller";
      console.log("[Agriprice favorite click][components]", {
        target: e.target?.className || e.target?.tagName,
        favoriteKind,
        productId,
        sellerId,
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!card) return;

      const id =
        (favoriteKind === "product" ? (productId || card.dataset.sellerId || card.getAttribute("data-seller-id") || "") : (sellerId || card.getAttribute("data-seller-id") || "")) ||
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

      const priceA = card.querySelector('[data-bind="priceA"]')?.textContent?.trim() || "";
      const priceB = card.querySelector('[data-bind="priceB"]')?.textContent?.trim() || "";
      const priceC = card.querySelector('[data-bind="priceC"]')?.textContent?.trim() || "";
      const distance = card.querySelector('[data-bind="distance"]')?.textContent?.trim() || "";
      const updateTime = card.querySelector('[data-bind="updateTime"]')?.textContent?.trim() || "";

      const avatarSrc =
        card.querySelector('[data-bind="avatar"]')?.getAttribute("src") ||
        card.querySelector("img")?.getAttribute("src") ||
        "";

      const avatar = (avatarSrc || "").replace(/^(\.\.\/)+/g, "");

      if (!id) return;

      const payload = {
        id,
        kind: favoriteKind,
        sellerId,
        productId,
        productName: sub,
        priceA,
        priceB,
        priceC,
        distance,
        updateTime,
        name,
        sub,
        avatar,
      };

      const { active } = window.FavoritesStore.toggle(payload);

      favBtn.classList.toggle("active", active);

      if (favoriteKind === "seller") {
        const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        if (API_BASE && token) {
          if (active) {
            fetch(API_BASE + '/api/favorites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ user_id: id }),
            }).catch(() => {});
          } else {
            fetch(API_BASE + '/api/favorites/' + encodeURIComponent(id), {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token },
            }).catch(() => {});
          }
        }
      }

      return;
    }

    const openProfileEl = e.target.closest('[data-action="open-profile"], .seller-info');
    if (openProfileEl) {
      e.__agripriceHandled = true;
      if (window.AGRIPRICE_DEBUG) console.log("[Agriprice click][components] open-profile", {
        target: e.target?.className || e.target?.tagName,
        cardId: openProfileEl.closest(".product-card")?.dataset?.sellerId || "",
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const card = openProfileEl.closest(".product-card");

      const uid =
        card?.dataset?.sellerId ||
        card?.getAttribute("data-seller-id") ||
        "";

      const name =
        card?.dataset?.sellerName ||
        card?.getAttribute("data-seller-name") ||
        card?.querySelector('[data-bind="sellerName"]')?.textContent?.trim() ||
        card?.querySelector(".seller-name")?.textContent?.trim() ||
        "";

      const q = uid
        ? `uid=${encodeURIComponent(uid)}`
        : `name=${encodeURIComponent(name)}`;

      const pagesPrefix = getRelativePrefixToPages();
      window.navigateWithTransition(pagesPrefix + `shared/profile.html?${q}`);
      return;
    }

    const book = e.target.closest('[data-action="book"]');
    if (book) {
      e.__agripriceHandled = true;
      if (window.AGRIPRICE_DEBUG) console.log("[Agriprice click][components] book", {
        target: e.target?.className || e.target?.tagName,
        cardId: book.closest(".product-card")?.dataset?.sellerId || "",
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      localStorage.setItem("bookingReferrer", window.location.href);

      const bookCard = book.closest(".product-card");
      if (bookCard) {
        const sid  = bookCard.dataset.sellerId   || bookCard.getAttribute("data-seller-id")  || "";
        const sname= bookCard.dataset.sellerName || bookCard.getAttribute("data-seller-name") ||
                     bookCard.querySelector('[data-bind="sellerName"]')?.textContent?.trim() || "";
        const spid = bookCard.dataset.productId  || bookCard.getAttribute("data-product-id") || "";
        if (sid)   localStorage.setItem("bookingFarmerId",   sid);
        if (sname) localStorage.setItem("bookingFarmerName", sname);
        if (spid)  localStorage.setItem("bookingProductId",  spid);
      }

      const pagesPrefix = getRelativePrefixToPages();

      let role = "farmer";
      try {
        const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
        const u = raw ? JSON.parse(raw) : null;
        if (u && u.role) role = String(u.role);
      } catch (_) {}

      const nextHref = role === "buyer"
        ? pagesPrefix + "buyer/setbooking/booking.html"
        : pagesPrefix + "farmer/booking/booking-step1.html";
      window.navigateWithTransition(nextHref);
      return;
    }

    const contact = e.target.closest('[data-action="contact"]');
    if (contact) {
      e.__agripriceHandled = true;
      if (window.AGRIPRICE_DEBUG) console.log("[Agriprice click][components] contact", {
        target: e.target?.className || e.target?.tagName,
        cardId: contact.closest(".product-card")?.dataset?.sellerId || "",
      });
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (window.AGRIPRICE_DEBUG) console.log("contact clicked");
      return;
    }
  });

  window.syncFavoritesUI = function syncFavoritesUI(skipId) {
    if (isBuyerRole()) {
      document.querySelectorAll('[data-action="toggle-favorite"], .favorite-btn').forEach((btn) => btn.remove());
      return;
    }

    document.querySelectorAll(".product-card").forEach((card) => {
      const productId = card.dataset.productId || card.getAttribute("data-product-id") || "";
      const sellerId = card.dataset.sellerId || card.getAttribute("data-seller-id") || "";
      const kind = productId ? "product" : "seller";
      const id = kind === "product" ? productId : sellerId;
      const cardKey = `${kind}:${id}`;
      if (skipId && String(cardKey) === String(skipId)) return;
      const isFav = id ? window.FavoritesStore.has(id, kind) : false;

      const favBtn =
        card.querySelector('[data-action="toggle-favorite"]') ||
        card.querySelector(".favorite-btn");

      if (favBtn) {
        favBtn.classList.toggle("active", !!isFav);
      }
    });
  };

  window.addEventListener("favorites:changed", (e) => {
    window.syncFavoritesUI?.(e?.detail?.skipId);
  });
}


/* ---------------------------
  Topbar helpers
---------------------------- */
function wireTopbar(options = {}) {
  const titleEl = document.querySelector("[data-title]");
  const subEl = document.querySelector("[data-subtitle]");
  const backBtn = document.querySelector("[data-back]");

  if (titleEl && options.title) titleEl.textContent = options.title;
  if (subEl && options.subtitle) subEl.textContent = options.subtitle;

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (options.backTo) {
        window.navigateWithTransition(options.backTo);
      }
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

  const url = getRelativePrefixToRoot() + "components/bottom-nav/bottom-nav.html";

  await loadComponent("#" + mount.id, url, () => {
    fixBottomNavPaths();
    applyRoleBasedNav();
    setActiveNavFromBody();
    if (window.i18nInit) window.i18nInit();
  });
}

/* ---------------------------
   Init
---------------------------- */
(function initComponents() {
  initNativePageTransitions();

  autoLoadBottomNav();

  initProductCardsDelegation();

  // Sync favorites from API on startup.
  (function syncFavoritesFromApi() {
    let role = "";
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
      const user = raw ? JSON.parse(raw) : null;
      role = String(user?.role || "").toLowerCase();
    } catch (_) {}
    if (role === "buyer") return;

    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
    if (!API_BASE || !token) return;
    fetch(API_BASE + '/api/favorites', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : null).then(json => {
      if (!json) return;
      const arr = Array.isArray(json) ? json : (json.data || []);
      const store = window.FavoritesStore;
      if (!store) return;
      const before = store.read();
      console.log('[favorites sync] before merge', {
        apiCount: arr.length,
        localTotal: before.length,
        localByKind: before.reduce((acc, item) => {
          const k = String(item?.kind || 'seller');
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      });
      const apiIds = new Set(arr.map(item => String(item.target_user_id || item.user_id || item.id || '')).filter(Boolean));
      const local = store.read().filter(item => {
        const kind = String(item?.kind || 'seller');
        if (kind !== 'seller') return true;
        return apiIds.has(String(item?.id || ''));
      });
      arr.forEach(item => {
        const id = String(item.target_user_id || item.user_id || item.id || '');
        if (id && !local.find(x => String(x.id) === id && String(x.kind || 'seller') === 'seller')) {
          local.push({ id, kind: 'seller', name: `${item.first_name||''} ${item.last_name||''}`.trim(), sub: item.tagline || '', avatar: item.avatar || '' });
        }
      });
      console.log('[favorites sync] after merge', {
        mergedTotal: local.length,
        mergedByKind: local.reduce((acc, item) => {
          const k = String(item?.kind || 'seller');
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {}),
      });
      store.write(local);
      window.syncFavoritesUI?.();
    }).catch(() => {});
  })();

  // Global unread chat badge.
  function updateChatBadgeGlobal() {
    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
    const token = localStorage.getItem(TOKEN_KEY) || '';
    const clearBadge = () => {
      document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
      });
    };

    if (!API_BASE || !token) {
      clearBadge();
      return;
    }
    fetch(API_BASE + '/api/chats/unread', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : null).then(json => {
      if (!json) {
        clearBadge();
        return;
      }
      const count = json.unread_count || 0;
      document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge').forEach(el => {
        el.textContent = count > 99 ? '99+' : (count || '');
        el.style.display = count > 0 ? 'flex' : 'none';
      });
    }).catch(() => {
      clearBadge();
    });
  }
  setTimeout(updateChatBadgeGlobal, 1500);
  setInterval(updateChatBadgeGlobal, 10000);

  fixBottomNavPaths();
  applyRoleBasedNav();
  setActiveNavFromBody();
})();
