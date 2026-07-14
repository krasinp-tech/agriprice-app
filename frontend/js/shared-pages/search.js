(function () {
  const params = new URLSearchParams(window.location.search);
  const DEBUG_SEARCH = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function firstRelation(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function profileName(profile) {
    return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';
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
    if (filterDrawer) filterDrawer.classList.toggle('active', show);
  }

  if (openDrawerBtn) openDrawerBtn.onclick = () => toggleDrawer(true);
  if (closeDrawerBtn) closeDrawerBtn.onclick = () => toggleDrawer(false);
  if (drawerOverlay) drawerOverlay.onclick = () => toggleDrawer(false);

  // Toggle active class for month chips
  if (monthGrid) {
    monthGrid.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (chip) chip.classList.toggle('active');
    });
  }

  /* --- Path Helpers --- */
  const prefixRoot = "../../";  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    return prefixRoot + String(p).replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
  }

  /* --- Data Logic --- */
  let allItems = [];
  let activeSort = "all";
  let activeFilters = { months: [] };
  let userLat = null;
  let userLng = null;

  function initUserLocation() {
    try {
      const rawUser = localStorage.getItem("user_data");
      if (rawUser) {
        const user = JSON.parse(rawUser);
        const lat = parseFloat(user.lat || user.latitude);
        const lng = parseFloat(user.lng || user.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          userLat = lat;
          userLng = lng;
          return;
        }
      }
    } catch (e) {}
    try {
      const role = localStorage.getItem("role") || "buyer";
      const rawProfile = localStorage.getItem(`myprofile_data_${role}`);
      if (rawProfile) {
        const profile = JSON.parse(rawProfile);
        const lat = parseFloat(profile.location?.lat || profile.lat || null);
        const lng = parseFloat(profile.location?.lng || profile.lng || null);
        if (!isNaN(lat) && !isNaN(lng)) {
          userLat = lat;
          userLng = lng;
          return;
        }
      }
    } catch (e) {}
    try {
      const rawLoc = localStorage.getItem("location");
      if (rawLoc) {
        const loc = JSON.parse(rawLoc);
        const lat = parseFloat(loc?.lat || loc?.latitude);
        const lng = parseFloat(loc?.lng || loc?.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          userLat = lat;
          userLng = lng;
          return;
        }
      }
    } catch (e) {}
  }

  initUserLocation();

  async function loadFromApi(q) {
    try {
      if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
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
      const json = await window.api.call('GET', '/api/search?q=' + encodeURIComponent(q));
      const products = json.data?.products || [];

      const parsePositivePrice = (value) => {
        if (value === undefined || value === null) return null;
        const raw = String(value).trim();
        if (!raw || raw === '-' || raw.toLowerCase() === 'null') return null;
        const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
        const price = Number(match ? match[0] : raw);
        return Number.isFinite(price) && price > 0 ? price : null;
      };

      const getGradeRows = (p) => {
        const source = Array.isArray(p.grades)
          ? p.grades
          : (Array.isArray(p.product_grades)
            ? p.product_grades
            : (Array.isArray(p.offer_grades) ? p.offer_grades : []));
        const rows = source
          .map(g => ({ grade: g.grade_name || g.grade || 'Mixed', price: parsePositivePrice(g.price) }))
          .filter(g => g.price !== null);
        if (rows.length) return rows;
        const fallbackPrice = parsePositivePrice(p.price);
        return fallbackPrice !== null ? [{ grade: p.grade || 'Mixed', price: fallbackPrice }] : [];
      };

      // Map API products to UI model
      const mapped = products.map(p => {
        const unit = p.unit || t('kg_unit', 'กก.');
        let prices = { priceA: null, priceB: null, priceC: null };
        const unitStr = `${t('unit_baht', 'บ.')}/${unit}`;
        let gradesArr = getGradeRows(p);
        let primaryPrice = parsePositivePrice(p.price) || 0;

        if (gradesArr.length > 0) {
            gradesArr.forEach(g => {
                const gName = String(g.grade || 'คละ').toUpperCase();
                const pStr = `${g.price} ${unitStr}`;
                if (gName === 'B') prices.priceB = pStr;
                else if (gName === 'C') prices.priceC = pStr;
                else {
                    prices.priceA = pStr;
                    primaryPrice = g.price;
                }
            });
            if (!prices.priceA) {
                const firstGrade = gradesArr[0];
                prices.priceA = `${firstGrade.price} ${unitStr}`;
                primaryPrice = firstGrade.price;
            }
        } else {
            const priceStr = '';
            const gradeName = (p.grade || 'คละ').toUpperCase();
            if (gradeName === 'B') prices.priceB = priceStr;
            else if (gradeName === 'C') prices.priceC = priceStr;
            else prices.priceA = priceStr;
        }

        // Distance calculation
        const profile = firstRelation(p.profiles);
        const sLat = profile?.lat ?? p.lat ?? null;
        const sLng = profile?.lng ?? p.lng ?? null;
        const distKm = (userLat !== null && sLat !== null && sLng !== null && window.LocationHelper?.calculateDistance)
          ? window.LocationHelper.calculateDistance(userLat, userLng, sLat, sLng)
          : null;

        const offerId = p.offer_id || p.offerId || p.product_id || p.productId || p.id;

        return {
          id: offerId,
          offerId,
          productId: offerId,
          type: 'product',
          sellerId: p.user_id,
          sellerName: p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.trim() : t('booking_unknown_name', 'ไม่ทราบชื่อ'),
          sellerSub: p.variety ? `${t(p.name, p.name)} (${t(p.variety, p.variety)})` : t(p.name, p.name),
          avatar: p.profiles?.avatar || resolveToRootUrl('assets/images/avatar-guest.svg'),
          priceA: prices.priceA,
          priceB: prices.priceB,
          priceC: prices.priceC,
          grades: gradesArr,
          priceSortValue: primaryPrice,
          createdAtMonth: p.created_at ? (new Date(p.created_at).getMonth() + 1).toString() : null,
          updateTime: window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(p.created_at) : p.created_at,
          updatedMinutesAgo: p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000) : 0,
          _offerId: offerId,
          _productId: offerId,
          _distKm: distKm,
          distanceText: window.LocationHelper?.formatDistance ? window.LocationHelper.formatDistance(distKm) : '',
          ...(() => ({
            sellerName: profile ? profileName(profile) : t('booking_unknown_name', 'Unknown'),
            avatar: profile?.avatar || resolveToRootUrl('assets/images/avatar-guest.svg'),
          }))()
        };
      });

      const users = json.data?.users || [];
      const mappedUsers = users.map(u => {
        const distKm = (userLat !== null && u.lat !== null && u.lng !== null && window.LocationHelper?.calculateDistance)
          ? window.LocationHelper.calculateDistance(userLat, userLng, u.lat, u.lng)
          : null;
        return {
          id: u.id,
          offerId: '',
          productId: '',
          type: 'seller',
          sellerId: u.id,
          sellerName: `${u.first_name || ''} ${u.last_name || ''}`.trim() || t('role_user', 'ผู้ใช้งาน'),
          sellerSub: u.role === 'buyer' ? t('role_buyer', 'ผู้รับซื้อ') : t('role_farmer', 'เกษตรกร'),
          avatar: u.avatar || resolveToRootUrl('assets/images/avatar-guest.svg'),
          priceA: null,
          priceB: null,
          priceC: null,
          priceSortValue: 0,
          createdAtMonth: null,
          updateTime: '',
          updatedMinutesAgo: 999999,
          _offerId: '',
          _productId: '',
          _distKm: distKm,
          distanceText: window.LocationHelper?.formatDistance ? window.LocationHelper.formatDistance(distKm) : ''
        };
      });

      return mapped;
    } catch (e) {
      console.error("[Search] Failed to load:", e);
      if (mount) mount.innerHTML = `<p style="text-align:center; padding:20px; color:red;">${t('error_loading', 'เกิดข้อผิดพลาดในการโหลดข้อมูล')}</p>`;
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

    list.forEach(item => {
      if (window.ProductCard && tpl) {
        const data = {
          ...item,
          title: item.sellerName,
          subtitle: item.sellerSub,
          avatar: item.avatar,
          updated: item.updateTime,
          distance: item.distanceText,
          priceA: item.priceA,
          priceB: item.priceB,
          priceC: item.priceC,
          grades: item.grades
        };

        const node = window.ProductCard.createCardEl(data, {}, tpl.innerHTML);
        // Favorite sync for search results
        const favId = item.id || item.sellerId;
        if (window.FavoritesStore?.has(favId, item.id ? 'product' : 'seller')) {
          node.querySelector('[data-action="toggle-favorite"]')?.classList.add('active');
        }

        mount.appendChild(node);
      }
    });

    if (countEl) countEl.textContent = String(list.length);
    if (window.syncFavoritesUI) window.syncFavoritesUI();
  }

  function applyPipeline() {
    let list = [...allItems];

    if (activeFilters.months.length > 0) {
      list = list.filter(x => activeFilters.months.includes(x.createdAtMonth));
    }

    if (activeSort === "recent") {
      list.sort((a, b) => a.updatedMinutesAgo - b.updatedMinutesAgo);
    } else if (activeSort === "nearest") {
      if (userLat === null && window.AgriPermission?.requestLocation) {
         window.AgriPermission.requestLocation().then(res => {
           if (res.granted && res.position) {
             userLat = res.position.coords.latitude;
             userLng = res.position.coords.longitude;
             refresh();           }
         });
      }
      list.sort((a, b) => (a._distKm ?? 9999) - (b._distKm ?? 9999));
    } else if (activeSort === "price-low") {
      list.sort((a, b) => (a.priceSortValue || 9999) - (b.priceSortValue || 9999));
    } else if (activeSort === "price-high") {
      list.sort((a, b) => (b.priceSortValue || 0) - (a.priceSortValue || 0));
    }

    render(list);
  }

  async function refresh() {
    const q = input.value.trim();
    const newUrl = new URL(window.location.href);
    if (q) newUrl.searchParams.set('q', q); else newUrl.searchParams.delete('q');
    history.replaceState({}, "", newUrl.toString());

    const data = await loadFromApi(q);
    allItems = data || [];
    applyPipeline();
  }

  /* --- Event Handlers --- */
  if (backBtn) backBtn.onclick = () => {
    window.location.href = prefixRoot + 'index.html';
  };
  if (searchBtn) searchBtn.onclick = () => refresh();
  input?.addEventListener("keydown", e => { if (e.key === "Enter") refresh(); });

  document.querySelectorAll(".filter-chip[data-sort]").forEach(chip => {
    chip.onclick = () => {
      document.querySelectorAll(".filter-chip[data-sort]").forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeSort = chip.dataset.sort;
      applyPipeline();
    };
  });

  if (applyFiltersBtn) {
    applyFiltersBtn.onclick = () => {
      const selectedMonths = [];
      monthGrid.querySelectorAll('.filter-chip.active').forEach(c => selectedMonths.push(c.dataset.month));
      activeFilters.months = selectedMonths;
      toggleDrawer(false);
      applyPipeline();
      if (openDrawerBtn) openDrawerBtn.classList.toggle('active', selectedMonths.length > 0);
    };
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.onclick = () => {
      monthGrid.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      activeFilters.months = [];
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

    // Background location fetch if not already loaded from cache
    if (userLat === null && window.LocationHelper?.getUserLocation) {
      window.LocationHelper.getUserLocation().then(loc => {
        if (loc) {
          userLat = loc.lat;
          userLng = loc.lng;
          refresh();
        }
      });
    }

    refresh();
  })();
})();
