(function setupMobileBackButtonHandler() {
  // Cordova/Capacitor: intercept backbutton globally
  document.addEventListener('deviceready', function() {
    document.addEventListener('backbutton', function(e) {
      // Detect page categories
      var path = window.location.pathname.toLowerCase();
      var isHome = path.endsWith('index.html') || path === '/' || path === '/index.html' || path.endsWith('home.html');
      var isRootTab = isHome ||
                      path.endsWith('chat.html') ||
                      path.endsWith('booking.html') ||
                      path.endsWith('notifications.html') ||
                      path.endsWith('account.html');

      if (isHome) {
        // Show confirm dialog or block exit
        if (window.navigator && window.navigator.notification && window.navigator.notification.confirm) {
          window.navigator.notification.confirm(
            window.i18nT ? window.i18nT('exit_app_confirm', 'คุณต้องการออกจากแอพหรือไม่?') : 'คุณต้องการออกจากแอพหรือไม่?',
            function(buttonIndex) {
              if (buttonIndex === 1) { // 1 = OK
                navigator.app.exitApp();
              }
            },
            window.i18nT ? window.i18nT('exit_app_title', 'ออกจากระบบ') : 'ออกจากระบบ',
            [
              window.i18nT ? window.i18nT('confirm', 'ตกลง') : 'ตกลง',
              window.i18nT ? window.i18nT('cancel', 'ยกเลิก') : 'ยกเลิก'
            ]
          );
        } else {
          const message = window.i18nT ? window.i18nT('exit_app_confirm', 'คุณต้องการออกจากแอพหรือไม่?') : 'คุณต้องการออกจากแอพหรือไม่?';
          if (window.showConfirm) {
            window.showConfirm(message, function(agreed) {
              if (agreed) navigator.app.exitApp();
            });
          }
        }
        e.preventDefault();
        return false;
      } else if (isRootTab) {
        // Switch to Home tab directly instead of going back through linear page histories
        const baseRoot = typeof getRelativePrefixToRoot === 'function' ? getRelativePrefixToRoot() : './';
        const cap = window.Capacitor;
        const capPlatform = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : '';
        const isNative = (
          window.location.protocol === 'capacitor:' ||
          window.location.protocol === 'ionic:' ||
          (window.Capacitor && window.Capacitor.isNative) ||
          capPlatform === 'android' ||
          capPlatform === 'ios' ||
          !!cap?.isNative ||
          (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.location.hostname === 'localhost' && window.location.port === '')
        );
        window.location.href = baseRoot + (isNative ? 'home.html' : 'index.html');
        e.preventDefault();
        return false;
      } else {
        // Not home: go back in history
        window.history.back();
        e.preventDefault();
        return false;
      }
    }, false);
  }, false);
})();
// ===== Components Initializer Guard =====
if (window.__AGRIPRICE_COMPONENTS_READY) {
  if (window.AGRIPRICE_DEBUG) console.log("[Components] Already loaded, skipping re-init");
} else {
  window.__AGRIPRICE_COMPONENTS_READY = true;
  const IS_EMBEDDED_FRAME = (() => {
    try { return window.self !== window.top; } catch (_) { return true; }
  })();

  // ===== Shared business rules =====
  window.AgriPriceRules = window.AgriPriceRules || {
    STALE_DAYS: 7,
    getStaleDays(dateLike) {
      if (!dateLike) return null;
      const parsed = new Date(dateLike);
      if (Number.isNaN(parsed.getTime())) return null;
      const diffMs = Date.now() - parsed.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    },
    isStaleDate(dateLike) {
      const days = this.getStaleDays(dateLike);
      return days == null ? true : days > this.STALE_DAYS;
    },
    isStaleProduct(product) {
      if (!product) return true;
      const lastUpdate = product.updated_at || product.created_at;
      return this.isStaleDate(lastUpdate);
    }
  };

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
      if (window.AGRIPRICE_DEBUG) {
        // Guarded by debug flag but actually we will just remove for extreme clean
      }
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
      if (window.AGRIPRICE_DEBUG) {
        // request log removed
      }
      if (!id) return { list: read(), active: false };
      if (has(id, kind)) {
        const result = { list: remove(id, skipKey, kind), active: false };
        if (window.AGRIPRICE_DEBUG) {
          // removed log
        }
        return result;
      }
      const result = { list: add({ ...item, kind }, skipKey), active: true };
      if (window.AGRIPRICE_DEBUG) {
        // removed log
      }
      return result;
    }

    return { read, write, has, add, remove, toggle, KEY };
  })();


  function initNativePageTransitions() {
    if (window.__AGRIPRICE_NATIVE_NAV_READY) return;
    window.__AGRIPRICE_NATIVE_NAV_READY = true;

    const LEAVE_MS = 180;

    if (!window.navigateWithTransition) {
      window.navigateWithTransition = function navigateWithTransition(url, options = {}) {
        if (window.AgriPriceRouter && window.AgriPriceRouter.navigate) {
          window.AgriPriceRouter.navigate(url, options);
        } else {
          window.location.href = url;
        }
      };
    }

    // 🚀 View Transitions API handles page animations natively.
    // We only intercept bottom-nav clicks for auth guard purposes.
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;

      const anchor = e.target.closest('a[href]');
      if (!anchor) return;

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return;

      // Only guard protected Bottom Nav tabs
      const isBottomNav = anchor.closest('.bottom-nav-item');
      if (!isBottomNav) return;

      const pageKey = isBottomNav.dataset.page;
      // ป้องกันการโหลดซ้ำหน้าเดิม (ป้องกันหน้าขาว/กระพริบ)
      if (document.body && document.body.dataset.active === pageKey) {
        e.preventDefault();
        return;
      }

      const protectedPages = ['chat', 'booking', 'notifications', 'account'];

      if (protectedPages.includes(pageKey)) {
        const tokenKey = window.AUTH_TOKEN_KEY || 'token';
        const isLoggedIn = window.AuthGuard ? window.AuthGuard.isLoggedIn() : !!localStorage.getItem(tokenKey);
        if (!isLoggedIn) {
          e.preventDefault();
          if (window.AuthGuard && window.AuthGuard.requireLogin) {
            window.AuthGuard.requireLogin();
          } else {
            const pagesPrefix = getRelativePrefixToPages();
            window.location.href = pagesPrefix + "auth/login1.html";
          }
        }
      }
      // If logged in: browser navigates natively, View Transitions API animates it
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
    const idx = path.lastIndexOf("/pages/");
    if (idx === -1) return "./";
    // Calculate depth after /pages/
    const afterPages = path.substring(idx + "/pages/".length);
    const segments = afterPages.split("/").filter(Boolean);
    const depth = segments.length > 0 ? segments.length - 1 : 0;
    // Depth 0 means inside pages/ (e.g. pages/test.html) -> need one ../ to get to root
    // Depth 1 means inside pages/shared/ (e.g. pages/shared/chat.html) -> need two ../ to get to root
    return "../" + "../".repeat(depth);
  }

  async function loadComponent(selector, url, cb) {
    const el = document.querySelector(selector);
    if (!el) return;

    // If already has content, just run callback
    if (el.innerHTML && el.innerHTML.trim()) {
      if (typeof cb === "function") cb();
      return;
    }

    // Pre-defined static HTML for Bottom Nav to prevent flicker
    if (selector === "#bottomNavMount" || selector === "#bottomNavPlaceholder") {
      el.innerHTML = `
      <nav class="bottom-nav" id="bottomNav" style="view-transition-name: main-navigation;">
        <a href="index.html" class="bottom-nav-item" data-page="home">
          <span class="material-icons-outlined">home</span>
          <span class="nav-label" data-i18n="nav_home">หน้าแรก</span>
        </a>
        <a href="pages/shared/chat.html" class="bottom-nav-item" data-page="chat" style="position:relative;">
          <span class="material-icons-outlined">chat_bubble_outline</span>
          <span class="nav-badge" style="display:none;position:absolute;top:2px;right:8px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;border-radius:8px;align-items:center;justify-content:center;padding:0 3px;"></span>
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
      if (typeof cb === "function") cb();
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      el.innerHTML = await res.text();
      if (typeof cb === "function") cb();
    } catch (e) {
      console.info("Component fetch failed, using fallback logic if available:", url);
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

    const base = getRelativePrefixToRoot(); // e.g. "../../" or "./"

    const cap = window.Capacitor;
    const capPlatform = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : '';
    const isNative = (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:' ||
      (window.Capacitor && window.Capacitor.isNative) ||
      capPlatform === 'android' ||
      capPlatform === 'ios' ||
      !!cap?.isNative ||
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.location.hostname === 'localhost' && window.location.port === '')
    );

    nav.querySelectorAll(".bottom-nav-item").forEach((a) => {
      let href = a.getAttribute("href") || "";
      // Skip if already absolute, external, or special
      if (!href || /^(https?:\/\/|#|tel:|mailto:|\/)/i.test(href)) return;

      // Swap index.html to home.html for native shell-less routing
      if (isNative && href.endsWith("index.html")) {
        href = href.replace("index.html", "home.html");
      }

      // 1. Clean existing relative indicators to make it idempotent
      let clean = href.replace(/^(\.\.\/)+/g, "").replace(/^(\.\/)+/g, "");
      // 2. Ensure exactly one "pages/" prefix for subfolder links if missing
      // (The template already has "pages/shared/chat.html" etc., so usually not needed)
      // 3. Set the final relative path
      a.setAttribute("href", base + clean);
      if (window.AGRIPRICE_DEBUG) {
        console.log(`[NAV_FIX] [${a.dataset.page}] ${href} -> ${base + clean}`);
      }
    });
  }

  function applyRoleBasedNav() {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;

    let role = "farmer";
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
      const u = raw ? JSON.parse(raw) : null;
      if (u && u.role) role = String(u.role);
    } catch (_) { }

    const base = getRelativePrefixToRoot();

    const bookingA = nav.querySelector('.bottom-nav-item[data-page="booking"]');
    if (bookingA) {
      const target = role === "buyer"
        ? "pages/buyer/setbooking/booking.html"
        : "pages/farmer/booking/booking.html";
      bookingA.setAttribute("href", base + target);

      const iconEl = bookingA.querySelector('.material-icons-outlined');
      const labelEl = bookingA.querySelector('.nav-label');
      if (role === "buyer") {
        if (iconEl) iconEl.textContent = "qr_code_scanner";
        if (labelEl) {
          labelEl.textContent = window.i18nT ? window.i18nT('scan_qr_queue', 'สแกนคิว') : 'สแกนคิว';
          labelEl.setAttribute('data-i18n', 'scan_qr_queue');
        }
      } else {
        if (iconEl) iconEl.textContent = "local_mall";
        if (labelEl) {
          labelEl.textContent = window.i18nT ? window.i18nT('nav_booking_history', 'ประวัติการจอง') : 'ประวัติการจอง';
          labelEl.setAttribute('data-i18n', 'nav_booking_history');
        }
      }
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
        const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
        const user = raw ? JSON.parse(raw) : null;
        return String(user?.role || "").toLowerCase();
      } catch (_) {
        return "";
      }
    }

    function isBuyerRole() {
      return getCurrentRole() === "buyer";
    }

    function getGradePrice(card, grade) {
      const bound = card.querySelector(`[data-bind="price${grade}"]`)?.textContent?.trim();
      if (bound) return bound;

      const boxes = card.querySelectorAll(".price-box, .pc-grade-box, .grade-item-box");
      for (const box of boxes) {
        const label =
          box.querySelector(".grade, .pc-grade-letter, .grade-item-letter")?.textContent?.trim() ||
          "";
        if (label.toUpperCase() !== grade) continue;

        return (
          box.querySelector(".price, .pc-grade-price, .grade-item-price")?.textContent?.trim() ||
          ""
        );
      }

      return "";
    }

    document.addEventListener("click", async function (e) {
      // Allowed areas for global delegation
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
        const offerId =
          card?.dataset?.offerId ||
          card?.getAttribute("data-offer-id") ||
          card?.dataset?.productId ||
          card?.getAttribute("data-product-id") ||
          "";
        const productId = card?.dataset?.productId || card?.getAttribute("data-product-id") || offerId;
        const sellerId = card?.dataset?.sellerId || card?.getAttribute("data-seller-id") || "";
        const favoriteKind = offerId ? "product" : "seller";
        if (window.AGRIPRICE_DEBUG) {
          // removed click log
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!card) return;

        const id =
          (favoriteKind === "product" ? (offerId || productId || card.dataset.sellerId || card.getAttribute("data-seller-id") || "") : (sellerId || card.getAttribute("data-seller-id") || "")) ||
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

        const priceA = getGradePrice(card, "A");
        const priceB = getGradePrice(card, "B");
        const priceC = getGradePrice(card, "C");
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
          offerId,
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
          const syncFavorite = active
            ? window.FavoritesHelpers?.addSellerFavorite
            : window.FavoritesHelpers?.removeSellerFavorite;
          if (syncFavorite) syncFavorite(id).catch(() => { });
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
          const sid = bookCard.dataset.sellerId || bookCard.getAttribute("data-seller-id") || "";
          const sname = bookCard.dataset.sellerName || bookCard.getAttribute("data-seller-name") ||
            bookCard.querySelector('[data-bind="sellerName"]')?.textContent?.trim() || "";
          const spid =
            bookCard.dataset.offerId ||
            bookCard.getAttribute("data-offer-id") ||
            bookCard.dataset.productId ||
            bookCard.getAttribute("data-product-id") ||
            "";
          if (sid) localStorage.setItem("bookingFarmerId", sid);
          if (sname) localStorage.setItem("bookingFarmerName", sname);
          if (spid) {
            localStorage.setItem("bookingOfferId", spid);
            localStorage.setItem("bookingProductId", spid);
          }
        }

        const pagesPrefix = getRelativePrefixToPages();

        let role = "farmer";
        try {
          const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
          const u = raw ? JSON.parse(raw) : null;
          if (u && u.role) role = String(u.role);
        } catch (_) { }

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
        // ไปแชททันที (สร้าง/หา room ผ่าน API)
        const card = contact.closest(".product-card");
        const targetId = card?.dataset?.sellerId || card?.getAttribute("data-seller-id") || "";
        if (!targetId) {
          const msg = window.i18nT ? window.i18nT('profile_not_found', 'ไม่พบข้อมูลโปรไฟล์') : 'ไม่พบข้อมูลโปรไฟล์';
          if (window.appNotify) window.appNotify(msg, 'error');
          else console.warn(msg);
          return;
        }

        // ต้องล็อกอินก่อนถึงจะแชทได้
        if (window.AuthGuard && typeof window.AuthGuard.requireLogin === 'function') {
          const ok = window.AuthGuard.requireLogin();
          if (!ok) return;
        }

        (async () => {
          try {
            if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
            const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
            if (!currentBase || !token) throw new Error('auth');

            const res = await fetch(currentBase + '/api/chats/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ target_user_id: targetId }),
            });
            const json = await res.json().catch(() => ({}));
            const roomId = json?.data?.room_id;
            if (!res.ok || !roomId) throw new Error(json?.message || 'start_chat_failed');

            const pagesPrefix = getRelativePrefixToPages();
            const chatUrl = pagesPrefix + `shared/chat.html?chatId=${encodeURIComponent(roomId)}&targetId=${encodeURIComponent(targetId)}`;
            if (window.navigateWithTransition) window.navigateWithTransition(chatUrl);
            else window.location.href = chatUrl;
          } catch (err) {
            const msg = (window.i18nT ? window.i18nT('start_chat_error', 'ไม่สามารถเริ่มการสนทนาได้') : 'ไม่สามารถเริ่มการสนทนาได้');
            if (window.appNotify) window.appNotify(msg, 'error');
            else console.error(msg, err);
          }
        })();

        return;
      }
    });

    window.syncFavoritesUI = function syncFavoritesUI(skipId) {
      if (isBuyerRole()) {
        document.querySelectorAll('[data-action="toggle-favorite"], .favorite-btn').forEach((btn) => btn.remove());
        return;
      }

      document.querySelectorAll(".product-card").forEach((card) => {
        const offerId = card.dataset.offerId || card.getAttribute("data-offer-id") || card.dataset.productId || card.getAttribute("data-product-id") || "";
        const productId = card.dataset.productId || card.getAttribute("data-product-id") || offerId;
        const sellerId = card.dataset.sellerId || card.getAttribute("data-seller-id") || "";
        const kind = offerId ? "product" : "seller";
        const id = kind === "product" ? offerId : sellerId;
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
  window.goBackOrFallback = window.goBackOrFallback || function goBackOrFallback(fallbackUrl) {
    const baseRoot = typeof getRelativePrefixToRoot === 'function' ? getRelativePrefixToRoot() : '../../';
    const cap = window.Capacitor;
    const platform = typeof cap?.getPlatform === 'function' ? cap.getPlatform() : '';
    const isNative = ['android', 'ios'].includes(platform)
      || ['capacitor:', 'ionic:'].includes(window.location.protocol)
      || cap?.isNative === true;
    const fallback = fallbackUrl || (baseRoot + (isNative ? 'home.html' : 'index.html'));
    const sameOriginReferrer = document.referrer && document.referrer.startsWith(window.location.origin);
    const navigationEntries = typeof window.navigation?.entries === 'function'
      ? window.navigation.entries().length
      : 0;
    const canGoBack = window.history.length > 1 || navigationEntries > 1 || sameOriginReferrer;

    if (canGoBack) {
      window.history.back();
      return true;
    }
    window.navigateWithTransition?.(fallback) || window.location.assign(fallback);
    return false;
  };

  window.initSmartBackButtons = function initSmartBackButtons() {
    const backButtons = document.querySelectorAll('[data-back]');

    backButtons.forEach(btn => {
      if (btn.dataset.smartBackReady === 'true') return;
      btn.dataset.smartBackReady = 'true';
      btn.removeAttribute('onclick');
      btn.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        const dataBack = btn.getAttribute('data-back');
        const fallbackUrl = btn.dataset.fallback || (dataBack && dataBack !== '' ? dataBack : '');
        window.goBackOrFallback(fallbackUrl);
      });
    });
  };

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
        else {
           window.goBackOrFallback();
        }
      });
    }
  }

  /* ---------------------------
     Auto inject components
  ---------------------------- */
  window.autoLoadBottomNav = async function autoLoadBottomNav() {
    if (IS_EMBEDDED_FRAME) return;

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
  };

  window.autoLoadFavorites = async function autoLoadFavorites() {
    const mount = document.getElementById("favoritesPlaceholder");
    if (!mount) return;

    let role = "";
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
      const user = raw ? JSON.parse(raw) : null;
      role = String(user?.role || "").toLowerCase();
    } catch (_) { }
    if (role === "buyer") {
      mount.remove();
      return;
    }

    const url = getRelativePrefixToRoot() + "components/favorites/favorites.html";
    await loadComponent("#favoritesPlaceholder", url, () => {
      if (window.i18nInit) window.i18nInit();
      if (window.initFavoritesComponent) window.initFavoritesComponent();
    });
  };

  /* ---------------------------
     Init
  ---------------------------- */
  (function initComponents() {
    initNativePageTransitions();

    autoLoadBottomNav();
    window.autoLoadFavorites();

    initProductCardsDelegation();

    // Sync favorites from API on startup.
    (function syncFavoritesFromApi() {
      let role = "";
      try {
        const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
        const user = raw ? JSON.parse(raw) : null;
        role = String(user?.role || "").toLowerCase();
      } catch (_) { }
      if (!role || role === "buyer") return;

      const sync = async () => {
        if (!window.FavoritesHelpers?.fetchFavoritesFromApi) return;
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        if (!token) return;
        try {
          const arr = await window.FavoritesHelpers.fetchFavoritesFromApi();
          if (!Array.isArray(arr)) return;
          const store = window.FavoritesStore;
          if (!store) return;
          const apiIds = new Set(arr.map(item => String(item.sellerId || item.profileId || item.id || '')).filter(Boolean));
          const local = store.read().filter(item => {
            const kind = String(item?.kind || 'seller');
            if (kind !== 'seller') return true;
            return apiIds.has(String(item?.id || ''));
          });
          arr.forEach(item => {
            const id = String(item.sellerId || item.profileId || item.id || '');
            if (id && !local.find(x => String(x.id) === id && String(x.kind || 'seller') === 'seller')) {
              local.push({ id, kind: 'seller', name: item.title || 'ไม่ทราบชื่อ', sub: item.subtitle || '', avatar: item.avatar || '' });
            }
          });
          store.write(local);
          window.syncFavoritesUI?.();
        } catch (_) { }
      };
      sync();
    })();

    // Global unread chat badge.
    let updateChatBadgeInFlight = false;
    async function updateChatBadgeGlobal() {
      if (updateChatBadgeInFlight || document.hidden) return;
      updateChatBadgeInFlight = true;
      if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
      const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
      const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
      const token = localStorage.getItem(TOKEN_KEY) || '';
      const clearBadge = () => {
        document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge').forEach(el => {
          el.textContent = '';
          el.style.display = 'none';
        });
      };

      if (!currentBase || !token) {
        clearBadge();
        updateChatBadgeInFlight = false;
        return;
      }
      fetch(currentBase + '/api/chats/unread', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(r => r.ok ? r.json() : null).then(json => {
        if (!json || !json.data) {
          clearBadge();
          return;
        }
        const count = json.data.unread_count || 0;
        document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge').forEach(el => {
          el.textContent = count > 99 ? '99+' : (count || '');
          el.style.display = count > 0 ? 'flex' : 'none';
        });
      }).catch(() => {
        clearBadge();
      }).finally(() => {
        updateChatBadgeInFlight = false;
      });
    }
    if (!IS_EMBEDDED_FRAME) {
      setTimeout(updateChatBadgeGlobal, 5000);
      setInterval(updateChatBadgeGlobal, 30000);
    }

    fixBottomNavPaths();
    applyRoleBasedNav();
    setActiveNavFromBody();
    if (typeof window.initSmartBackButtons === 'function') window.initSmartBackButtons();
  })();

} // End of components ready guard
