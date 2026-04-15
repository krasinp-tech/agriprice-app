/**
 * AGRIPRICE - Search Page JS (Component-based + ready for DB)
 * รองรับทั้งหน้า index (root), หน้าใน /pages/ และหน้าในโฟลเดอร์ย่อยของ /pages/
 */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const DEBUG_SEARCH = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // Elements
  const input = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const backBtn = document.getElementById("backBtn");
  const countEl = document.getElementById("resultCount");
  const mount = document.getElementById("searchResultsMount");

  if (!mount) {
    if (DEBUG_SEARCH) console.warn("searchResultsMount not found. Please add <div id='searchResultsMount'></div>");
    return;
  }

  /* ----------------------------
   * Path helpers
   * ---------------------------- */
  function getRelativePrefixToRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return ""; // already at root

    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;

    // Step out from pages and nested subfolders.
    return "../" + "../".repeat(depth);
  }

  function getRelativePrefixToPages() {
    // root -> "pages/"
    // pages/* -> ""
    // pages/<sub>/* -> "../"
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "pages/";

    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;

    return "../".repeat(depth);
  }

  const prefixRoot = getRelativePrefixToRoot();
  const prefixPages = getRelativePrefixToPages();

  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;

    const normalized = String(p)
      .replace(/^(\.\/)+/g, "")
      .replace(/^(\.\.\/)+/g, "");

    return prefixRoot + normalized;
  }

  /* ----------------------------
   * Role helper
   * ---------------------------- */
  function getRole() {
    // Read directly from localStorage.
    const r = (localStorage.getItem("role") || "").toLowerCase();
    // Default to guest when not logged in.
    return r || "guest";
  }

  /* ----------------------------
   * 1) Data layer
   * ---------------------------- */
  // Use root-friendly paths and load from API when available.
  const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
  let allItems = [];

  async function loadFromApi(q) {
    if (!API_BASE) return null;
    try {
      // Search products and sellers in parallel.
      const [prodRes, sellerRes] = await Promise.all([
        fetch(API_BASE + '/api/products?limit=50' + (q ? '&q=' + encodeURIComponent(q) : '')),
        q ? fetch(API_BASE + '/api/users/search?q=' + encodeURIComponent(q) + '&limit=20') : Promise.resolve(null),
      ]);

      if (!prodRes.ok) return null;
      const json = await prodRes.json();

      // If seller matches exist, include their products too.
      let extraProductsData = [];
      if (sellerRes && sellerRes.ok) {
        const sellerJson = await sellerRes.json();
        const sellerIds = (sellerJson.data || []).map(s => s.profile_id).filter(Boolean);
        // Fetch products of matched sellers.
        const extraFetches = sellerIds.slice(0, 5).map(sid =>
          fetch(API_BASE + '/api/products?user_id=' + sid + '&limit=10').then(r => r.ok ? r.json() : { data: [] })
        );
        const extraJsons = await Promise.all(extraFetches);
        extraProductsData = extraJsons.flatMap(j => j.data || []);
      }

      // Merge and deduplicate by product_id.
      const seen = new Set();
      const allRows = [...(json.data || []), ...extraProductsData].filter(p => {
        if (seen.has(p.product_id)) return false;
        seen.add(p.product_id);
        return true;
      });

      return allRows.map(p => {
        // Read prices from product_grades first.
        const gradesArr = Array.isArray(p.product_grades) ? p.product_grades : [];
        let priceA = null, priceB = null, priceC = null;
        if (gradesArr.length > 0) {
          gradesArr.forEach(g => {
            const gl = (g.grade || '').toUpperCase();
            if (gl === 'A') priceA = g.price;
            else if (gl === 'B') priceB = g.price;
            else if (gl === 'C') priceC = g.price;
          });
        } else {
          const gl = (p.grade || '').toUpperCase();
          if (gl === 'A') priceA = p.price;
          else if (gl === 'B') priceB = p.price;
          else if (gl === 'C') priceC = p.price;
          else priceA = p.price;
        }
        return {
          sellerId:          p.user_id,
          sellerName:        p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.trim() : 'ไม่ทราบชื่อ',
          sellerSub:         p.name || '',
          avatar:            p.profiles?.avatar || '',
          priceA,
          priceB,
          priceC,
          distanceKm:        null,
          updatedMinutesAgo: p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000) : 0,
          favorite:          false,
          _productId:        p.product_id,
          _grade:            p.grade,
          _unit:             p.unit || 'กก.',
          _category:         p.category || '',
        };
      });
    } catch (e) {
      if (DEBUG_SEARCH) console.warn('[search] API failed:', e.message);
      return null;
    }
  }

  /* ----------------------------
   * 2) Template loader
   * ---------------------------- */
  let tpl = null;

  async function loadTemplateOnce() {
    if (tpl) return tpl;

    const templateUrl = resolveToRootUrl("components/product-card/product-card.html");
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error("Load product-card.html failed: " + res.status);

    const holder = document.createElement("div");
    holder.style.display = "none";
    holder.innerHTML = await res.text();
    document.body.appendChild(holder);

    tpl = document.getElementById("productCardTpl");
    if (!tpl) {
      throw new Error("productCardTpl not found in product-card.html (check template id)");
    }

    return tpl;
  }

  /* ----------------------------
   * 3) Render
   * ---------------------------- */
  function fmtPrice(n) {
    if (typeof n !== "number") return "-";
    return `${n} ${t('baht_per_kg', 'บ./กก.')}`;
  }

  function fmtDistance(km) {
    if (typeof km !== "number") return `• ${t('distance', 'ระยะทาง')} - ${t('km', 'กม.')}`;
    return `• ${t('distance', 'ระยะทาง')} ${km} ${t('km', 'กม.')}`;
  }

  function fmtUpdate(minAgo) {
    if (typeof minAgo !== "number") return `${t('updated', 'อัปเดต')} -`;
    if (minAgo < 60) return `${t('updated', 'อัปเดต')} ${minAgo} ${t('minute', 'นาที')}`;
    const h = Math.floor(minAgo / 60);
    return `${t('updated', 'อัปเดต')} ${h} ${t('hour', 'ชั่วโมง')}`;
  }

  function render(list) {
    mount.innerHTML = "";

    const role = getRole();
    const isBuyer = role === "buyer";

    list.forEach((item) => {
      const node = tpl.content.firstElementChild.cloneNode(true);

      node.dataset.sellerId = item.sellerId || "";
      node.dataset.sellerName = item.sellerName || "";

      // avatar
      const img = node.querySelector('[data-bind="avatar"]');
      if (img) {
        img.src = resolveToRootUrl(item.avatar || "");
        img.alt = item.sellerName || "";
      }

      const setText = (key, val) => {
        const el = node.querySelector(`[data-bind="${key}"]`);
        if (el) el.textContent = val;
      };

      setText("sellerName", item.sellerName || "");
      setText("sellerSub", item.sellerSub || "");
      setText("priceA", fmtPrice(item.priceA));
      setText("priceB", fmtPrice(item.priceB));
      setText("priceC", fmtPrice(item.priceC));
      setText("distance", fmtDistance(item.distanceKm));
      setText("updateTime", fmtUpdate(item.updatedMinutesAgo));

      // favorite
      const fav = node.querySelector('[data-action="toggle-favorite"]');
      if (fav && !item._productId && item.favorite) fav.classList.add("active");

      // Buyer mode: hide favorite/book/contact actions.
      if (isBuyer) {
        node.querySelectorAll('[data-action="toggle-favorite"]').forEach((el) => el.remove());
        node.querySelectorAll('[data-action="book"]').forEach((el) => el.remove());
        node.querySelectorAll('[data-action="contact"]').forEach((el) => el.remove());

        // If the template has action-row, keep only profile/message actions.
        const actionRow = node.querySelector(".action-row");
        if (actionRow) {
          // Keep open-profile and drop book/contact/favorite.
          const keepProfile = actionRow.querySelector('[data-action="open-profile"]');
          actionRow.innerHTML = "";
          if (keepProfile) actionRow.appendChild(keepProfile);
          // Keep message action when present.
          const keepMsg = node.querySelector('[data-action="message"]');
          if (keepMsg && actionRow) actionRow.appendChild(keepMsg.cloneNode(true));
        }
      }

      mount.appendChild(node);
    });

    if (countEl) countEl.textContent = String(list.length);
  }

  /* ----------------------------
   * 4) Search + Sort pipeline
   * ---------------------------- */
  let activeFilter = "all";

  function applyQuery(list, q) {
    const query = (q || "").trim().toLowerCase();
    if (!query) return list;

    return list.filter((x) => {
      return (
        (x.sellerName || "").toLowerCase().includes(query) ||
        (x.sellerSub || "").toLowerCase().includes(query)
      );
    });
  }

  function bestPrice(item) {
    return typeof item.priceA === "number" ? item.priceA : 0;
  }

  function applySort(list, filter) {
    const arr = [...list];

    if (filter === "recent") {
      // "Nearest" sort by distance.
      arr.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    } else if (filter === "price-high") {
      arr.sort((a, b) => bestPrice(b) - bestPrice(a));
    } else if (filter === "price-low") {
      arr.sort((a, b) => bestPrice(a) - bestPrice(b));
    }

    return arr;
  }

  async function refresh() {
    if (refresh._busy) return;
    refresh._busy = true;
    const q = (input?.value || "").trim();
    try {
      const fromApi = await loadFromApi(q);
      allItems = fromApi || [];
      // If API returns data, query is already applied on backend.
      const list1 = fromApi ? allItems : applyQuery(allItems, q);
      const list2 = applySort(list1, activeFilter);
      render(list2);
    } finally {
      refresh._busy = false;
    }
  }

  function syncFavoriteButtonsNow() {
    if (!mount || !window.FavoritesStore) return;
    mount.querySelectorAll('.product-card').forEach((card) => {
      const productId = card.dataset.productId || card.dataset._productId || '';
      const sellerId = card.dataset.sellerId || '';
      const kind = productId ? 'product' : 'seller';
      const id = kind === 'product' ? productId : sellerId;
      const favBtn = card.querySelector('[data-action="toggle-favorite"], .favorite-btn');
      if (!favBtn || !id) return;
      favBtn.classList.toggle('active', !!window.FavoritesStore.has(id, kind));
    });
  }

  function setUrlQuery(val) {
    const v = (val || "").trim();
    history.replaceState({}, "", v ? `?q=${encodeURIComponent(v)}` : "?");
  }

  /* ----------------------------
   * 5) Events
   * ---------------------------- */
  backBtn?.addEventListener("click", () => history.back());

  searchBtn?.addEventListener("click", async () => {
    setUrlQuery(input?.value || "");
    await refresh();
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    setUrlQuery(input.value);
    refresh();
  });

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter || "all";
      refresh();
    });
  });

  mount.addEventListener("click", (e) => {
    if (DEBUG_SEARCH) console.log('[search] Click detected on:', e.target.tagName, e.target.className);
    const card = e.target.closest(".product-card");
    if (!card) {
      if (DEBUG_SEARCH) console.log('[search] No product-card found');
      return;
    }

    const role = getRole();
    const isBuyer = role === "buyer";

    if (DEBUG_SEARCH) console.log('[search] Event target:', e.target);
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) {
      if (DEBUG_SEARCH) console.log('[search] No [data-action] element found');
      return;
    }

    const action = actionEl.dataset.action;
    if (DEBUG_SEARCH) console.log('[search] Action:', action);

    // Buyer cannot use favorite/book/contact actions.
    if (isBuyer && (action === "toggle-favorite" || action === "book" || action === "contact")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // All roles can open profile.
    if (action === "open-profile") {
      const name = card.dataset.sellerName || "";
      const uid2 = card.dataset.sellerId || "";
      if (DEBUG_SEARCH) console.log('[search] Opening profile - uid2:', uid2, 'name:', name);
      const q2  = uid2 ? `uid=${encodeURIComponent(uid2)}` : `name=${encodeURIComponent(name)}`;
      if (DEBUG_SEARCH) console.log('[search] Navigating to:', prefixPages + `shared/profile.html?${q2}`);
      if (window.navigateWithTransition) window.navigateWithTransition(prefixPages + `shared/profile.html?${q2}`); else window.location.href = prefixPages + `shared/profile.html?${q2}`;
      return;
    }

    if (action === "toggle-favorite") {
      e.preventDefault();
      e.stopPropagation();

      const productId = card.dataset.productId || card.dataset._productId || "";
      const sellerId = card.dataset.sellerId || "";
      const kind = productId ? "product" : "seller";
      const favoriteId = kind === "product" ? productId : sellerId;
      if (!favoriteId || !window.FavoritesStore) return;

      console.log("[Agriprice favorite click][search]", {
        kind,
        productId,
        sellerId,
        cardName: card.dataset.sellerName || "",
      });

      const sellerName = card.dataset.sellerName || card.querySelector('[data-bind="sellerName"]')?.textContent?.trim() || "";
      const sellerSub = card.querySelector('[data-bind="sellerSub"]')?.textContent?.trim() || "";
      const priceA = card.querySelector('[data-bind="priceA"]')?.textContent?.trim() || "";
      const priceB = card.querySelector('[data-bind="priceB"]')?.textContent?.trim() || "";
      const priceC = card.querySelector('[data-bind="priceC"]')?.textContent?.trim() || "";
      const distance = card.querySelector('[data-bind="distance"]')?.textContent?.trim() || "";
      const updateTime = card.querySelector('[data-bind="updateTime"]')?.textContent?.trim() || "";
      const avatarSrc = card.querySelector('[data-bind="avatar"]')?.getAttribute("src") || "";
      const avatar = avatarSrc.replace(/^(\.\.\/)+/g, "");

      const { active } = window.FavoritesStore.toggle({
        id: favoriteId,
        kind,
        sellerId,
        productId,
        productName: sellerSub,
        priceA,
        priceB,
        priceC,
        distance,
        updateTime,
        name: sellerName,
        sub: sellerSub,
        avatar,
      });

      actionEl.classList.toggle("active", active);

      if (kind === 'seller') {
        const apiBase = (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        if (apiBase && token) {
          if (active) {
            fetch(apiBase + '/api/favorites', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ user_id: sellerId }),
            }).catch(() => {});
          } else {
            fetch(apiBase + '/api/favorites/' + encodeURIComponent(sellerId), {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + token },
            }).catch(() => {});
          }
        }
      }

      const item = allItems.find((x) => (kind === 'product' ? String(x._productId || x.productId || '') : String(x.sellerId || '')) === String(favoriteId));
      if (item) item.favorite = active;
      return;
    }

    if (action === "book") {
      e.preventDefault();
      e.stopPropagation();

      localStorage.setItem("bookingReferrer", window.location.href);
      const nextHref = role === "buyer"
        ? prefixPages + "buyer/setbooking/booking.html"
        : prefixPages + "farmer/booking/booking-step1.html";
      if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
      return;
    }

    if (action === "contact") {
      e.preventDefault();
      e.stopPropagation();
      if (DEBUG_SEARCH) console.log("contact sellerId:", card.dataset.sellerId);
      return;
    }
  });

  // Realtime sync across pages/tabs without manual refresh.
  window.addEventListener('favorites:changed', () => {
    syncFavoriteButtonsNow();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === (window.FavoritesStore?.KEY || 'agriprice_favorites_v1')) {
      syncFavoriteButtonsNow();
    }
  });

  window.addEventListener('focus', () => {
    syncFavoriteButtonsNow();
    refresh().catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncFavoriteButtonsNow();
      refresh().catch(() => {});
    }
  });

  /* ----------------------------
   * 6) Init
   * ---------------------------- */
  (async () => {
    await loadTemplateOnce();

    const q = params.get("q") || "";
    if (input) input.value = q;

    // Hide the promoted section for buyers if it exists on this page
    if (getRole() === "buyer") {
      document.querySelector(".favorites-section")?.remove();
    }

    refresh();
  })().catch((err) => {
    console.error(err);
    mount.innerHTML = `<div style="padding:12px;border-radius:12px;background:#fff;">
      <b>${t('search_load_error', 'เกิดข้อผิดพลาดในการโหลดการค้นหา')}</b>
      <div style="margin-top:6px;">${String(err?.message || err)}</div>
    </div>`;
  });
});
