(function () {
  const params = new URLSearchParams(window.location.search);
  const DEBUG_SEARCH = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // Elements
  const input = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const countEl = document.getElementById("resultCount");
  const mount = document.getElementById("searchResultsMount");
  const backBtn = document.getElementById("backBtn");

  // Filter Drawer Elements
  const filterDrawer = document.getElementById("filterDrawer");
  const openDrawerBtn = document.getElementById("openDrawerBtn");
  const closeDrawerBtn = document.getElementById("closeDrawerBtn");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const applyFiltersBtn = document.getElementById("applyFiltersBtn");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");

  const monthGrid = document.getElementById("monthGrid");

  if (!mount) return;

  /* --- Drawer Logic --- */
  function toggleDrawer(show) {
    if (filterDrawer) filterDrawer.classList.toggle('show', show);
  }

  if (openDrawerBtn) openDrawerBtn.onclick = () => toggleDrawer(true);
  if (closeDrawerBtn) closeDrawerBtn.onclick = () => toggleDrawer(false);
  if (drawerOverlay) drawerOverlay.onclick = () => toggleDrawer(false);

  /* --- Path Helpers --- */
  const prefixRoot = "../../"; // Simplified for shared folder context
  const prefixPages = "../";

  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    return prefixRoot + String(p).replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
  }

  function getRole() {
    return (localStorage.getItem("role") || "guest").toLowerCase();
  }

  /* --- Data Logic --- */
  const getApiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  let allItems = [];
  let activeSort = "all";
  let activeFilters = { variety: '', months: [] };
  let userLat = null;
  let userLng = null;

  // Initial location fetch
  (async () => {
    const loc = await window.LocationHelper.getUserLocation();
    if (loc) {
      userLat = loc.lat;
      userLng = loc.lng;
      if (DEBUG_SEARCH) console.log("[Search] User location set:", { userLat, userLng });
    }
  })();

  async function loadFromApi(q) {
    try {
      if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
      const currentBase = getApiBase();
      const params = new URLSearchParams({ limit: 50 });
      if (q) params.set('q', q);

      if (mount) {
        mount.innerHTML = Array(4).fill(0).map(() => `
          <div class="skeleton-card">
            <div class="skeleton-avatar skeleton"></div>
            <div class="skeleton-card-content">
              <div class="skeleton-title skeleton"></div>
              <div class="skeleton-text skeleton"></div>
              <div class="skeleton-text skeleton" style="width: 50%;"></div>
            </div>
          </div>
        `).join('');
      }

      if (!window.api) throw new Error("API client not ready");
      const json = await window.api.call('GET', '/api/search?' + params.toString());

      const products = json.data?.products || [];
      const users = json.data?.users || [];

      // Merge and map
      const mappedProducts = products.map(p => {
        const unit = p.unit || t('kg_unit', 'กก.');
        let rawPriceA = Number(p.price || 0);
        let prices = { 
          A: p.price ? `${Number(p.price)} ${t('unit_baht', 'บ.')}/${unit}` : null, 
          B: null, 
          C: null 
        };
        
        // Since we removed product_grades table, we use the single grade field
        const gName = (p.grade || 'คละ').toUpperCase();
        if (gName === 'B') { prices.B = prices.A; prices.A = null; }
        else if (gName === 'C') { prices.C = prices.A; prices.A = null; }
        else { prices.A = prices.A; } // Default to Grade A or "คละ" display as A


        // Distance calculation
        const sLat = p.profiles?.lat ?? p.lat ?? null;
        const sLng = p.profiles?.lng ?? p.lng ?? null;
        const distKm = (userLat !== null && sLat !== null && sLng !== null)
          ? window.LocationHelper.calculateDistance(userLat, userLng, sLat, sLng)
          : null;

        return {
          type: 'product',
          sellerId: p.user_id,
          sellerName: p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.trim() : t('booking_unknown_name', 'ไม่ทราบชื่อ'),
          sellerSub: p.variety ? `${p.name} (${p.variety})` : p.name,
          avatar: p.profiles?.avatar
            ? (p.profiles.avatar.startsWith('http') ? p.profiles.avatar : resolveToRootUrl(`assets/images/${p.profiles.avatar.split('/').pop()}`))
            : resolveToRootUrl('assets/images/avatar-guest.svg'),
          priceA: rawPriceA,
          priceDisplayA: prices.A,
          priceDisplayB: prices.B,
          priceDisplayC: prices.C,
          variety: p.variety || '',
          productName: p.name || '',
          createdAtMonth: p.created_at ? (new Date(p.created_at).getMonth() + 1).toString() : null,
          updateTime: window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(p.created_at) : p.created_at,
          updatedMinutesAgo: p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000) : 0,
          _productId: p.product_id,
          _distKm: distKm,
          distanceText: window.LocationHelper.formatDistance(distKm)
        };
      });

      return mappedProducts;
    } catch (e) {
      const msg = "Error in search: " + e.message + "\nLine: " + (e.lineNumber || "unknown");
      if (window.appNotify) window.appNotify(msg, "error");
      else console.error(msg);
      console.error("[Search] Failed to load from API", e);
      return null;
    }
  }

  let tpl = null;
  async function loadTemplateOnce() {
    if (tpl) return tpl;
    try {
      const res = await fetch(resolveToRootUrl("components/product-card/product-card.html"));
      const holder = document.createElement("div");
      holder.innerHTML = await res.text();
      tpl = holder.querySelector("#productCardTpl");
      return tpl;
    } catch (e) {
      if (DEBUG_SEARCH) console.error("[Search] Template load failed:", e);
      return null;
    }
  }

  function render(list) {
    mount.innerHTML = "";
    if (!list || list.length === 0) {
      mount.innerHTML = `<div style="text-align:center;padding:40px;color:#8e8e93;"><span class="material-icons-outlined" style="font-size:48px;opacity:0.2;">search_off</span><p>${t('booking_empty_title', 'ไม่พบรายการที่ตรงกับเงื่อนไข')}</p></div>`;
      if (countEl) countEl.textContent = "0";
      return;
    }

    try {
      list.forEach(item => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.dataset.sellerId = item.sellerId;
        node.dataset.sellerName = item.sellerName;
        if (item._productId) node.dataset.productId = item._productId;

        const img = node.querySelector('[data-bind="avatar"]');
        if (img) img.src = resolveToRootUrl(item.avatar);

        node.querySelector('[data-bind="sellerName"]').textContent = item.sellerName;
        node.querySelector('[data-bind="sellerSub"]').textContent = item.sellerSub;
        
        ['A','B','C'].forEach(g => {
          const el = node.querySelector(`[data-bind="price${g}"]`);
          const val = item[`priceDisplay${g}`];
          if (el) {
            if (val) el.textContent = val;
            else el.closest('.pc-grade-box, .price-box')?.remove();
          }
        });

        const distanceEl = node.querySelector('[data-bind="distance"]');
        if (distanceEl) distanceEl.textContent = item.distanceText || "";

        const timeEl = node.querySelector('[data-bind="updateTime"]');
        if (timeEl) timeEl.textContent = item.updateTime || "";

        // Remove actions if current user is buyer
        const rawUser = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
        const currentUser = rawUser ? JSON.parse(rawUser) : null;
        const isBuyer = currentUser?.role?.toLowerCase() === "buyer";
        
        if (isBuyer) {
          node.querySelectorAll('[data-action="book"], [data-action="contact"], [data-action="toggle-favorite"]').forEach(el => el.remove());
        }

        // Hide price row for user profiles
        if (item.type === 'user') {
          const priceRow = node.querySelector('.price-row');
          if (priceRow) priceRow.style.display = 'none';
        }

        mount.appendChild(node);
      });

      if (countEl) countEl.textContent = String(list.length);
      // Sync favorites UI globally
      if (window.syncFavoritesUI) window.syncFavoritesUI();
    } catch (e) {
      const msg = "Render Error: " + e.message;
      if (window.appNotify) window.appNotify(msg, "error");
      else console.error(msg);
      console.error("[Search] Render Error", e);
    }
  }

  function applyPipeline() {
    let list = [...allItems];



    // 2. Month Filter
    if (activeFilters.months && activeFilters.months.length > 0) {
      list = list.filter(x => activeFilters.months.includes(x.createdAtMonth));
    }

    // 3. Sorting
    if (activeSort === "recent") {
      list.sort((a, b) => a.updatedMinutesAgo - b.updatedMinutesAgo);
    } else if (activeSort === "nearest") {
      list.sort((a, b) => (a._distKm ?? 9999) - (b._distKm ?? 9999));
    } else if (activeSort === "price-low") {
      list.sort((a, b) => (a.priceA || 9999) - (b.priceA || 9999));
    } else if (activeSort === "price-high") {
      list.sort((a, b) => (b.priceA || 0) - (a.priceA || 0));
    }

    render(list);
  }

  async function refresh() {
    const q = input.value.trim();
    // Update URL without reloading to reflect current search
    const newUrl = new URL(window.location.href);
    if (q) newUrl.searchParams.set('q', q); else newUrl.searchParams.delete('q');
    history.replaceState({}, "", newUrl.toString());

    const data = await loadFromApi(q);
    allItems = data || [];
    applyPipeline();
  }

  /* --- Event Handlers --- */
  if (backBtn) backBtn.onclick = () => window.history.back();

  if (searchBtn) {
    searchBtn.onclick = () => refresh();
  }

  input?.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      refresh();
    }
  });

  // Sort Chips
  document.querySelectorAll(".filter-chip[data-sort]").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".filter-chip[data-sort]").forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeSort = chip.dataset.sort;
      applyPipeline();
    };
  });

  // Apply Advanced Filters
  if (applyFiltersBtn) {
    applyFiltersBtn.onclick = () => {
      activeFilters.variety = "";
      const selectedMonths = [];
      monthGrid.querySelectorAll('.filter-chip.active').forEach(c => selectedMonths.push(c.dataset.month));
      activeFilters.months = selectedMonths;

      toggleDrawer(false);
      applyPipeline();

      // Highlight the "Filters" chip if something is filtered
      const hasFilters = activeFilters.variety || activeFilters.months.length > 0;
      if (openDrawerBtn) openDrawerBtn.classList.toggle('active', hasFilters);
    };
  }

  // Reset Filters
  if (resetFiltersBtn) {
    resetFiltersBtn.onclick = () => {

      monthGrid.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      activeFilters = { variety: '', months: [] };
      if (openDrawerBtn) openDrawerBtn.classList.remove('active');
      toggleDrawer(false);
      applyPipeline();
    };
  }

  /* --- Init --- */
  (async () => {
    await loadTemplateOnce();
    const q = new URLSearchParams(window.location.search).get("q") || "";
    if (input) input.value = q;
    refresh();
  })();


})();