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
  let ACTIVE_USER_LOCATION = null;
  let FARMER_GPS_PROMPTED = false;
  let BUYER_PROFILE_REQUEST = null;

  function setLoadMoreVisible(show) {
    const btn = document.querySelector('.btn-load-more');
    if (btn) btn.style.display = show ? 'flex' : 'none';
  }

  function renderProductState(mount, title, description, icon = 'inventory_2') {
    if (!mount) return;
    setLoadMoreVisible(false);
    mount.innerHTML = `
      <div class="empty-state home-product-empty">
        <span class="material-icons-outlined">${icon}</span>
        <h3>${title}</h3>
        <p>${description}</p>
      </div>
    `;
  }

  // Persistent read-through cache: render immediately on later app launches,
  // then refresh silently from the API. Transactional data is never cached here.
  const PRODUCTS_CACHE_KEY = '__agri_products_cache_v2';
  const CATEGORIES_CACHE_KEY = '__agri_categories_cache_v1';
  const ANNOUNCEMENTS_CACHE_KEY = '__agri_announcements_cache_v1';
  const PRODUCTS_CACHE_TTL = 15 * 60 * 1000;
  const CATEGORIES_CACHE_TTL = 24 * 60 * 60 * 1000;
  const ANNOUNCEMENTS_CACHE_TTL = 15 * 60 * 1000;

  function getProductsCacheKey() {
    let userId = 'guest';
    try {
      const user = JSON.parse(localStorage.getItem('user_data') || 'null');
      userId = window.resolveProfileId?.(user?.profile_id, user?.id, user?.userId) || 'guest';
    } catch (_) {}
    const role = String(localStorage.getItem('role') || 'guest').toLowerCase();
    return `${PRODUCTS_CACHE_KEY}:${role}:${userId}`;
  }

  function readHomeCache(key, ttl) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (!Array.isArray(data) || Date.now() - Number(ts || 0) > ttl) {
        localStorage.removeItem(key);
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  }

  function writeHomeCache(key, data) {
    if (!Array.isArray(data)) return;
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
  }

  function getCachedProducts() {
    return readHomeCache(getProductsCacheKey(), PRODUCTS_CACHE_TTL);
  }

  function setCachedProducts(data) {
    writeHomeCache(getProductsCacheKey(), data);
  }

  const categoryImageMap = {
    'ทุเรียน': 'durian.png',
    'ลองกอง': 'longkong.png',
    'ลางสาด': 'longkong.png',
    'ลำไย': 'longan.png',
    'ลิ้นจี่': 'longan.png',
    'มังคุด': 'mangosteen.png',
    'เงาะ': 'rambutan.png',
    'ปาล์มน้ำมัน': 'oil-bottle.png',
    'น้ำมัน': 'oil-bottle.png',
    'ปาล์ม': 'palm.png',
    'ยางพารา': 'rubber.png',
    'ผักสด': 'fresh-vegetables.png',
    'ผัก': 'fresh-vegetables.png',
    'คะน้า': 'fresh-vegetables.png',
    'กวางตุ้ง': 'fresh-vegetables.png',
    'กะหล่ำ': 'fresh-vegetables.png',
    'บรอกโคลี': 'fresh-vegetables.png',
    'แตงกวา': 'fresh-vegetables.png',
    'ถั่วฝักยาว': 'fresh-vegetables.png',
    'ฟัก': 'fresh-vegetables.png',
    'มะเขือเทศ': 'fresh-vegetables.png',
    'แตงโม': 'watermelon.png',
    'เมลอน': 'fresh-vegetables.png',
    'แก้วมังกร': 'dragon-fruit.png',
    'สละ': 'fresh-vegetables.png',
    'ระกำ': 'fresh-vegetables.png',
    'องุ่น': 'grape.png',
    'สตรอว์เบอร์รี': 'strawberry.png',
    'เมล็ดพันธุ์': 'seedlings.png',
    'งา': 'seedlings.png',
    'ทานตะวัน': 'seedlings.png',
    'ละหุ่ง': 'seedlings.png',
    'เห็ด': 'mushroom.png',
    'ไม้ประดับ': 'ornamental-plants.png',
    'สมุนไพร': 'herbs.png',
    'ขิง': 'herbs.png',
    'ข่า': 'herbs.png',
    'ขมิ้น': 'herbs.png',
    'ตะไคร้': 'herbs.png',
    'โหระพา': 'herbs.png',
    'กะเพรา': 'herbs.png',
    'มะกรูด': 'herbs.png',
    'เตย': 'herbs.png',
    'กระชาย': 'herbs.png',
    'มะรุม': 'herbs.png',
    'กล้วย': 'banana.png',
    'มะม่วง': 'mango.png',
    'มะละกอ': 'papaya.png',
    'มันสำปะหลัง': 'cassava.png',
    'อ้อย': 'sugarcane.png',
    'สับปะรด': 'pineapple.png',
    'ขนุน': 'mango.png',
    'มะขาม': 'mango.png',
    'ละมุด': 'mango.png',
    'พลับ': 'mango.png',
    'มะพร้าว': 'coconut.png',
    'ลูกตาล': 'coconut.png',
    'สาเก': 'coconut.png',
    'ส้ม': 'orange.png',
    'มะนาว': 'lime.png',
    'ข้าวโพด': 'corn.png',
    'พริก': 'chili.png',
    'ข้าว': 'rice.png',
  };

  // Map Thai names → i18n keys so labels change when language is switched
  const categoryI18nKeyMap = {
    'ทุเรียน': 'durian',
    'ลองกอง': 'longkong',
    'ลางสาด': 'longkong',
    'ลำไย': 'longan',
    'ลิ้นจี่': 'longan',
    'มังคุด': 'mangosteen',
    'เงาะ': 'rambutan',
    'ปาล์มน้ำมัน': 'oil_bottle',
    'น้ำมัน': 'oil_bottle',
    'ปาล์ม': 'palm',
    'ยางพารา': 'rubber',
    'ผักสด': 'vegetable',
    'ผัก': 'vegetable',
    'คะน้า': 'vegetable',
    'กวางตุ้ง': 'vegetable',
    'กะหล่ำ': 'vegetable',
    'บรอกโคลี': 'vegetable',
    'แตงกวา': 'vegetable',
    'ถั่วฝักยาว': 'vegetable',
    'ฟัก': 'vegetable',
    'มะเขือเทศ': 'vegetable',
    'แตงโม': 'watermelon',
    'เมลอน': 'melon',
    'แก้วมังกร': 'dragon_fruit',
    'สละ': 'salak',
    'ระกำ': 'salak',
    'องุ่น': 'grape',
    'สตรอว์เบอร์รี': 'strawberry',
    'เมล็ดพันธุ์': 'seedlings',
    'งา': 'seedlings',
    'ทานตะวัน': 'seedlings',
    'ละหุ่ง': 'seedlings',
    'เห็ด': 'mushroom',
    'ไม้ประดับ': 'ornamental_plants',
    'สมุนไพร': 'herbs',
    'ขิง': 'herbs',
    'ข่า': 'herbs',
    'ขมิ้น': 'herbs',
    'ตะไคร้': 'herbs',
    'โหระพา': 'herbs',
    'กะเพรา': 'herbs',
    'มะกรูด': 'herbs',
    'เตย': 'herbs',
    'กระชาย': 'herbs',
    'มะรุม': 'herbs',
    'กล้วย': 'banana',
    'มะม่วง': 'mango',
    'มะละกอ': 'papaya',
    'มันสำปะหลัง': 'cassava',
    'อ้อย': 'sugarcane',
    'สับปะรด': 'pineapple',
    'ขนุน': 'mango',
    'มะขาม': 'mango',
    'ละมุด': 'mango',
    'พลับ': 'mango',
    'มะพร้าว': 'coconut',
    'ลูกตาล': 'coconut',
    'สาเก': 'coconut',
    'ส้ม': 'orange',
    'มะนาว': 'lime',
    'ข้าวโพด': 'corn',
    'พริก': 'chili',
    'ข้าว': 'rice',
  };

  // --- 1. Hero Slider ---
  function initHeroSlider() {
    const carousel = document.getElementById("heroCarousel");
    const indicator = document.getElementById("heroIndicator");
    if (!carousel || !indicator) return;

    const slides = Array.from(carousel.querySelectorAll(".hero-slide"));
    if (!slides.length) return;
    const videos = slides.map((slide) => slide.querySelector("video"));

    videos.forEach((video) => {
      if (!video) return;
      video.muted = true;
      video.playsInline = true;
      video.addEventListener("error", () => video.classList.add("is-unavailable"));
    });

    indicator.innerHTML = "";
    slides.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => {
        goTo(i, true);
        stopAuto();
        autoTimer = setTimeout(startAuto, 450);
      });
      indicator.appendChild(dot);
    });
    const dots = Array.from(indicator.querySelectorAll(".dot"));

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const slideWidth = () => carousel.getBoundingClientRect().width || 1;
    const getIndex = () => clamp(Math.round(carousel.scrollLeft / slideWidth()), 0, slides.length - 1);
    let activeMediaIndex = -1;

    function syncMedia(force = false) {
      const idx = getIndex();
      if (!force && idx === activeMediaIndex) return;
      activeMediaIndex = idx;

      videos.forEach((video, videoIndex) => {
        if (!video) return;
        if (videoIndex === idx) {
          const playAttempt = video.play();
          if (playAttempt && typeof playAttempt.catch === "function") playAttempt.catch(() => {});
          return;
        }
        video.pause();
        try { video.currentTime = 0; } catch (_) { /* metadata is not ready yet */ }
      });
    }

    function syncDots() {
      const idx = getIndex();
      dots.forEach((d, i) => d.classList.toggle("active", i === idx));
      syncMedia();
    }

    function goTo(index, smooth) {
      const idx = clamp(index, 0, slides.length - 1);
      carousel.scrollTo({
        left: idx * slideWidth(),
        behavior: smooth ? "smooth" : "auto"
      });
    }

    let isDown = false, startX = 0, startLeft = 0, autoTimer = null;

    function getAutoDelay() {
      const activeVideo = videos[getIndex()];
      const duration = Number(activeVideo?.duration);
      return Number.isFinite(duration) && duration > 0
        ? Math.max(5000, Math.ceil(duration * 1000))
        : 5000;
    }

    function startAuto() {
      stopAuto();
      autoTimer = setTimeout(() => {
        const idx = getIndex();
        goTo((idx + 1) % slides.length, true);
        autoTimer = setTimeout(startAuto, 450);
      }, getAutoDelay());
    }
    function stopAuto() { if (autoTimer) clearTimeout(autoTimer); autoTimer = null; }

    videos.forEach((video, videoIndex) => {
      if (!video) return;
      video.addEventListener("loadedmetadata", () => {
        if (getIndex() === videoIndex) startAuto();
      }, { once: true });
    });

    syncDots();
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
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopAuto();
        videos.forEach((video) => video?.pause());
        return;
      }
      syncMedia(true);
      startAuto();
    });
  }

  // --- 2. Category Tabs ---
  async function initCategoryTabs() {
    const track = document.getElementById("productTabsCarousel");
    const dotsWrap = document.getElementById("productDots");
    if (!track || !dotsWrap) return;

    async function loadCategories() {
      const cached = readHomeCache(CATEGORIES_CACHE_KEY, CATEGORIES_CACHE_TTL);
      if (cached) return cached;
      try {
        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const res = await fetch(getApiBase() + '/api/product-types');
        if (!res.ok) throw new Error('Load product-types failed');
        const json = await res.json();
        const rows = json.data || [];
        writeHomeCache(CATEGORIES_CACHE_KEY, rows);
        return rows;
      } catch (err) {
        if (DEBUG_HOME) console.error('[ProductTabs] Load error:', err);
        return [];
      }
    }

    function renderCategories(categories) {
      const PREFERRED_ORDER = ['ทุเรียน', 'ลองกอง', 'มังคุด', 'เงาะ', 'ปาล์ม', 'ยางพารา', 'ผักสด', 'เมล็ดพันธุ์', 'ไม้ประดับ', 'สมุนไพร'];
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

        const imgName = categoryImageMap[cat.name] || 'durian.png';
        const i18nKey = categoryI18nKeyMap[cat.name] || cat.name;
        const displayName = t(i18nKey, cat.name);
        item.innerHTML = `
          <div class="cat-icon">
            <img src="${window.AgriPriceRouter?.resolveAsset('assets/images/' + imgName) || ('assets/images/' + imgName)}" 
                 alt="${displayName}" onerror="this.src='${window.AgriPriceRouter?.resolveAsset('assets/images/durian.png') || 'assets/images/durian.png'}'"
                 style="width: 32px; height: 32px; object-fit: contain;">
          </div>
          <span data-i18n="${i18nKey}">${displayName}</span>
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

    function parseLocation(value) {
      const rawLat = value?.lat ?? value?.latitude;
      const rawLng = value?.lng ?? value?.longitude;
      if (rawLat === '' || rawLng === '' || rawLat == null || rawLng == null) return null;
      const lat = Number(rawLat);
      const lng = Number(rawLng);
      return Number.isFinite(lat) && Number.isFinite(lng)
        && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        ? { lat, lng }
        : null;
    }

    function readJson(key) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    function getCurrentRole() {
      const user = readJson(window.AUTH_USER_KEY || "user_data");
      return String(user?.role || localStorage.getItem("role") || "guest").toLowerCase();
    }

    function readBuyerPinnedLocation() {
      const profile = readJson('myprofile_data_buyer');
      return parseLocation(profile?.location) || parseLocation(profile);
    }

    function readFarmerLastGps() {
      return parseLocation(readJson('agriprice_last_gps_farmer'));
    }

    function saveFarmerLastGps(loc) {
      if (!loc) return;
      try { localStorage.setItem('agriprice_last_gps_farmer', JSON.stringify(loc)); } catch (_) {}
    }

    async function fetchBuyerPinnedLocation() {
      const localPinned = readBuyerPinnedLocation();
      if (localPinned) return localPinned;

      const userPinned = parseLocation(readJson(window.AUTH_USER_KEY || "user_data"));
      if (userPinned) return userPinned;

      if (!window.api?.getProfile) return null;
      if (!BUYER_PROFILE_REQUEST) {
        BUYER_PROFILE_REQUEST = window.api.getProfile()
          .then((profile) => parseLocation(profile))
          .catch(() => null);
      }
      return BUYER_PROFILE_REQUEST;
    }

    // Farmer uses current GPS; buyer uses the pin saved in My Profile.
    async function fetchUserLocation() {
      try {
        const role = getCurrentRole();

        if (role === 'buyer') {
          const pinned = await fetchBuyerPinnedLocation();
          if (pinned) return pinned;
          return await window.LocationHelper?.getUserLocation?.({
            prompt: false,
            allowDefault: false,
            timeoutMs: 3000
          }) || null;
        }

        if (role === 'farmer') {
          const shouldPrompt = !FARMER_GPS_PROMPTED;
          FARMER_GPS_PROMPTED = true;
          const gps = await window.LocationHelper?.getUserLocation?.({
            prompt: shouldPrompt,
            allowDefault: false,
            timeoutMs: 5000
          });
          if (gps) {
            saveFarmerLastGps(gps);
            return gps;
          }
          return readFarmerLastGps();
        }
      } catch (e) { console.warn("[Home] fetchUserLocation failed:", e); }
      return null;
    }

    window.refreshDistances = async () => {
      const userLoc = await fetchUserLocation();
      ACTIVE_USER_LOCATION = userLoc;
      renderProducts(ALL_PRODUCTS, userLoc, mount);
    };

    window.filterProductsBySeller = async (sellerId, sellerName) => {
      if (DEBUG_HOME) console.log("[Home] Filtering products by seller:", sellerId, sellerName);
      FILTERED_SELLER_ID = sellerId;
      
      // Update Title
      const titleEl = document.querySelector(".products-section .section-title");
      if (titleEl) {
        if (sellerId) {
          const recommendLabel = t('recommend', 'รายการแนะนำ');
          const buyingPostsLabel = t('buying_posts', 'รายการรับซื้อ');
          titleEl.innerHTML = `<span style="color:var(--primary)">${sellerName || recommendLabel}</span> <span style="font-weight:400; font-size: 14px; color:#666;">(${buyingPostsLabel})</span>`;
          // Add clear button if not exists
          let clearBtn = document.getElementById('clearSellerFilter');
          if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.id = 'clearSellerFilter';
            clearBtn.className = 'view-all';
            clearBtn.style.border = 'none';
            clearBtn.style.background = 'none';
            clearBtn.style.marginLeft = 'auto';
            const clearFilterLabel = t('clear_filter', 'ล้างตัวกรอง');
            clearBtn.innerHTML = `<span style="font-size:12px">${clearFilterLabel}</span>`;
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
      ACTIVE_USER_LOCATION = userLoc;
      renderProducts(ALL_PRODUCTS, userLoc, mount);
    };

    // Start resolving the role-specific location as soon as Home initializes.
    // Product loading continues in parallel, so a permission prompt never blocks the feed.
    const initialLocationPromise = fetchUserLocation();

    try {
      // ── ใช้ cache ถ้ายังไม่หมดอายุ ──
      const cachedRows = getCachedProducts();
      if (cachedRows) {
        if (DEBUG_HOME) console.log('[ProductCards] Serving from cache, rows:', cachedRows.length);
        ALL_PRODUCTS = cachedRows; // Update global state
        renderProducts(cachedRows, null, mount);
        window._loc_found = false;
        initialLocationPromise.then((userLoc) => {
          if (userLoc) {
            window._loc_found = true;
            ACTIVE_USER_LOCATION = userLoc;
            renderProducts(ALL_PRODUCTS, userLoc, mount);
          }
        }).catch(() => {});

        // Background-refresh silently without holding the cached first paint.
        setTimeout(async () => {
          const apiRes = await fetch(currentBase + '/api/products?limit=50', { headers: getAuthHeaders() }).catch(() => null);
          if (apiRes?.ok) {
            const json = await apiRes.json();
            const rows = json.data || [];
            ALL_PRODUCTS = rows; // Update global state
            setCachedProducts(rows);
            renderProducts(rows, ACTIVE_USER_LOCATION, mount);
          }
        }, 200);
        return;
      }

      // ── No cache: fetch ทั้งคู่พร้อมกัน ──
      const apiRes = await fetch(currentBase + '/api/products?limit=50', { headers: getAuthHeaders() }).catch(() => null);

      if (apiRes?.ok) {
        const json = await apiRes.json();
        const rows = json.data || [];
        ALL_PRODUCTS = rows; // Save to global
        window._loc_found = false;
        setCachedProducts(rows); // บันทึก cache
        renderProducts(rows, null, mount);
        initialLocationPromise.then((userLoc) => {
          if (userLoc) {
            window._loc_found = true;
            ACTIVE_USER_LOCATION = userLoc;
            renderProducts(ALL_PRODUCTS, userLoc, mount);
          }
        }).catch(() => {});
      } else {
        renderProductState(
          mount,
          t('products_load_failed_title', 'โหลดรายการแนะนำไม่สำเร็จ'),
          t('products_load_failed_desc', 'กรุณาลองรีเฟรชหน้าอีกครั้ง'),
          'cloud_off'
        );
      }
    } catch (err) {
      if (DEBUG_HOME) console.error("[ProductCards] Error:", err);
      renderProductState(
        mount,
        t('products_load_failed_title', 'โหลดรายการแนะนำไม่สำเร็จ'),
        t('products_load_failed_desc', 'กรุณาลองรีเฟรชหน้าอีกครั้ง'),
        'cloud_off'
      );
    }
  }

  // ── Shared render helper (แยกออกมาให้ใช้ร่วมกับ cache path) ──
  function renderProducts(rows, userLoc, mount) {
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

    const parsePositivePrice = (value) => {
      if (value === undefined || value === null) return null;
      const raw = String(value).trim();
      if (!raw || raw === '-' || raw.toLowerCase() === 'null') return null;
      const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
      const price = Number(match ? match[0] : raw);
      return Number.isFinite(price) && price > 0 ? price : null;
    };

    const getGradeRows = (p, mixedLabel) => {
      const source = Array.isArray(p.grades)
        ? p.grades
        : (Array.isArray(p.product_grades)
          ? p.product_grades
          : (Array.isArray(p.offer_grades) ? p.offer_grades : []));
      const rows = source
        .map(g => ({ grade: g.grade_name || g.grade || mixedLabel, price: parsePositivePrice(g.price) }))
        .filter(g => g.price !== null);
      if (rows.length) return rows;
      const fallbackPrice = parsePositivePrice(p.price);
      return fallbackPrice !== null ? [{ grade: p.grade || mixedLabel, price: fallbackPrice }] : [];
    };

    const products = filteredRows
      .map(p => {
        const unit = p.unit || t('kg_unit', 'กก.');
        let prices = { priceA: null, priceB: null, priceC: null };
        const bahtUnit = t('unit_baht', 'บ.');
        const unitStr = `${bahtUnit}/${unit}`;
        const mixedLabel = t('mixed', 'คละ');
        
        let gradesArr = getGradeRows(p, mixedLabel);
        if (gradesArr.length > 0) {
            gradesArr.forEach(g => {
                const gName = String(g.grade || mixedLabel).toUpperCase();
                const pStr = `${g.price} ${unitStr}`;
                if (gName === 'B') prices.priceB = pStr;
                else if (gName === 'C') prices.priceC = pStr;
                else prices.priceA = pStr;
            });
        }

        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
        const sLat = p.lat ?? profile?.lat ?? null;
        const sLng = p.lng ?? profile?.lng ?? null;
        const distKm = (userLoc && sLat != null && sLng != null && window.LocationHelper?.calculateDistance)
          ? window.LocationHelper.calculateDistance(userLoc.lat, userLoc.lng, sLat, sLng)
          : null;

        // Pass stale status to card for button disabling
        const isStale = isStaleProduct(p);
        const offerId = p.offer_id || p.offerId || p.product_id || p.productId || p.id;

        return {
          offerId,
          sellerId: p.user_id,
          sellerName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ'),
          sellerSub: p.variety ? `${t(p.name, p.name)} (${t(p.variety, p.variety)})` : t(p.name, p.name),
          avatar: profile?.avatar || 'assets/images/avatar-guest.svg',
          ...prices,
          grades: gradesArr,
          updateTime: formatTime(p.created_at),
          distance: (distKm !== null) ? (window.LocationHelper.formatDistance?.(distKm) || '') : '',
          _distKm: distKm,
          productId: offerId,
          isStale
        };
      });

    if (userLoc) {
      products.sort((a, b) =>
        (a._distKm ?? Number.POSITIVE_INFINITY) -
        (b._distKm ?? Number.POSITIVE_INFINITY)
      );
    }

    mount.innerHTML = '';
    if (products.length === 0) {
      renderProductState(
        mount,
        FILTERED_SELLER_ID
          ? t('no_products_for_seller', 'ยังไม่มีรายการรับซื้อจากร้านนี้')
          : t('no_products_yet', 'ยังไม่มีรายการรับซื้อ'),
        t('no_products_home_desc', 'เมื่อผู้รับซื้อเปิดประกาศรับซื้อ รายการจะแสดงที่นี่'),
        'inventory_2'
      );
      return;
    }

    let currentIndex = 0;
    const PAGE_SIZE = 3;

    const renderNextBatch = async () => {
      const batch = products.slice(currentIndex, currentIndex + PAGE_SIZE);
      
      let templateHtml = "";
      if (window.ProductCard) {
        try {
          // Use relative path from root for home page
          templateHtml = await window.ProductCard.loadTemplate("components/product-card/product-card.html");
        } catch (e) { 
          console.error("[Home] Failed to load product-card template:", e);
          // Fallback if loadTemplate fails
          const tplRes = await fetch("components/product-card/product-card.html").catch(() => null);
          if (tplRes?.ok) templateHtml = await tplRes.text();
        }
      }

      if (!templateHtml) {
          console.error("[Home] templateHtml is empty, cards will not render properly.");
      }

      batch.forEach(item => {
        if (window.ProductCard && templateHtml) {
          const data = {
            ...item,
            id: item.offerId || item.productId,
            offer_id: item.offerId || item.productId,
            user_id: item.sellerId,
            title: item.sellerName,
            subtitle: item.sellerSub,
            avatar: item.avatar,
            updated: item.updateTime,
            distance: item.distance,
            staleText: t('stale_buyer_label', 'จองไม่ได้'),
            staleTooltip: t('stale_buyer_tooltip', `ไม่สามารถจองได้ (ไม่ได้อัปเดทเกิน ${staleDaysLimit} วัน)`)
          };

          const node = window.ProductCard.createCardEl(data, {}, templateHtml);
          
          // Favorite sync for home page (if not buyer)
          let currentRole = String(window.api?.getRole?.() || localStorage.getItem(window.AUTH_ROLE_KEY || "role") || "").toLowerCase();
          if (!currentRole || currentRole === "guest") {
            try {
              const rawUser = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
              currentRole = String((rawUser ? JSON.parse(rawUser) : null)?.role || "").toLowerCase();
            } catch (_) {}
          }
          const isBuyer = currentRole === "buyer";

          if (!isBuyer) {
            const favId = item.offerId || item.productId || item.sellerId;
            const favKind = (item.offerId || item.productId) ? 'product' : 'seller';
            if (window.FavoritesStore?.has(favId, favKind)) {
              node.querySelector('[data-action="toggle-favorite"]')?.classList.add('active');
            }
          }

          mount.appendChild(node);
        } else {
            // Minimal fallback if template failed
            const fallback = document.createElement('div');
            fallback.className = 'product-card';
            fallback.textContent = item.sellerName;
            mount.appendChild(fallback);
        }
      });
      currentIndex += PAGE_SIZE;
      updateButtonVisibility();
    };

    const updateButtonVisibility = () => {
      setLoadMoreVisible(currentIndex < products.length);
    };

    renderNextBatch();
    const loadMoreBtn = document.querySelector('.btn-load-more');
    if (loadMoreBtn) loadMoreBtn.onclick = () => renderNextBatch();
  }

  // --- 4. Banner Announcements ---
  async function initBanners() {
    const track = document.getElementById("bannerCarousel");
    if (!track) return;

    const renderBanners = (list) => {
      if (!Array.isArray(list) || !list.length) return;
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
    };

    const cached = readHomeCache(ANNOUNCEMENTS_CACHE_KEY, ANNOUNCEMENTS_CACHE_TTL);
    if (cached) renderBanners(cached);

    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    try {
      const res = await fetch(getApiBase() + '/api/announcements?limit=8');
      if (!res.ok) return;
      const json = await res.json();
      const list = json.data || [];
      if (!list.length) return;
      writeHomeCache(ANNOUNCEMENTS_CACHE_KEY, list);
      renderBanners(list);
    } catch (_) { }
  }

  // Click Delegations for Home-specific actions (like See More)
  // Note: Product card clicks (profile, book, favorite) are handled by global delegation in components.js

  // Search Logic
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const searchBox = document.getElementById('homeSearchBox');
  if (searchBtn && searchInput) {
    const goSearch = () => {
      const url = 'pages/shared/search-results.html';
      if (window.navigateWithTransition) window.navigateWithTransition(url); else window.location.href = url;
    };
    searchBox?.addEventListener('click', goSearch);
    searchBox?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goSearch();
      }
    });
  }

  // Global Refresh Helper
  window.__AGRIPRICE_REFRESH_HOME = async () => {
    await Promise.allSettled([initProductCards(), initBanners()]);
  };
  let realtimeOfferTimer = null;
  window.addEventListener('agriprice:realtime:offer', () => {
    clearTimeout(realtimeOfferTimer);
    realtimeOfferTimer = setTimeout(window.__AGRIPRICE_REFRESH_HOME, 150);
  });

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
