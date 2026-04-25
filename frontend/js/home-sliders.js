(function initHeroSlider() {
  const DEBUG_HOME = !!window.AGRIPRICE_DEBUG;
  const carousel = document.getElementById("heroCarousel");
  const indicator = document.getElementById("heroIndicator");
  if (!carousel || !indicator) return;

  const slides = Array.from(carousel.querySelectorAll(".hero-slide"));
  if (!slides.length) return;

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

  // ---- dots ----
  indicator.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goTo(i, true));
    indicator.appendChild(dot);
  });
  const dots = Array.from(indicator.querySelectorAll(".dot"));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function slideWidth() {
    return carousel.getBoundingClientRect().width || 1;
  }

  function getIndex() {
    return clamp(Math.round(carousel.scrollLeft / slideWidth()), 0, slides.length - 1);
  }

  function syncDots() {
    const idx = getIndex();
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    return idx;
  }

  function goTo(index, smooth) {
    const idx = clamp(index, 0, slides.length - 1);
    carousel.scrollTo({
      left: idx * slideWidth(),
      behavior: smooth ? "smooth" : "auto"
    });
  }

  // ---- drag-to-scroll (mouse + touch) ----
  let isDown = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  carousel.addEventListener("pointerdown", (e) => {
    carousel.setPointerCapture?.(e.pointerId);
    isDown = true;
    moved = false;
    startX = e.clientX;
    startLeft = carousel.scrollLeft;
    carousel.classList.add("dragging");
    stopAuto();
  });

  carousel.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    carousel.scrollLeft = startLeft - dx;
  });

  function endDrag() {
    if (!isDown) return;
    isDown = false;
    carousel.classList.remove("dragging");
    goTo(getIndex(), true);
    startAuto();
  }

  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
    const track = document.getElementById("productTabsCarousel");
    const dotsWrap = document.getElementById("productDots");
    if (!track || !dotsWrap) return;

    // Dynamic load categories from backend
    async function loadCategories() {
      try {
        const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
        const res = await fetch(API_BASE + '/api/product-types');
        if (!res.ok) throw new Error('Load product-types failed');
        const json = await res.json();
        const categories = json.data || [];
        return categories;
      } catch (err) {
        console.error('[ProductTabs] Load error:', err);
        return [];
      }
    }

    function renderCategories(categories) {
      // Standard fruit categories (display order)
      const PREFERRED_ORDER = [
        'ทุเรียน', 'ลองกอง', 'มังคุด', 'เงาะ', 'ปาล์ม', 'ยางพารา', 'ผักสด', 'เมล็ดพันธุ์', 'ไม้ประดับ', 'สมุนไพร', 'ลำไย'
      ];
      // Map backend categories
      const catMap = {};
      categories.forEach(cat => {
        catMap[cat.name] = cat;
      });
      // Fill with defaults if missing from API
      const fullCats = PREFERRED_ORDER.map(name => catMap[name] || { id: name, name });
      // Clear grid
      track.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'product-grid';
      fullCats.forEach((cat, i) => {
        const item = document.createElement('div');
        item.className = 'product-item' + (i === 0 ? ' active' : '');
        item.dataset.category = cat.id;
        // Use default images or fallback
        const img = document.createElement('img');
        const imgName = categoryImageMap[cat.name] || 'default.png';
        img.src = 'assets/images/' + imgName;
        img.alt = cat.name || 'หมวดหมู่';
        img.onerror = function() {
          this.onerror = null;
          this.src = 'assets/images/default.png';
        };
        item.appendChild(img);
        const span = document.createElement('span');
        span.textContent = cat.name || cat.id;
        item.appendChild(span);
        grid.appendChild(item);
      });
      track.appendChild(grid);
      return Array.from(grid.children);
    }

    // ---------- dots ----------
    function pagesCount(items) {
      return Math.max(1, Math.ceil(items.length / 10));
    }

    function buildDots(items) {
      const pages = pagesCount(items);
      dotsWrap.innerHTML = '';
      for (let i = 0; i < pages; i++) {
        const dot = document.createElement('span');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => scrollToPage(i, items, true));
        dotsWrap.appendChild(dot);
      }
    }

    function clampTab(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function scrollToPage(pageIndex, items, smooth) {
      const pages = pagesCount(items);
      const idx = clampTab(pageIndex, 0, pages - 1);
      const target = items[idx * 10];
      if (!target) return;
      target.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        inline: 'start',
        block: 'nearest'
      });
    }

    function getGapX() {
      const grid = track.querySelector('.product-grid');
      const style = grid ? getComputedStyle(grid) : getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || '8');
      return Number.isFinite(gap) ? gap : 8;
    }

    function getPageWidth(items) {
      const itemW = items[0]?.getBoundingClientRect().width || 1;
      const columnsPerView = 5;
      return (itemW + getGapX()) * columnsPerView;
    }

    function setActiveDot(items) {
      const dots = Array.from(dotsWrap.querySelectorAll('.dot'));
      if (!dots.length) return;
      const pages = pagesCount(items);
      const pageWidth = getPageWidth(items);
      const pageIndex = clampTab(Math.round(track.scrollLeft / pageWidth), 0, pages - 1);
      dots.forEach((d, i) => d.classList.toggle('active', i === pageIndex));
    }

    // ---------- drag-to-scroll ----------
    let isDownTab = false;
    let startXTab = 0;
    let startLeftTab = 0;
    let movedTab = false;
    let itemsTab = [];

    track.addEventListener('pointerdown', (e) => {
      track.setPointerCapture?.(e.pointerId);
      isDownTab = true;
      movedTab = false;
      startXTab = e.clientX;
      startLeftTab = track.scrollLeft;
      track.classList.add('dragging');
    });

    track.addEventListener('pointermove', (e) => {
      if (!isDownTab) return;
      const dx = e.clientX - startXTab;
      if (Math.abs(dx) > 4) movedTab = true;
      track.scrollLeft = startLeftTab - dx;
    });

    function endDragTab() {
      if (!isDownTab) return;
      isDownTab = false;
      track.classList.remove('dragging');
      const pageWidth = getPageWidth(itemsTab);
      const targetPage = Math.round(track.scrollLeft / pageWidth);
      scrollToPage(targetPage, itemsTab, true);
    }

    track.addEventListener('pointerup', endDragTab);
    track.addEventListener('pointercancel', endDragTab);
    track.addEventListener('pointerleave', endDragTab);

    track.addEventListener('click', (e) => {
      if (!movedTab) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    let rafTab = null;
    track.addEventListener('scroll', () => {
      if (rafTab) cancelAnimationFrame(rafTab);
      rafTab = requestAnimationFrame(() => setActiveDot(itemsTab));
    });

    window.addEventListener('resize', () => {
      buildDots(itemsTab);
      setActiveDot(itemsTab);
    });

    // init: load categories and render
    (async () => {
      const categories = await loadCategories();
      itemsTab = renderCategories(categories);
      buildDots(itemsTab);
      setActiveDot(itemsTab);
    })();
  })();
  // ...existing code for dynamic product-tabs-section (already handled above)...




function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'เพิ่งอัปเดต';
  if (diff < 60) return `อัปเดต ${diff} นาที`;
  if (diff < 1440) return `อัปเดต ${Math.floor(diff / 60)} ชั่วโมง`;
  return `อัปเดต ${Math.floor(diff / 1440)} วัน`;
}

(async function initProductCards() {
  const mount = document.getElementById("productCardsMount");
  if (!mount) return;

    const DEBUG_HOME = !!window.AGRIPRICE_DEBUG; // Define DEBUG_HOME here
  // ตรวจ role ที่ใช้งานอยู่ (เหมือนใน search/profile)
  let role = "farmer";
  try {
    const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.role) role = String(u.role).toLowerCase();
  } catch (_) {}
  const isBuyer = role === "buyer";

  function syncCardFavoriteState(card) {
    if (!card || !window.FavoritesStore) return;
    const productId = card.dataset.productId || "";
    const sellerId = card.dataset.sellerId || "";
    const kind = productId ? "product" : "seller";
    const id = kind === "product" ? productId : sellerId;
    const favBtn = card.querySelector('[data-action="toggle-favorite"]');
    if (favBtn && id) {
      favBtn.classList.toggle("active", window.FavoritesStore.has(id, kind));
    }
  }

  function syncMountedFavorites() {
    if (!mount) return;
    mount.querySelectorAll('.product-card').forEach((card) => {
      syncCardFavoriteState(card);
    });
  }

  function toggleFavoriteCard(card, actionEl) {
    if (!card || !actionEl || !window.FavoritesStore) return;

    const productId = card.dataset.productId || "";
    const sellerId = card.dataset.sellerId || "";
    const kind = productId ? "product" : "seller";
    const favoriteId = kind === "product" ? productId : sellerId;
    if (!favoriteId) return;

    console.log("[Agriprice favorite click][home-sliders]", {
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
  }

  try {
    // 1) โหลด template
    const res = await fetch("components/product-card/product-card.html");
    if (!res.ok) {
      console.error("Load product-card.html failed:", res.status);
      return;
    }

    const holder = document.createElement("div");
    holder.style.display = "none";
    holder.innerHTML = await res.text();
    document.body.appendChild(holder);

    const tpl = document.getElementById("productCardTpl");
    if (!tpl) {
      console.error("productCardTpl not found");
      return;
    }

    // 2) ดึงข้อมูลจาก API จริง
    let products = [];
    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');

    if (API_BASE) {
      try {
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';

        // ดึง GPS — ใช้ AgriPermission (ซึ่งจะใช้ Capacitor plugin บน native)
        let userLat = null, userLng = null;
        try {
          if (window.AgriPermission) {
            const locResult = await window.AgriPermission.requestLocation();
            if (locResult.granted && locResult.position) {
              const coords = locResult.position.coords || locResult.position;
              userLat = coords.latitude;
              userLng = coords.longitude;
            } else if (locResult.granted && !locResult.position) {
              // already_granted state — ดึงพิกัดตรงผ่าน Capacitor หรือ browser
              const Geo = window.Capacitor?.Plugins?.Geolocation;
              if (Geo) {
                const pos = await Geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 6000 });
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
              } else if (navigator.geolocation) {
                await new Promise((resolve) => {
                  navigator.geolocation.getCurrentPosition(
                    (p) => { userLat = p.coords.latitude; userLng = p.coords.longitude; resolve(); },
                    () => resolve(), { timeout: 6000, maximumAge: 300000 }
                  );
                });
              }
            }
          }
        } catch (_) {}

        let apiUrl = API_BASE + '/api/products?limit=50';
        if (userLat !== null && userLng !== null) {
          apiUrl += `&lat=${userLat}&lng=${userLng}`;
        }

        const apiRes = await fetch(apiUrl, {
          headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          const rows = json.data || [];

          const allProducts = rows.map(p => {
            const grade = (p.grade || '').toUpperCase();
            const price = Number(p.price) || 0;
            const unitValue = String(p.unit || '').trim();
            const unit = (!unitValue || /[เธโ\uFFFD]/.test(unitValue)) ? 'กก.' : unitValue;
            const label = `${price} บ./${unit}`;

            const gradesArr = Array.isArray(p.product_grades) ? p.product_grades : [];
            let priceA = null, priceB = null, priceC = null;
            if (gradesArr.length > 0) {
              gradesArr.forEach(g => {
                const gl = (g.grade || '').toUpperCase();
                const gl2 = `${Number(g.price)} บ./${unit}`;
                if (gl === 'A') priceA = gl2;
                else if (gl === 'B') priceB = gl2;
                else if (gl === 'C') priceC = gl2;
              });
            } else {
              if (grade === 'A') priceA = label;
              else if (grade === 'B') priceB = label;
              else if (grade === 'C') priceC = label;
              else priceA = label;
            }

            // คำนวณระยะทาง (Haversine)
            let distance = '';
            let distKm = null;
            const sLat = p.profiles?.lat ?? p.lat ?? null;
            const sLng = p.profiles?.lng ?? p.lng ?? null;
            if (userLat !== null && sLat !== null && sLng !== null) {
              const R = 6371;
              const dLat = (sLat - userLat) * Math.PI / 180;
              const dLon = (sLng - userLng) * Math.PI / 180;
              const a = Math.sin(dLat/2)**2 + Math.cos(userLat * Math.PI/180) * Math.cos(sLat * Math.PI/180) * Math.sin(dLon/2)**2;
              distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              distance = distKm < 1 ? `${Math.round(distKm * 1000)} ม.` : `${distKm.toFixed(1)} กม.`;
            }

            return {
              sellerId:   p.user_id || '',
              sellerName: p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.trim() : 'ไม่ทราบชื่อ',
              sellerSub:  p.variety ? `${p.name} (${p.variety})` : p.name,
              avatar:     p.profiles?.avatar || '',
              priceA, priceB, priceC,
              updateTime: formatTimeAgo(p.created_at),
              distance,
              _distKm:    distKm,
              favorite:   false,
              productId:  p.product_id || '',
            };
          });

          // เรียงใกล้สุดก่อน ถ้ามี GPS
          if (userLat !== null) {
            allProducts.sort((a, b) => (a._distKm ?? 9999) - (b._distKm ?? 9999));
          }

          products = allProducts.slice(0, 3);
          mount._allProducts = allProducts;
          mount._shownCount  = 3;
        }
      } catch (fetchErr) {
        if (DEBUG_HOME) console.warn('[home-sliders] API fetch failed:', fetchErr.message);
      }
    }

    // ถ้าไม่มีข้อมูลจาก API แสดง empty state
    if (!products.length) {
      mount.innerHTML = '<div style="padding:32px;text-align:center;color:#888;font-size:14px;">ยังไม่มีผู้รับซื้อในระบบ</div>';
      return;
    }

    // 3) render
    mount.innerHTML = "";
    for (const item of products) {
      const node = tpl.content.firstElementChild.cloneNode(true);

      node.dataset.sellerId   = item.sellerId   || "";
      node.dataset.sellerName = item.sellerName || "";
      node.dataset.productId  = item.productId  || "";

      const img = node.querySelector('[data-bind="avatar"]');
      img.src = item.avatar || "";
      img.alt = item.sellerName || "";

      node.querySelector('[data-bind="sellerName"]').textContent = item.sellerName || "";
      node.querySelector('[data-bind="sellerSub"]').textContent = item.sellerSub || "";

      // ซ่อน price-box ที่ไม่มีข้อมูล
      ['A','B','C'].forEach(g => {
        const priceVal = item['price' + g];
        const box = node.querySelector('[data-bind="price' + g + '"]')?.closest('.price-box');
        if (box) {
          if (priceVal) {
            node.querySelector('[data-bind="price' + g + '"]').textContent = priceVal;
          } else {
            box.remove(); // ไม่มีราคา ให้เอา box ออกเลย
          }
        }
      });

      node.querySelector('[data-bind="distance"]').textContent = item.distance || "";
      node.querySelector('[data-bind="updateTime"]').textContent = item.updateTime || "";

      const fav = node.querySelector('[data-action="toggle-favorite"]');
      if (isBuyer) {
        fav?.remove();
      } else {
        const favId = item.productId || item.sellerId || "";
        const isApiFav = item.productId ? false : (item.is_favorited ?? item.favorite ?? false);
        const isLocalFav = favId ? (window.FavoritesStore?.has(favId, item.productId ? 'product' : 'seller') ?? false) : false;
        if (isApiFav || isLocalFav) fav?.classList.add("active");
      }

      // buyer: remove booking/contact/favorite actions
      if (isBuyer) {
        node.querySelectorAll('[data-action="book"]').forEach(el => el.remove());
        node.querySelectorAll('[data-action="contact"]').forEach(el => el.remove());
        node.querySelectorAll('[data-action="toggle-favorite"]').forEach(el => el.remove());
        node.querySelectorAll('.favorite-btn').forEach(el => el.remove());
        node.querySelector(".action-row")?.remove();
        node.querySelector(".card-actions")?.remove();
        node.querySelector("[data-actions]")?.remove();
        // ไม่ต้องปิด pointerEvents ต่อไป - ให้ seller-info (open-profile) คลิกได้
      }

      mount.appendChild(node);
    }

    // 5) Load more button
    const loadMoreBtn = document.querySelector('.btn-load-more');
    if (loadMoreBtn) {
      // ซ่อนปุ่มถ้า product มีไม่ถึง 3
      if ((mount._allProducts || []).length <= 3) {
        loadMoreBtn.style.display = 'none';
      }
      // ลบ handler เก่าทิ้งก่อน (กันซ้ำ)
      const newBtn = loadMoreBtn.cloneNode(true);
      loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);

      newBtn.addEventListener('click', function () {
        const all   = mount._allProducts || [];
        const shown = mount._shownCount  || 3;
        const next  = all.slice(shown, shown + 3);

        next.forEach(item => {
          const tplEl = document.getElementById('productCardTpl');
          if (!tplEl) return;
          const node = tplEl.content.firstElementChild.cloneNode(true);

          node.dataset.sellerId   = item.sellerId   || '';
          node.dataset.sellerName = item.sellerName || '';
          node.dataset.productId  = item.productId  || '';

          const img = node.querySelector('[data-bind="avatar"]');
          if (img) { img.src = item.avatar || ''; img.alt = item.sellerName || ''; }

          const q = (el, s) => node.querySelector(el)?.textContent !== undefined && (node.querySelector(el).textContent = s);
          q('[data-bind="sellerName"]', item.sellerName || '');
          q('[data-bind="sellerSub"]',  item.sellerSub  || '');
          // ซ่อน price-box ที่ไม่มีข้อมูล
          ['A','B','C'].forEach(g => {
            const priceVal = item['price' + g];
            const box = node.querySelector('[data-bind="price' + g + '"]')?.closest('.price-box');
            if (box) {
              if (priceVal) {
                node.querySelector('[data-bind="price' + g + '"]').textContent = priceVal;
              } else {
                box.remove();
              }
            }
          });
          q('[data-bind="distance"]',   item.distance   || '');
          q('[data-bind="updateTime"]', item.updateTime || '');

          const fav = node.querySelector('[data-action="toggle-favorite"]');
          if (isBuyer) {
            fav?.remove();
          } else {
            const favId = item.productId || item.sellerId || "";
            const isApiFav = item.productId ? false : (item.is_favorited ?? item.favorite ?? false);
            const isLocalFav = favId ? (window.FavoritesStore?.has(favId, item.productId ? 'product' : 'seller') ?? false) : false;
            if (isApiFav || isLocalFav) fav?.classList.add("active");
          }

          if (isBuyer) {
            node.querySelectorAll('[data-action="book"]').forEach(el => el.remove());
            node.querySelectorAll('[data-action="contact"]').forEach(el => el.remove());
            node.querySelectorAll('[data-action="toggle-favorite"]').forEach(el => el.remove());
            node.querySelectorAll('.favorite-btn').forEach(el => el.remove());
            node.querySelector('.action-row')?.remove();
            node.querySelector('.card-actions')?.remove();
            node.querySelector('[data-actions]')?.remove();
          }

          mount.appendChild(node);
        });

        mount._shownCount = shown + next.length;

        // ซ่อนปุ่มถ้าแสดงครบแล้ว
        if (mount._shownCount >= all.length) {
          newBtn.style.display = 'none';
        }
      });
    }

    // 4) event delegation (ให้ทำงานทุกใบ)
    
    function goProfile(card) {
      const uid  = card.dataset.sellerId || "";
      const name = card.dataset.sellerName || card.querySelector(".seller-name")?.textContent?.trim() || "";
      const q    = uid ? `uid=${encodeURIComponent(uid)}` : `name=${encodeURIComponent(name)}`;
      if (window.navigateWithTransition) window.navigateWithTransition(`pages/shared/profile.html?${q}`); else window.location.href = `pages/shared/profile.html?${q}`;
    }

    mount.addEventListener("click", (e) => {
      const card = e.target.closest(".product-card");
      if (!card) {
        return;
      }

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) {
        return;
      }

      const action = actionEl.dataset.action;

      if (action === "toggle-favorite") {
        if (isBuyer) return;
        e.__agripriceHandled = true;
        e.preventDefault();
        console.log("[Agriprice favorite click][home-sliders]", {
          action,
          productId: card.dataset.productId || "",
          sellerId: card.dataset.sellerId || "",
        });
        e.stopPropagation();
        e.stopImmediatePropagation();

        toggleFavoriteCard(card, actionEl);

        return;
      }

      // buyer ดูโปรไฟล์ได้
      if (action === "open-profile") {
        goProfile(card);
        return;
      }

      if (DEBUG_HOME) console.log("[Agriprice click][home-sliders] open-profile action");
      if (action === "book") {
        if (isBuyer) return; // buyer shouldn't see / click
        e.preventDefault();
        e.stopPropagation();
        
        // บันทึกหน้าปัจจุบันก่อนเปิด booking
        localStorage.setItem("bookingReferrer", window.location.href);

        // บันทึก sellerId (buyer/ผู้ขายที่จะไปส่ง) ก่อน redirect
        const sellerId   = card.dataset.sellerId   || "";
        const sellerName = card.dataset.sellerName || card.querySelector('[data-bind="sellerName"]')?.textContent?.trim() || "";
        const productId  = card.dataset.productId  || "";
        if (sellerId)   localStorage.setItem("bookingFarmerId",   sellerId);
        if (sellerName) localStorage.setItem("bookingFarmerName", sellerName);
        if (productId)  localStorage.setItem("bookingProductId",  productId);
        
        // ไปหน้าจองตาม role
        let role = "farmer";
        try {
          const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
          const u = raw ? JSON.parse(raw) : null;
          if (u && u.role) role = String(u.role);
        } catch (_) {}

        const nextHref = role === "buyer"
          ? "pages/buyer/setbooking/booking.html"
          : "pages/farmer/booking/booking-step1.html";
        if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
        return;
      }


      if (action === "contact") {
        if (isBuyer) return;
        e.preventDefault();
        e.stopPropagation();
        const sellerId = card.dataset.sellerId || "";
        if (!sellerId) return;
        const apiBase = (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        if (apiBase && token) {
          fetch(apiBase + '/api/chats/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ target_user_id: sellerId }),
          }).then(r => r.json()).then(j => {
            if (j.chatId) {
              const nextHref = 'pages/shared/chat.html?chatId=' + j.chatId;
              if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
            }
          }).catch(() => {
            if (window.navigateWithTransition) window.navigateWithTransition('pages/shared/chat.html'); else window.location.href = 'pages/shared/chat.html';
          });
        } else {
          if (window.navigateWithTransition) window.navigateWithTransition('pages/shared/chat.html'); else window.location.href = 'pages/shared/chat.html';
        }
        return;
      }
    });

    // รองรับการกด Enter บน seller-info และ favorite (เพราะเป็น div)
    mount.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;

      const card = e.target.closest(".product-card");
      if (!card) return;

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      if (action === "open-profile") {
        goProfile(card);
      }

      if (action === "toggle-favorite") {
        if (isBuyer) return;
        e.__agripriceHandled = true;
        console.log("[Agriprice favorite keydown][home-sliders]", {
          productId: card.dataset.productId || "",
          sellerId: card.dataset.sellerId || "",
        });
        toggleFavoriteCard(card, actionEl);
      }
    });

    // Realtime sync: keep current cards updated without manual refresh.
    window.addEventListener('favorites:changed', () => {
      syncMountedFavorites();
    });

    window.addEventListener('storage', (e) => {
      if (e.key === (window.FavoritesStore?.KEY || 'agriprice_favorites_v1')) {
        syncMountedFavorites();
      }
    });

    window.addEventListener('focus', () => {
      syncMountedFavorites();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) syncMountedFavorites();
    });
  } catch (err) {
    console.error("Product cards init error:", err);
  }
})();



// Banner (dot + drag + snap


(async function bannerInit() {
  const track = document.getElementById("bannerCarousel");
  const dotsWrap = document.getElementById("bannerDots");
  if (!track || !dotsWrap) return;

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatThaiDate(dateValue) {
    if (!dateValue) return "";
    const dt = new Date(dateValue);
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(dt);
  }

  async function hydrateAnnouncementCards() {
    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    if (!API_BASE) return;

    try {
      const res = await fetch(API_BASE + '/api/announcements?limit=8');
      if (!res.ok) return;
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      if (!list.length) return;

      track.innerHTML = '';

      list.forEach((item) => {
        const rawLink = String(item?.link || '#');
        const safeLink = rawLink.replace(/^http:\/\//i, 'https://');
        const a = document.createElement('a');
        a.className = 'banner-item news-item';
        a.href = safeLink;
        a.rel = 'noopener noreferrer';
        a.innerHTML = `
          <div class="news-top">
            <span class="news-chip">${escapeHtml(item?.source || 'ข่าวเกษตร')}</span>
            <span class="material-icons-outlined news-link-icon" aria-hidden="true">north_east</span>
          </div>
          <h4 class="news-title">${escapeHtml(item?.title || '')}</h4>
          <div class="news-meta">
            <span>${escapeHtml(formatThaiDate(item?.published_at) || 'อัปเดตล่าสุด')}</span>
            <span class="news-more">อ่านต่อ</span>
          </div>
        `;
        track.appendChild(a);
      });
    } catch (_) {}
  }

  await hydrateAnnouncementCards();

  const items = Array.from(track.querySelectorAll(".banner-item"));
  if (!items.length) return;

  const perPage = 2; // 2 ใบต่อหน้า

  function pagesCount() {
    return Math.max(1, Math.ceil(items.length / perPage));
  }

  function buildDots() {
    dotsWrap.innerHTML = "";
    const pages = pagesCount();

    for (let i = 0; i < pages; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => scrollToPage(i, true));
      dotsWrap.appendChild(dot);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getGapPx() {
    const style = getComputedStyle(track);
    return parseFloat(style.gap || 12);
  }

  function getPageWidth() {
    const itemW = items[0].getBoundingClientRect().width;
    return (itemW + getGapPx()) * perPage;
  }

  function scrollToPage(pageIndex, smooth) {
    const pages = pagesCount();
    const idx = clamp(pageIndex, 0, pages - 1);

    const targetItem = items[idx * perPage];
    if (!targetItem) return;

    targetItem.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      inline: "start",
      block: "nearest"
    });
  }

  function setActiveDot() {
    const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
    if (!dots.length) return;

    const pageWidth = getPageWidth();
    const pageIndex = clamp(
      Math.round(track.scrollLeft / pageWidth),
      0,
      pagesCount() - 1
    );

    dots.forEach((d, i) => d.classList.toggle("active", i === pageIndex));
  }

  /* Drag */
  let isDown = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  track.addEventListener("pointerdown", (e) => {
    if (e.target.closest('.banner-item.news-item')) {
      // Prioritize tap-to-open behavior for news cards.
      isDown = false;
      moved = false;
      return;
    }

    track.setPointerCapture?.(e.pointerId);
    isDown = true;
    moved = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    track.classList.add("dragging");
  });

  track.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 10) moved = true;
    track.scrollLeft = startLeft - dx;
  });

  function endDrag() {
    if (!isDown) return;
    isDown = false;
    track.classList.remove("dragging");

    const pageWidth = getPageWidth();
    const targetPage = Math.round(track.scrollLeft / pageWidth);
    scrollToPage(targetPage, true);
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("pointerleave", endDrag);

  track.addEventListener(
    "click",
    (e) => {
      const link = e.target.closest('a.banner-item.news-item[href]');

      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
        return;
      }

      if (!link) return;

      // Let anchor navigation continue naturally when not dragging.
      moved = false;
    },
    true
  );

  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(setActiveDot);
  });

  window.addEventListener("resize", () => {
    buildDots();
    setActiveDot();
  });

  buildDots();
  setActiveDot();
})();

/**
 * AGRIPRICE - Home Page JS
 */
document.addEventListener('DOMContentLoaded', function () {

  // โ”€โ”€ Search โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  var searchBtn = document.getElementById('searchBtn');
  var searchInput = document.getElementById('searchInput');

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

  const prefixPages = getRelativePrefixToPages();

  function goSearch() {
    var q = (searchInput && searchInput.value ? searchInput.value : '').trim();
    const nextHref = q
      ? prefixPages + 'shared/search-results.html?q=' + encodeURIComponent(q)
      : prefixPages + 'shared/search-results.html';
    if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
  }

  if (searchBtn) searchBtn.addEventListener('click', goSearch);
  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') goSearch();
    });
  }

  // โ”€โ”€ Sliders โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  if (typeof initHomeSliders === 'function') {
    initHomeSliders();
  }
});
