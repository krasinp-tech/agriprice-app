(function allFavoritesInit() {
  const LOG_PREFIX = "[allfavorites]";
  const helpers = window.FavoritesHelpers;
  const favoritesMount = document.getElementById("allFavoritesMount");
  const emptyStateEl = document.getElementById("allFavoritesEmpty");
  if (!helpers || !favoritesMount || !emptyStateEl) return;

  const fallbackAvatar = new URL("../../assets/images/avatar-guest.svg", window.location.href).href;
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
  const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";

  function normalizeAvatarUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;

    if (value.startsWith('/uploads/')) return API_BASE ? (API_BASE + value) : value;
    if (value.startsWith('uploads/')) return API_BASE ? (API_BASE + '/' + value) : value;

    if (value.startsWith('/assets/')) {
      return new URL('../../' + value.replace(/^\/+/, ''), window.location.href).href;
    }
    if (value.startsWith('assets/')) {
      return new URL('../../' + value, window.location.href).href;
    }

    if (value.startsWith('/frontend/frontend/assets/')) {
      return new URL(value, window.location.origin).href;
    }

    return value;
  }

  const role = String(helpers.getRole?.() || "").toLowerCase();
  if (role === "buyer") {
    window.location.replace("../../index.html");
    return;
  }

  async function loadProductCardTemplate() {
    const res = await fetch("../product-card/product-card.html");
    if (!res.ok) throw new Error("load product-card template failed");
    const html = await res.text();
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const tpl = holder.querySelector("#productCardTpl");
    if (!tpl) throw new Error("productCardTpl not found");
    return tpl;
  }

  function extractPricesFromProduct(product) {
    const unitValue = String(product?.unit || "").trim();
    const unit = (!unitValue || /[เธโ�]/.test(unitValue)) ? 'กก.' : unitValue;
    const toLabel = (price) => {
      const n = Number(price);
      if (!Number.isFinite(n) || n <= 0) return "";
      return `${n} บ./${unit}`;
    };

    const out = { priceA: "", priceB: "", priceC: "" };
    const grades = Array.isArray(product?.product_grades) ? product.product_grades : [];
    if (grades.length) {
      grades.forEach((g) => {
        const grade = String(g?.grade || "").toUpperCase();
        const label = toLabel(g?.price);
        if (grade === "A") out.priceA = label || out.priceA;
        if (grade === "B") out.priceB = label || out.priceB;
        if (grade === "C") out.priceC = label || out.priceC;
      });
      return out;
    }
    const g = String(product?.grade || "").toUpperCase();
    const label = toLabel(product?.price);
    if (g === "A") out.priceA = label;
    if (g === "B") out.priceB = label;
    if (g === "C") out.priceC = label;
    if (!g && label) out.priceA = label;
    return out;
  }

  function hasIncompleteProductFields(item) {
    if (String(item?.kind || "") !== "product") return false;
    const hasName = !!String(item?.sellerSub || "").trim();
    const hasAnyPrice = !!(String(item?.priceA || "").trim() || String(item?.priceB || "").trim() || String(item?.priceC || "").trim());
    return !hasName || !hasAnyPrice;
  }

  async function enrichProductItems(items) {
    if (!API_BASE || !Array.isArray(items) || !items.length) return items;

    const headers = token ? { Authorization: "Bearer " + token } : {};

    const enriched = await Promise.all(items.map(async (item) => {
      if (!hasIncompleteProductFields(item) || !item.productId) return item;

      try {
        const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(item.productId)}`, { headers });
        if (!res.ok) return item;
        const json = await res.json().catch(() => null);
        const p = (json && (json.data || json.product || json)) || null;
        if (!p) return item;

        const prices = extractPricesFromProduct(p);
        const variety = String(p?.variety || "").trim();
        const productName = String(p?.name || item.sellerSub || "").trim();
        const sub = productName ? (variety ? `${productName} - ${variety}` : productName) : item.sellerSub;

        const next = {
          ...item,
          sellerSub: sub || item.sellerSub,
          priceA: prices.priceA || item.priceA,
          priceB: prices.priceB || item.priceB,
          priceC: prices.priceC || item.priceC,
          updateTime: item.updateTime || (p?.updated_at ? new Date(p.updated_at).toLocaleString('th-TH') : ""),
        };

        console.log(`${LOG_PREFIX} enrich product`, {
          productId: item.productId,
          before: { sub: item.sellerSub, priceA: item.priceA, priceB: item.priceB, priceC: item.priceC },
          after: { sub: next.sellerSub, priceA: next.priceA, priceB: next.priceB, priceC: next.priceC },
        });

        return next;
      } catch (_) {
        return item;
      }
    }));

    return enriched;
  }

  function fillProductCard(card, item) {
    card.dataset.sellerId = item.sellerId || "";
    card.dataset.profileId = item.profileId || item.sellerId || "";
    card.dataset.productId = item.productId || "";
    card.dataset.sellerName = item.sellerName || "";
    card.dataset.source = item.source || "favorite";
    card.dataset.favoriteId = item.favoriteId || item.sellerId || "";
    card.dataset.favoriteKind = item.kind || "seller";

    const avatar = card.querySelector('[data-bind="avatar"]');
    if (avatar) {
      // Remove inline template handler that points to page-relative assets path.
      avatar.removeAttribute("onerror");
      const normalizedAvatar = normalizeAvatarUrl(item.avatar);
      console.log(`${LOG_PREFIX} avatar`, {
        raw: item.avatar || "",
        normalized: normalizedAvatar || "",
        fallbackAvatar,
        kind: item.kind || "seller",
        favoriteId: item.favoriteId || "",
      });
      avatar.src = normalizedAvatar || fallbackAvatar;
      avatar.alt = item.sellerName || "seller";
      avatar.onerror = function () {
        this.onerror = null;
        this.src = fallbackAvatar;
      };
    }

    const bind = (selector, value) => {
      const el = card.querySelector(selector);
      if (el) el.textContent = value || "";
    };

    bind('[data-bind="sellerName"]', item.sellerName);
    bind('[data-bind="sellerSub"]', item.sellerSub);

    ['A', 'B', 'C'].forEach((grade) => {
      const value = String(item[`price${grade}`] || "").trim();
      const priceEl = card.querySelector(`[data-bind="price${grade}"]`);
      const box = priceEl?.closest('.price-box');
      if (!priceEl || !box) return;
      if (value) {
        priceEl.textContent = value;
      } else {
        box.remove();
      }
    });

    bind('[data-bind="distance"]', item.distance);
    bind('[data-bind="updateTime"]', item.updateTime);

    const favBtn = card.querySelector('[data-action="toggle-favorite"]');
    if (favBtn) favBtn.classList.add("active");
  }

  function openProfile(card) {
    const uid = card.dataset.profileId || card.dataset.sellerId || "";
    const name = card.dataset.sellerName || "";
    const query = uid
      ? `uid=${encodeURIComponent(uid)}`
      : `name=${encodeURIComponent(name)}`;
    window.location.href = `../../pages/shared/profile.html?${query}`;
  }

  function goBooking(card) {
    const sellerId = String(card.dataset.sellerId || "");
    const sellerName = String(card.dataset.sellerName || "");
    const productId = String(card.dataset.productId || "");

    localStorage.setItem("bookingReferrer", window.location.href);
    if (sellerId) localStorage.setItem("bookingFarmerId", sellerId);
    if (sellerName) localStorage.setItem("bookingFarmerName", sellerName);
    if (productId) localStorage.setItem("bookingProductId", productId);

    const roleRaw = String(helpers.getRole?.() || "farmer").toLowerCase();
    const nextHref = roleRaw === "buyer"
      ? "../../pages/buyer/setbooking/booking.html"
      : "../../pages/farmer/booking/booking-step1.html";
    if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
  }

  async function goContact(card) {
    const sellerId = String(card.dataset.sellerId || "");
    if (!sellerId) return;

    if (!API_BASE || !token) {
      const fallbackHref = "../../pages/shared/chat.html";
      if (window.navigateWithTransition) window.navigateWithTransition(fallbackHref); else window.location.href = fallbackHref;
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/chats/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ other_id: sellerId }),
      });
      const json = await res.json().catch(() => ({}));
      const nextHref = json?.chatId
        ? `../../pages/shared/chat.html?chatId=${encodeURIComponent(json.chatId)}`
        : "../../pages/shared/chat.html";
      if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
    } catch (_) {
      const fallbackHref = "../../pages/shared/chat.html";
      if (window.navigateWithTransition) window.navigateWithTransition(fallbackHref); else window.location.href = fallbackHref;
    }
  }

  function updateEmptyState() {
    const hasCard = !!favoritesMount.querySelector(".product-card");
    emptyStateEl.hidden = hasCard;
  }

  async function removeFavoriteItem(card) {
    const sellerId = String(card.dataset.sellerId || "");
    const favoriteId = String(card.dataset.favoriteId || sellerId);
    const favoriteKind = String(card.dataset.favoriteKind || "seller");
    const source = String(card.dataset.source || "favorite");
    if (!favoriteId) return;

    console.log(`${LOG_PREFIX} remove`, {
      favoriteId,
      favoriteKind,
      sellerId,
      source,
    });

    window.FavoritesStore.remove(favoriteId, undefined, favoriteKind);

    const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    if (API_BASE && token && favoriteKind === "seller") {
      try {
        if (source === "follow") {
          await fetch(API_BASE + "/api/follow/" + encodeURIComponent(sellerId), {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          });
        } else {
          await fetch(API_BASE + "/api/favorites/" + encodeURIComponent(sellerId), {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          });
        }
      } catch (_) {}
    }

    card.remove();
    updateEmptyState();
  }

  async function renderFavorites(opts = {}) {
    const localOnly = !!opts.localOnly;
    const [followingFromApi, favoritesFromApi] = localOnly
      ? [[], []]
      : await Promise.all([
          helpers.fetchFollowingFromApi?.(),
          helpers.fetchFavoritesFromApi?.(),
        ]);
    const favoritesFromStore = helpers.loadFavoritesFromStore?.() || [];

    console.log(`${LOG_PREFIX} sources`, {
      followingFromApi: Array.isArray(followingFromApi) ? followingFromApi.length : 0,
      favoritesFromApi: Array.isArray(favoritesFromApi) ? favoritesFromApi.length : 0,
      favoritesFromStore: Array.isArray(favoritesFromStore) ? favoritesFromStore.length : 0,
      storeProductCount: (favoritesFromStore || []).filter(x => String(x?.kind || 'seller') === 'product').length,
    });

    const merged = [
      ...(Array.isArray(followingFromApi) ? followingFromApi : []),
      ...(Array.isArray(favoritesFromApi) ? favoritesFromApi : []),
      ...(Array.isArray(favoritesFromStore) ? favoritesFromStore : []),
    ];

    const seen = new Set();
    const items = merged
      .filter((item) => {
        const id = String(item?.id || "");
        const kind = String(item?.kind || "seller");
        const key = `${kind}:${id}`;
        if (!id || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        sellerId: item.profileId || item.id,
        profileId: item.profileId || item.id,
        productId: item.productId || (String(item.kind || "seller") === "product" ? item.id : ""),
        favoriteId: item.id,
        kind: item.kind || "seller",
        sellerName: item.sellerName || item.title,
        sellerSub: item.productName || item.subtitle,
        priceA: item.priceA || "",
        priceB: item.priceB || "",
        priceC: item.priceC || "",
        distance: item.distance || "",
        updateTime: item.updateTime || "",
        avatar: item.avatar,
        source: item.source || "favorite",
      }));

    console.log(`${LOG_PREFIX} render items`, items.map((x) => ({
      favoriteId: x.favoriteId,
      kind: x.kind,
      productId: x.productId,
      sellerId: x.sellerId,
      sellerSub: x.sellerSub,
      priceA: x.priceA,
      priceB: x.priceB,
      priceC: x.priceC,
      source: x.source,
    })));

    const finalItems = await enrichProductItems(items);

    if (!finalItems.length) {
      favoritesMount.innerHTML = "";
      emptyStateEl.hidden = false;
      emptyStateEl.querySelector("p").textContent = "ยังไม่มีรายการติดตามหรือรายการโปรด";
      return;
    }

    const tpl = await loadProductCardTemplate();
    favoritesMount.innerHTML = "";

    finalItems.forEach((item) => {
      const card = tpl.content.firstElementChild.cloneNode(true);
      fillProductCard(card, item);
      favoritesMount.appendChild(card);
    });

    updateEmptyState();
  }

  favoritesMount.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;

    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    if (action === "open-profile") {
      openProfile(card);
      return;
    }

    if (action === "book") {
      e.preventDefault();
      e.stopPropagation();
      goBooking(card);
      return;
    }

    if (action === "contact") {
      e.preventDefault();
      e.stopPropagation();
      goContact(card);
      return;
    }

    if (action === "toggle-favorite") {
      e.preventDefault();
      e.stopPropagation();
      removeFavoriteItem(card);
    }
  });

  favoritesMount.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const actionEl = e.target.closest("[data-action]");
    const card = e.target.closest(".product-card");
    if (!card || !actionEl) return;

    const action = actionEl.dataset.action;
    if (action === "open-profile") openProfile(card);
    if (action === "book") goBooking(card);
    if (action === "contact") goContact(card);
    if (action === "toggle-favorite") removeFavoriteItem(card);
  });

  window.addEventListener("favorites:changed", () => {
    // Instant local render first, then API sync render.
    renderFavorites({ localOnly: true }).catch(() => {});
    renderFavorites().catch(() => {});
  });

  window.addEventListener("storage", (e) => {
    if (e.key === (window.FavoritesStore?.KEY || "agriprice_favorites_v1")) {
      renderFavorites({ localOnly: true }).catch(() => {});
    }
  });

  window.addEventListener("focus", () => {
    renderFavorites({ localOnly: true }).catch(() => {});
    renderFavorites().catch(() => {});
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderFavorites({ localOnly: true }).catch(() => {});
      renderFavorites().catch(() => {});
    }
  });

  renderFavorites().catch((err) => {
    console.error("allfavorites render error:", err);
    emptyStateEl.hidden = false;
  });
})();
