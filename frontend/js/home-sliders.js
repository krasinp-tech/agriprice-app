/**
 * home-sliders.js
 * ไฟล์ควบคุมหน้าแรก (Home Page) ของแอป
 * จัดการส่วนของรูปแบนเนอร์เลื่อน (Hero Slider), แถบเลือกหมวดหมู่สินค้า,
 * และการดึงรายการสินค้ามาแสดงผล พร้อมระบบค้นหาเบื้องต้น
 */
(function initAgriPriceHome() {
  const DEBUG_HOME = !!window.AGRIPRICE_DEBUG;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // Consolidate API Base and Token logic
  const getApiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  const getAuthHeaders = () => {
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
    return token ? { Authorization: 'Bearer ' + token } : {};
  };

  let ALL_PRODUCTS = [];
  let FILTERED_SELLER_ID = null;

  // ── Simple session cache (TTL = 5 min) ────────────────────────
  const PRODUCTS_CACHE_KEY = '__agri_products_cache';
  const PRODUCTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCachedProducts() {
    try {
      const raw = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > PRODUCTS_CACHE_TTL) { sessionStorage.removeItem(PRODUCTS_CACHE_KEY); return null; }
      return data;
    } catch { return null; }
  }

  function setCachedProducts(data) {
    try { sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { }
  }

  const categoryImageMap = {
    'ทุเรียน': 'durian.png',
    'ลองกอง': 'longkong.png',
    'มังคุด': 'mangosteen.png',
    'เงาะ': 'rambutan.png',
    'ปาล์ม': 'palm.png',
    'ยางพารา': 'rubber.png',
    'ผักสด': 'fresh-vegetables.png',
    'เมล็ดพันธุ์': 'seedlings.png',
    'ไม้ประดับ': 'ornamental-plants.png',
    'สมุนไพร': 'herbs.png',
    'ลำไย': 'default.png',
  };

  // --- 1. Hero Slider ---
  function initHeroSlider() {
    const carousel = document.getElementById("heroCarousel");
    const indicator = document.getElementById("heroIndicator");
    if (!carousel || !indicator) return;

    const slides = Array.from(carousel.querySelectorAll(".hero-slide"));
    if (!slides.length) return;

    indicator.innerHTML = "";
    slides.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => goTo(i, true));
      indicator.appendChild(dot);
    });
    const dots = Array.from(indicator.querySelectorAll(".dot"));

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const slideWidth = () => carousel.getBoundingClientRect().width || 1;
    const getIndex = () => clamp(Math.round(carousel.scrollLeft / slideWidth()), 0, slides.length - 1);

    function syncDots() {
      const idx = getIndex();
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    }

    function goTo(index, smooth) {
      const idx = clamp(index, 0, slides.length - 1);
      carousel.scrollTo({
        left: idx * slideWidth(),
        behavior: smooth ? "smooth" : "auto"
      });
    }

    let isDown = false, startX = 0, startLeft = 0, autoTimer = null;

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(() => {
        const idx = getIndex();
        goTo((idx + 1) % slides.length, true);
      }, 5000);
    }
    function stopAuto() { if (autoTimer) clearInterval(autoTimer); autoTimer = null; }

    startAuto();

    carousel.addEventListener("pointerdown", (e) => {
      carousel.setPointerCapture?.(e.pointerId);
      isDown = true; startX = e.clientX; startLeft = carousel.scrollLeft;
      carousel.classList.add("dragging");
      stopAuto();
    });

    carousel.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      carousel.scrollLeft = startLeft - (e.clientX - startX);
    });

    const endDrag = () => {
      if (!isDown) return;
      isDown = false; carousel.classList.remove("dragging");
      goTo(getIndex(), true);
      startAuto();
    };

    carousel.addEventListener("pointerup", endDrag);
    carousel.addEventListener("pointercancel", endDrag);
    carousel.addEventListener("scroll", syncDots);
  }

  // --- 2. Category Tabs ---
  async function initCategoryTabs() {
    const track = document.getElementById("productTabsCarousel");
    const dotsWrap = document.getElementById("productDots");
    if (!track || !dotsWrap) return;

    async function loadCategories() {
      try {
        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const res = await fetch(getApiBase() + '/api/product-types');
        if (!res.ok) throw new Error('Load product-types failed');
        const json = await res.json();
        return json.data || [];
      } catch (err) {
        if (DEBUG_HOME) console.error('[ProductTabs] Load error:', err);
        return [];
      }
    }

    function renderCategories(categories) {
      const PREFERRED_ORDER = ['ทุเรียน', 'ลองกอง', 'มังคุด', 'เงาะ', 'ปาล์ม', 'ยางพารา', 'ผักสด', 'เมล็ดพันธุ์', 'ไม้ประดับ', 'สมุนไพร', 'ลำไย'];
      const catMap = {};
      categories.forEach(cat => catMap[cat.name] = cat);
      const fullCats = PREFERRED_ORDER.map(name => catMap[name] || { id: name, name });

      track.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'product-grid';
      fullCats.forEach((cat, i) => {
        const item = document.createElement('a');
        item.className = 'product-item' + (i === 0 ? ' active' : '');
        item.href = `pages/shared/search-results.html?q=${encodeURIComponent(cat.name)}`;

        // Use navigateWithTransition for smooth feel
        item.onclick = (e) => {
          e.preventDefault();
          if (window.navigateWithTransition) window.navigateWithTransition(item.getAttribute('href'));
          else window.location.href = item.getAttribute('href');
        };

        const imgName = categoryImageMap[cat.name] || 'default.png';
        item.innerHTML = `
          <div class="cat-icon">
            <img src="${window.AgriPriceRouter?.resolveAsset('assets/images/' + imgName) || ('assets/images/' + imgName)}" 
                 alt="${t(cat.name, cat.name)}" onerror="this.src='${window.AgriPriceRouter?.resolveAsset('assets/images/default.png') || 'assets/images/default.png'}'"
                 style="width: 32px; height: 32px; object-fit: contain;">
          </div>
          <span>${t(cat.name, cat.name)}</span>
        `;
        grid.appendChild(item);
      });
      track.appendChild(grid);
      return Array.from(grid.children);
    }

    const categories = await loadCategories();
    const items = renderCategories(categories);

    const pages = Math.max(1, Math.ceil(items.length / 10));
    dotsWrap.innerHTML = '';
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.onclick = () => {
        const target = items[i * 10];
        if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      };
      dotsWrap.appendChild(dot);
    }

    track.addEventListener('scroll', () => {
      const idx = Math.round(track.scrollLeft / track.offsetWidth);
      const dots = dotsWrap.querySelectorAll('.dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
  }

  // --- 3. Product Cards ---
  async function initProductCards() {
    const mount = document.getElementById("productCardsMount");
    if (!mount) return;

    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = getApiBase();
    const formatTime = (d) => window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(d) : d;

    // [NEW] Reusable location fetching
    async function fetchUserLocation() {
      try {
        const rawUser = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const role = (user?.role || "").toLowerCase();
        
        // 1. Try Profile (Buyer always uses this)
        if (role === 'buyer' && (user?.lat || user?.latitude)) {
          return { lat: parseFloat(user.lat || user.latitude), lng: parseFloat(user.lng || user.longitude) };
        }
        
        // 2. Try GPS (Farmer/Guest)
        if (window.LocationHelper?.getUserLocation) {
          const loc = await window.LocationHelper.getUserLocation();
          if (loc) return loc;
        }
        
        // 3. Fallback to profile for Farmers
        if (user && (user.lat || user.latitude)) {
          return { lat: parseFloat(user.lat || user.latitude), lng: parseFloat(user.lng || user.longitude) };
        }
      } catch (e) { console.warn("[Home] fetchUserLocation failed:", e); }
      return null;
    }

    window.refreshDistances = async () => {
      // Re-run product cards with fresh location (clears cache first)
      sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
      await initProductCards();
    };

    window.filterProductsBySeller = async (sellerId, sellerName) => {
      if (DEBUG_HOME) console.log("[Home] Filtering products by seller:", sellerId, sellerName);
      FILTERED_SELLER_ID = sellerId;
      
      // Update Title
      const titleEl = document.querySelector(".products-section .section-title");
      if (titleEl) {
        if (sellerId) {
          titleEl.innerHTML = `<span style="color:var(--primary)">${sellerName || t('recommend', 'รายการแนะนำ')}</span> <span style="font-weight:400; font-size: 14px; color:#666;">(${t('buying_posts', 'รายการรับซื้อ')})</span>`;
          // Add clear button if not exists
          let clearBtn = document.getElementById('clearSellerFilter');
          if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.id = 'clearSellerFilter';
            clearBtn.className = 'view-all';
            clearBtn.style.border = 'none';
            clearBtn.style.background = 'none';
            clearBtn.style.marginLeft = 'auto';
            clearBtn.innerHTML = `<span style="font-size:12px">${t('clear_filter', 'ล้างตัวกรอง')}</span>`;
            clearBtn.onclick = () => window.filterProductsBySeller(null);
            titleEl.parentNode.appendChild(clearBtn);
          }
          clearBtn.style.display = 'block';
        } else {
          titleEl.textContent = t('recommend', 'รายการแนะนำ');
          const clearBtn = document.getElementById('clearSellerFilter');
          if (clearBtn) clearBtn.style.display = 'none';
        }
      }

      const userLoc = await fetchUserLocation();
      renderProducts(ALL_PRODUCTS, userLoc, mount, tpl, isBuyer);
    };

    try {
      const rawUser = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
      const user = rawUser ? JSON.parse(rawUser) : null;
      const isBuyer = user?.role?.toLowerCase() === "buyer";

      const tplRes = await fetch("components/product-card/product-card.html?v=20260528").catch(() => null);
      if (!tplRes?.ok) return;
      const tplHtml = await tplRes.text();
      const holder = document.createElement("div");
      holder.innerHTML = tplHtml;
      const tpl = holder.querySelector("#productCardTpl");
      if (!tpl) return;

      // ── ใช้ cache ถ้ายังไม่หมดอายุ ──
      const cachedRows = getCachedProducts();
      if (cachedRows) {
        if (DEBUG_HOME) console.log('[ProductCards] Serving from cache, rows:', cachedRows.length);
        ALL_PRODUCTS = cachedRows; // Update global state
        // Render immediately from cache, fetch location quietly for sorting
        const locTask = fetchUserLocation();
        renderProducts(cachedRows, await locTask, mount, tpl, isBuyer);

        // Background-refresh silently after 1s (no skeleton shown)
        setTimeout(async () => {
          const apiRes = await fetch(currentBase + '/api/products?limit=50', { headers: getAuthHeaders() }).catch(() => null);
          if (apiRes?.ok) {
            const json = await apiRes.json();
            const rows = json.data || [];
            ALL_PRODUCTS = rows; // Update global state
            setCachedProducts(rows);
            const userLoc = await fetchUserLocation();
            renderProducts(rows, userLoc, mount, tpl, isBuyer);
          }
        }, 1000);
        return;
      }

      // ── No cache: fetch ทั้งคู่พร้อมกัน ──
      const locTask = fetchUserLocation();
      const apiRes = await fetch(currentBase + '/api/products?limit=50', { headers: getAuthHeaders() }).catch(() => null);
      const userLoc = await locTask;

      if (apiRes?.ok) {
        const json = await apiRes.json();
        const rows = json.data || [];
        ALL_PRODUCTS = rows; // Save to global
        if (userLoc) window._loc_found = true;
        setCachedProducts(rows); // บันทึก cache
        renderProducts(rows, userLoc, mount, tpl, isBuyer);
      }
    } catch (err) { if (DEBUG_HOME) console.error("[ProductCards] Error:", err); }
  }

  // ── Shared render helper (แยกออกมาให้ใช้ร่วมกับ cache path) ──
  function renderProducts(rows, userLoc, mount, tpl, isBuyer) {
    const formatTime = (d) => window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(d) : d;
    const rules = window.AgriPriceRules || {};
    const staleDaysLimit = Number.isFinite(rules.STALE_DAYS) ? rules.STALE_DAYS : 7;
    const isStaleProduct = typeof rules.isStaleProduct === 'function'
      ? (product) => rules.isStaleProduct(product)
      : (product) => {
          const lastUpdate = product?.updated_at || product?.created_at;
          if (!lastUpdate) return true;
          const last = new Date(lastUpdate);
          const diffDays = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays > staleDaysLimit;
        };

    let filteredRows = rows;
    if (FILTERED_SELLER_ID) {
      filteredRows = rows.filter(r => String(r.user_id) === String(FILTERED_SELLER_ID));
    }

    const products = filteredRows
      .filter(p => !isStaleProduct(p))
      .map(p => {
        const unit = p.unit || t('kg_unit', 'กก.');
        let prices = { A: null, B: null, C: null };
        const unitStr = `${t('unit_baht', 'บ.')}/${unit}`;
        
        let gradesArr = Array.isArray(p.grades) ? p.grades : (Array.isArray(p.product_grades) ? p.product_grades : []);
        if (gradesArr.length > 0) {
            gradesArr.forEach(g => {
                const gName = String(g.grade || 'คละ').toUpperCase();
                const pStr = `${Number(g.price || 0)} ${unitStr}`;
                if (gName === 'B') prices.B = pStr;
                else if (gName === 'C') prices.C = pStr;
                else prices.A = pStr;
            });
        } else {
            const priceStr = `${Number(p.price || 0)} ${unitStr}`;
            const gradeName = (p.grade || 'คละ').toUpperCase();
            if (gradeName === 'B') prices.B = priceStr;
            else if (gradeName === 'C') prices.C = priceStr;
            else prices.A = priceStr;
        }

        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const sLat = p.lat ?? profile?.lat ?? null;
        const sLng = p.lng ?? profile?.lng ?? null;
        const distKm = (userLoc && sLat != null && sLng != null && window.LocationHelper?.calculateDistance)
          ? window.LocationHelper.calculateDistance(userLoc.lat, userLoc.lng, sLat, sLng)
          : null;

        // Pass stale status to card for button disabling
        const isStale = isStaleProduct(p);

        return {
          sellerId: p.user_id,
          sellerName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ'),
          sellerSub: p.variety ? `${p.name} (${p.variety})` : p.name,
          avatar: profile?.avatar || 'assets/images/avatar-guest.svg',
          ...prices,
          updateTime: formatTime(p.created_at),
          distance: (distKm !== null) ? (window.LocationHelper.formatDistance?.(distKm) || '') : '',
          _distKm: distKm,
          productId: p.product_id,
          isStale
        };
      });

    if (userLoc) products.sort((a, b) => (a._distKm ?? 999) - (b._distKm ?? 999));

    mount.innerHTML = '';
    let currentIndex = 0;
    const PAGE_SIZE = 3;

    const renderNextBatch = () => {
      const batch = products.slice(currentIndex, currentIndex + PAGE_SIZE);
      batch.forEach(item => {
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.dataset.sellerId = item.sellerId;
        node.dataset.productId = item.productId;
        const avatar = node.querySelector('[data-bind="avatar"]');
        if (avatar) avatar.src = window.AgriPriceRouter?.resolveAsset(item.avatar) || item.avatar;
        node.querySelector('[data-bind="sellerName"]').textContent = item.sellerName;
        node.querySelector('[data-bind="sellerSub"]').textContent = item.sellerSub;
        ['A', 'B', 'C'].forEach(g => {
          const el = node.querySelector(`[data-bind="price${g}"]`);
          if (el) { if (item[g]) el.textContent = item[g]; else el.closest('.pc-grade-box, .price-box')?.remove(); }
        });
        const distEl = node.querySelector('[data-bind="distance"]');
        if (distEl) distEl.textContent = item.distance || (t('distance', 'ระยะทาง') + ' - ' + t('km', 'กม.'));
        node.querySelector('[data-bind="updateTime"]').textContent = item.updateTime;

        // Disable booking button if stale
        if (item.isStale) {
          const bookBtn = node.querySelector('[data-action="book"]');
          if (bookBtn) {
            bookBtn.disabled = true;
            bookBtn.classList.add('btn-disabled');
            bookBtn.title = t('stale_buyer_tooltip', `ไม่สามารถจองได้ (ไม่ได้อัปเดทเกิน ${staleDaysLimit} วัน)`);
            bookBtn.textContent = t('stale_buyer_label', 'จองไม่ได้');
          }
        }

        if (isBuyer) {
          node.querySelectorAll('[data-action="book"], [data-action="contact"], [data-action="toggle-favorite"]').forEach(el => el.remove());
        } else {
          const favId = item.productId || item.sellerId;
          if (window.FavoritesStore?.has(favId, item.productId ? 'product' : 'seller')) {
            node.querySelector('[data-action="toggle-favorite"]')?.classList.add('active');
          }
        }
        mount.appendChild(node);
      });
      currentIndex += PAGE_SIZE;
      updateButtonVisibility();
    };

    const updateButtonVisibility = () => {
      const btn = document.querySelector('.btn-load-more');
      if (btn) btn.style.display = currentIndex >= products.length ? 'none' : 'flex';
    };

    renderNextBatch();
    const loadMoreBtn = document.querySelector('.btn-load-more');
    if (loadMoreBtn) loadMoreBtn.onclick = () => renderNextBatch();
  }

  // --- 4. Banner Announcements ---
  async function initBanners() {
    const track = document.getElementById("bannerCarousel");
    if (!track) return;

    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    try {
      const res = await fetch(getApiBase() + '/api/announcements?limit=8');
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];
      if (!list.length) return;

      const helper = window.AgriPriceUI;
      track.innerHTML = list.map(item => `
        <a class="banner-item news-item" href="${(item.link || '#').replace(/^http:/, 'https:')}" rel="noopener noreferrer">
          <div class="news-top">
            <span class="news-chip">${helper ? helper.escapeHtml(t(item.source, item.source || 'news')) : t('news', 'News')}</span>
            <span class="material-icons-outlined news-link-icon">open_in_new</span>
          </div>
          <h4 class="news-title">${helper ? helper.escapeHtml(item.title) : item.title}</h4>
          <div class="news-meta">
            <span>${helper ? (window.i18nInit ? helper.formatThaiDate(item.published_at) : item.published_at) : item.published_at}</span>
            <span class="news-more">${t('read_more', 'Read More')}</span>
          </div>
        </a>
      `).join('');
    } catch (_) { }
  }

  // Click Delegations for Home-specific actions (like See More)
  // Note: Product card clicks (profile, book, favorite) are handled by global delegation in components.js

  // Search Logic
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  if (searchBtn && searchInput) {
    const goSearch = () => {
      const q = searchInput.value.trim();
      const url = q ? `pages/shared/search-results.html?q=${encodeURIComponent(q)}` : 'pages/shared/search-results.html';
      if (window.navigateWithTransition) window.navigateWithTransition(url); else window.location.href = url;
    };
    searchBtn.onclick = goSearch;
    searchInput.onkeypress = (e) => { if (e.key === 'Enter') goSearch(); };
  }

  // Global Refresh Helper
  window.__AGRIPRICE_REFRESH_HOME = async () => {
    await Promise.allSettled([initProductCards(), initBanners()]);
  };

  // --- Initialize All ---
  // --- 4. Initialization ---
  document.addEventListener('DOMContentLoaded', async () => {
    initHeroSlider();
    initCategoryTabs();
    initProductCards();
    initBanners();

    if (window.initPullToRefresh) {
      window.initPullToRefresh(async () => {
        await window.__AGRIPRICE_REFRESH_HOME();
      });
    }

    // Auto-retry location ONCE if GPS was unavailable — ใช้ refreshDistances แทน initProductCards เพื่อ clear cache
    setTimeout(async () => {
      if (!window._loc_found && typeof window.refreshDistances === 'function') {
        if (DEBUG_HOME) console.log("[Home] Auto-retrying with location...");
        await window.refreshDistances();
      }
    }, 5000);
  });
})();
