/**
 * AGRIPRICE - Shared Profile JS
 * Handles fetching other users' profiles, following, and starting chats.
 */
(function () {
  const DEBUG_PROFILE = !!window.AGRIPRICE_DEBUG;
  const getApiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  
  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // --- UI Helpers ---
  function showLoading(visible) {
    let el = document.getElementById('loadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loadingOverlay';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;font-size:16px;color:#fff;backdrop-filter:blur(4px);';
      el.innerHTML = '<div class="loading-spinner" style="border:3px solid rgba(255,255,255,0.3);border-top:3px solid #fff;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;"></div>';
      document.body.appendChild(el);
    }
    el.style.display = visible ? 'flex' : 'none';
  }

  function showAlert(msg, type = 'info') {
    if (window.appNotify) {
      window.appNotify(msg, type === 'error' ? 'error' : 'success');
    } else {
      if (type === 'error') console.error(msg);
      else console.log(msg);
    }
  }

  const esc = (s) => window.AgriPriceUI ? window.AgriPriceUI.escapeHtml(s) : s;

  function getMyId() {
    try {
      const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || 'null');
      return u?.id || null;
    } catch (_) { return null; }
  }

  function authHeaders() {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  const resolveAssetPath = (p) => window.AgriPriceRouter ? window.AgriPriceRouter.resolveAsset(p) : p;

  // --- Read UID from URL ---
  const params = new URLSearchParams(window.location.search);
  const uid    = params.get('uid') || params.get('id') || params.get('userId');
  const myId   = getMyId();
  const effectiveUid = uid || myId;

  if (!effectiveUid || effectiveUid === 'undefined') {
    window.AgriPriceRouter.navigate('pages/auth/login1.html');
    return;
  }

  const isOwnProfile = effectiveUid === myId;

  // --- State ---
  let profileData = null;
  let isFollowing = false;
  let productCardTemplatePromise = null;

  const normalizeProfileImageUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
    const currentBase = getApiBase();
    if (value.startsWith('/uploads/')) return currentBase ? (currentBase + value) : value;
    
    // If it's a local asset like /assets/images/...
    const normalized = value.replace(/^\/+/, '').replace(/^(\.\.\/)+/, '');
    return '../../' + normalized;
  };

  async function getProductCardTemplate() {
    if (productCardTemplatePromise) return productCardTemplatePromise;
    productCardTemplatePromise = (async () => {
      const candidatePaths = [
        '../../components/product-card/product-card.html',
        '/frontend/components/product-card/product-card.html',
      ];
      for (const path of candidatePaths) {
        try {
          const res = await fetch(path);
          if (!res.ok) continue;
          const html = await res.text();
          const holder = document.createElement('div');
          holder.innerHTML = html;
          const tpl = holder.querySelector('#productCardTpl');
          if (tpl) return tpl;
        } catch (_) { /* try next path */ }
      }
      return null;
    })();
    return productCardTemplatePromise;
  }

  async function getViewerLocation() {
    try {
      const rawUser = localStorage.getItem(window.AUTH_USER_KEY || 'user_data');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const role = (user?.role || '').toLowerCase();

      // Buyer usually has profile coordinates saved.
      if (role === 'buyer' && (user?.lat || user?.latitude)) {
        return {
          lat: parseFloat(user.lat || user.latitude),
          lng: parseFloat(user.lng || user.longitude),
        };
      }

      // Ask browser GPS when available.
      if (window.LocationHelper?.getUserLocation) {
        const loc = await window.LocationHelper.getUserLocation();
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return loc;
      }

      // Fallback to any coordinates on stored user profile.
      if (user && (user?.lat || user?.latitude)) {
        return {
          lat: parseFloat(user.lat || user.latitude),
          lng: parseFloat(user.lng || user.longitude),
        };
      }
    } catch (_) { }
    return null;
  }

  // --- Fetch Logic ---
  async function loadProfile() {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = getApiBase();
    if (!currentBase) return;
    try {
      showLoading(true);
      const productGrid = document.getElementById('productGrid');
      if (productGrid) {
        productGrid.innerHTML = Array(3).fill(0).map(() => `
          <div class="product-mini-card skeleton-card">
            <div style="flex:1;">
              <div class="skeleton" style="height:16px; width:60%; margin-bottom:8px;"></div>
              <div class="skeleton" style="height:12px; width:40%;"></div>
            </div>
          </div>
        `).join('');
      }

      const [pRes, prodRes, statusRes] = await Promise.all([
        fetch(`${currentBase}/api/profiles/${effectiveUid}`, { headers: authHeaders() }),
        fetch(`${currentBase}/api/products?user_id=${effectiveUid}`, { headers: authHeaders() }),
        effectiveUid && myId && !isOwnProfile
          ? fetch(`${currentBase}/api/follow/${effectiveUid}/status`, { headers: authHeaders() })
          : Promise.resolve(null),
      ]);

      if (pRes.ok) {
        const p = await pRes.json();
        profileData = p;
        renderProfile(p);
      }

      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        await renderProducts(prodJson.data || []);
      }

      if (statusRes && statusRes.ok) {
        const statusJson = await statusRes.json();
        // [FIX] อ่านค่าจาก statusJson.data.following ให้ถูกต้องตามรูปแบบ response.success
        isFollowing = (statusJson.data && statusJson.data.following) || false;
        updateFollowBtn();
      }

      showLoading(false);
    } catch (e) {
      showLoading(false);
      showAlert(t('profile_load_error', 'โหลดข้อมูลโปรไฟล์ไม่สำเร็จ'), 'error');
    }
  }

  function renderProfile(p) {
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    document.getElementById('profileName').textContent = name || t('booking_unknown_name', 'ไม่ทราบชื่อ');
    document.getElementById('followersCount').textContent = p.followers_count || 0;
    document.getElementById('followingCount').textContent = p.following_count || 0;
    document.getElementById('aboutDesc').textContent = p.about || t('no_details', 'ไม่มีข้อมูลรายละเอียด');

    const avatar = document.getElementById('profileAvatar');
    const hero = document.getElementById('heroImage');
    
    if (p.avatar) avatar.src = normalizeProfileImageUrl(p.avatar);
    if (p.hero_image) hero.src = normalizeProfileImageUrl(p.hero_image);

    // --- Tab: Contact ---
    const contactList = document.getElementById('contactList');
    let contactHtml = '';
    if (p.phone) contactHtml += `<div class="contact-item-row"><span class="material-icons-outlined">phone</span><a href="tel:${p.phone}">${esc(p.phone)}</a></div>`;
    if (p.email) contactHtml += `<div class="contact-item-row"><span class="material-icons-outlined">email</span><a href="mailto:${p.email}">${esc(p.email)}</a></div>`;
    contactList.innerHTML = contactHtml || `<p style="color:#aaa;padding:20px 0;">${t('no_contact_info', 'ไม่มีข้อมูลติดต่อ')}</p>`;

    // --- Tab: Services ---
    const servicesList = document.getElementById('servicesList');
    const services = Array.isArray(p.services) ? p.services : [];
    if (services.length > 0) {
      servicesList.innerHTML = services.map(s => `
        <div class="service-row">
          <span class="material-icons-outlined">check_circle</span>
          <span>${esc(s.name || s)}</span>
        </div>
      `).join('');
    } else {
      servicesList.innerHTML = `<p style="color:#aaa;padding:20px 0;">${t('no_service_info', 'ไม่มีข้อมูลบริการ')}</p>`;
    }

    // --- Tab: Location ---
    document.getElementById('addressLine1').textContent = p.address_line1 || t('no_address_info', 'ยังไม่ได้ระบุที่อยู่');
    document.getElementById('addressLine2').textContent = p.address_line2 || '';
    const mapIframe = document.getElementById('mapIframe');
    const mapQuery = (p.lat && p.lng) ? `${p.lat},${p.lng}` : (p.map_link || p.address_line1);
    if (mapQuery) {
      mapIframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
      mapIframe.style.display = 'block';
    } else {
      mapIframe.style.display = 'none';
    }
  }

  async function renderProducts(products) {
    const container = document.getElementById('productListContainer');
    const loadMoreBtn = document.getElementById('profileLoadMoreBtn');
    if (!products.length) {
      container.innerHTML = `<p style="color:#aaa;padding:20px 0;text-align:center;">${t('no_purchase_list', 'ยังไม่มีรายการการรับซื้อ')}</p>`;
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const user = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user_data') || '{}');
    const role = (user.role || '').toLowerCase();
    const isFarmer = role === 'farmer';

    const tpl = await getProductCardTemplate();
    if (!tpl) {
      showAlert(t('product_load_error', 'โหลดสินค้าไม่สำเร็จ'), 'error');
      return;
    }

    const formatTime = (d) => window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(d) : d;
    const viewerLoc = await getViewerLocation();
    container.innerHTML = '';
    const cardNodes = [];

    async function startChatToSeller() {
      if (!myId) {
        showAlert(t('login_to_message', 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ'), 'error');
        return;
      }
      try {
        showLoading(true);
        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const currentBase = getApiBase();
        const res = await fetch(`${currentBase}/api/chats/start`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_user_id: effectiveUid }),
        });
        const json = await res.json().catch(() => ({}));
        const roomId = json?.data?.room_id;
        if (json.success && roomId) {
          window.location.href = `chat.html?chatId=${encodeURIComponent(roomId)}&targetId=${encodeURIComponent(effectiveUid)}`;
        } else {
          showAlert(t('start_chat_error', 'ไม่สามารถเริ่มการสนทนาได้'), 'error');
        }
      } catch (e) {
        showAlert(t('error_occurred', 'เกิดข้อผิดพลาด'), 'error');
      } finally {
        showLoading(false);
      }
    }

    products.forEach((p) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.productId = p.product_id || '';
      node.dataset.sellerId = effectiveUid;
      node.dataset.sellerName = `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim();

      const avatar = node.querySelector('[data-bind="avatar"]');
      if (avatar) avatar.src = normalizeProfileImageUrl(profileData?.avatar) || '../../assets/images/avatar-guest.svg';
      const sellerNameEl = node.querySelector('[data-bind="sellerName"]');
      if (sellerNameEl) sellerNameEl.textContent = `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ');
      const sellerSubEl = node.querySelector('[data-bind="sellerSub"]');
      if (sellerSubEl) sellerSubEl.textContent = `${p.name || ''} ${p.variety || ''}`.trim();

      const grades = Array.isArray(p.product_grades) ? p.product_grades : [];
      const pricesByGrade = {};
      grades.forEach((g) => {
        const grade = String(g.grade || '').toUpperCase();
        if (['A', 'B', 'C'].includes(grade)) {
          pricesByGrade[grade] = `${g.price} ${t('unit_baht', 'บ.')}/${p.unit ? t(p.unit, p.unit) : t('kg_unit', 'กก.')}`;
        }
      });
      ['A', 'B', 'C'].forEach((grade) => {
        const el = node.querySelector(`[data-bind="price${grade}"]`);
        if (!el) return;
        if (pricesByGrade[grade]) {
          el.textContent = pricesByGrade[grade];
        } else {
          el.closest('.pc-grade-box, .price-box')?.remove();
        }
      });

      const sellerLat = parseFloat(p.lat ?? profileData?.lat);
      const sellerLng = parseFloat(p.lng ?? profileData?.lng);
      const hasSellerLoc = Number.isFinite(sellerLat) && Number.isFinite(sellerLng);
      const distanceEl = node.querySelector('[data-bind="distance"]');
      if (distanceEl) {
        if (viewerLoc && hasSellerLoc && window.LocationHelper?.calculateDistance) {
          const distKm = window.LocationHelper.calculateDistance(viewerLoc.lat, viewerLoc.lng, sellerLat, sellerLng);
          const distText = window.LocationHelper?.formatDistance
            ? window.LocationHelper.formatDistance(distKm)
            : `${distKm.toFixed(1)} ${t('km', 'กม.')}`;
          distanceEl.textContent = distText;
        } else {
          distanceEl.textContent = `${t('distance', 'ระยะทาง')} - ${t('km', 'กม.')}`;
        }
      }
      const updateTimeEl = node.querySelector('[data-bind="updateTime"]');
      if (updateTimeEl) updateTimeEl.textContent = formatTime(p.updated_at || p.created_at || '');

      const contactBtn = node.querySelector('[data-action="contact"]');
      const bookBtn = node.querySelector('[data-action="book"]');
      if (contactBtn) {
        contactBtn.dataset.action = 'contact-seller';
        contactBtn.textContent = t('nav_chat', 'แชท');
      }
      if (bookBtn) {
        if (isFarmer && !isOwnProfile) {
          bookBtn.dataset.action = 'book-product';
          bookBtn.dataset.productId = p.product_id;
          bookBtn.dataset.productName = `${p.name || ''} ${p.variety || ''}`.trim();
          bookBtn.textContent = t('book_queue', 'จองคิวส่งผลผลิต');
          bookBtn.onclick = (e) => {
            e.stopPropagation();
            const productId = bookBtn.dataset.productId;
            const productName = bookBtn.dataset.productName;
            const sellerId = effectiveUid;
            const sellerName = `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim();

            localStorage.setItem("bookingReferrer", window.location.href);
            localStorage.setItem("bookingFarmerId", sellerId);
            localStorage.setItem("bookingFarmerName", sellerName);
            localStorage.setItem("bookingProductId", productId);
            localStorage.setItem("bookingProductName", productName);

            const navTo = 'pages/farmer/booking/booking-step1.html';
            window.AgriPriceRouter.navigate(navTo);
          };
        } else {
          bookBtn.remove();
        }
      }
      if (!isFarmer || isOwnProfile) {
        contactBtn?.remove();
      } else if (contactBtn) {
        contactBtn.onclick = async (e) => {
          e.stopPropagation();
          await startChatToSeller();
        };
      }

      cardNodes.push(node);
    });

    const PAGE_SIZE = 6;
    let renderedCount = 0;
    const renderNextBatch = () => {
      const nextNodes = cardNodes.slice(renderedCount, renderedCount + PAGE_SIZE);
      nextNodes.forEach((node) => container.appendChild(node));
      renderedCount += nextNodes.length;
      if (loadMoreBtn) {
        loadMoreBtn.style.display = renderedCount < cardNodes.length ? 'flex' : 'none';
      }
      if (typeof window.syncFavoritesUI === 'function') {
        window.syncFavoritesUI();
      }
    };

    if (loadMoreBtn) {
      loadMoreBtn.onclick = renderNextBatch;
    }
    renderNextBatch();
  }

  function updateFollowBtn() {
    const btn = document.getElementById('followBtn');
    if (!btn || isOwnProfile) return;
    
    const label = isFollowing 
      ? t('unfollow', 'เลิกติดตาม') 
      : t('follow', 'ติดตาม');
    const icon = isFollowing ? 'person_remove' : 'person_add';
    
    btn.innerHTML = `<span class="material-icons-outlined">${icon}</span> ${label}`;
    
    // ปรับสไตล์ให้เห็นความแตกต่างชัดเจน
    if (isFollowing) {
      btn.style.setProperty('background-color', 'var(--surface-color, #f3f4f6)', 'important');
      btn.style.setProperty('color', 'var(--text-secondary, #6b7280)', 'important');
      btn.style.setProperty('border', '1px solid #d1d5db', 'important');
    } else {
      btn.style.removeProperty('background-color');
      btn.style.removeProperty('color');
      btn.style.removeProperty('border');
    }
  }

  // --- Actions ---
  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    if (isOwnProfile) {
      followBtn.style.display = 'none';
    } else {
      followBtn.onclick = async () => {
        if (!myId) { showAlert(t('login_to_follow', 'กรุณาเข้าสู่ระบบก่อนติดตาม'), 'error'); return; }
        try {
          if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
          const currentBase = getApiBase();
          const method = isFollowing ? 'DELETE' : 'POST';
          const res = await fetch(`${currentBase}/api/follow/${effectiveUid}`, {
            method,
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const result = await res.json();
            isFollowing = !isFollowing;
            updateFollowBtn();
            // Refresh followers count
            const pRes = await fetch(`${currentBase}/api/profiles/${effectiveUid}`, { headers: authHeaders() });
            if (pRes.ok) {
              const p = await pRes.json();
              document.getElementById('followersCount').textContent = p.followers_count;
            }
            // แสดงข้อความสำเร็จแบบปกติ
            showAlert(isFollowing ? t('followed_success', 'ติดตามแล้ว') : t('unfollowed_success', 'เลิกติดตามแล้ว'), 'success');
          } else {
            const err = await res.json();
            showAlert(err.message || 'Error', 'error');
          }
        } catch (e) { 
          showAlert(t('error_occurred', 'เกิดข้อผิดพลาด'), 'error'); 
        }
      };
    }
  }

  const contactBtn = document.getElementById('contactBtn');
  if (contactBtn) {
    if (isOwnProfile) {
      contactBtn.style.display = 'none';
    } else {
      contactBtn.onclick = async () => {
        if (!myId) { showAlert(t('login_to_message', 'กรุณาเข้าสู่ระบบก่อนส่งข้อความ'), 'error'); return; }
        try {
          showLoading(true);
          if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
          const currentBase = getApiBase();
          const res = await fetch(`${currentBase}/api/chats/start`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: effectiveUid }),
          });
          const json = await res.json();
          if (json.success && json.data.room_id) {
            window.location.href = `chat.html?chatId=${encodeURIComponent(json.data.room_id)}&targetId=${encodeURIComponent(effectiveUid)}`;
          } else {
            showAlert(t('start_chat_error', 'ไม่สามารถเริ่มการสนทนาได้'), 'error');
          }
        } catch (e) { showAlert(t('error_occurred', 'เกิดข้อผิดพลาด'), 'error'); }
        finally { showLoading(false); }
      };
    }
  }

  // --- Initialize ---
  document.addEventListener('DOMContentLoaded', () => {
    loadProfile();

    // [Pull-to-Refresh] Connect to global-anim utility
    if (window.initPullToRefresh) {
      window.initPullToRefresh(async () => {
        await loadProfile();
      });
    }
  });

})();
