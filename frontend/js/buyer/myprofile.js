document.addEventListener("DOMContentLoaded", function () {

    // โ”€โ”€ Login Guard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    if (window.AuthGuard && typeof AuthGuard.requireLogin === 'function') {
        AuthGuard.requireLogin();
    }
    // โ”€โ”€ API helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const _API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const _TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  function _authH(json) {
    const t = localStorage.getItem(_TOKEN_KEY) || '';
    const h = t ? { 'Authorization': 'Bearer ' + t } : {};
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'เพิ่งอัปเดต';
    if (diff < 60) return `อัปเดต ${diff} นาที`;
    if (diff < 1440) return `อัปเดต ${Math.floor(diff / 60)} ชั่วโมง`;
    return `อัปเดต ${Math.floor(diff / 1440)} วัน`;
  }
        function resolveAssetPath(p) {
                const path = (window.location.pathname || '').replace(/\\/g, '/');
                const dir = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
                const idx = dir.lastIndexOf('/pages/');
                if (idx === -1) return String(p || '').replace(/^\/+/, '');
                const afterPages = dir.substring(idx + '/pages/'.length);
                const depth = afterPages.split('/').filter(Boolean).length;
                return '../' + '../'.repeat(depth) + String(p || '').replace(/^\/+/, '');
        }
    function normalizeProfileImageUrl(raw) {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
        if (value.startsWith('/uploads/')) return _API_BASE ? (_API_BASE + value) : value;
        if (value.startsWith('/assets/')) return resolveAssetPath(value.replace(/^\//, ''));
        if (value.startsWith('assets/')) return resolveAssetPath(value);
        return value;
    }
  async function loadProfileFromApi() {
        if (!_API_BASE) return null;
        try {
            showLoading(true);
            const res = await fetch(_API_BASE + '/api/profile', { headers: _authH() });
            showLoading(false);
            if (!res.ok) {
                showAlert('โหลดข้อมูลโปรไฟล์ล้มเหลว', 'error');
                return null;
            }
            return await res.json();
        } catch (_) {
            showLoading(false);
            showAlert('เกิดข้อผิดพลาดขณะโหลดโปรไฟล์', 'error');
            return null;
        }
    }
  async function saveProfileToApi(fields) {
    if (!_API_BASE) return false;
    try {
      const res = await fetch(_API_BASE + '/api/profile', {
        method: 'PATCH', headers: _authH(true), body: JSON.stringify(fields),
      });
      return res.ok;
    } catch (_) { return false; }
  }
  async function uploadAvatarToApi(file) {
    const token = localStorage.getItem(_TOKEN_KEY) || '';
    if (!token || !_API_BASE) return false;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      const res = await fetch(_API_BASE + '/api/profile', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      return res.ok;
    } catch (_) { return false; }
  }
  async function uploadHeroToApi(file) {
    const token = localStorage.getItem(_TOKEN_KEY) || '';
    if (!token || !_API_BASE) return false;
    const formData = new FormData();
    formData.append('hero_image', file);
    try {
      const res = await fetch(_API_BASE + '/api/profile', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      return res.ok;
    } catch (_) { return false; }
  }
  // โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€


    const role = String(localStorage.getItem('role') || 'buyer').toLowerCase();
    const PROFILE_KEY = `myprofile_data_${role}`;
    const AVATAR_KEY = `profile_avatar_dataurl_${role}`;
    const profileKeys = role === 'buyer' ? [PROFILE_KEY, 'myprofile_data'] : [PROFILE_KEY];
    const avatarKeys = role === 'buyer' ? [AVATAR_KEY, 'profile_avatar_dataurl'] : [AVATAR_KEY];

    function loadProfileFromStorage() {
        for (const key of profileKeys) {
            try {
                const saved = localStorage.getItem(key);
                if (saved) return JSON.parse(saved);
            } catch (e) {}
        }
        return null;
    }

    function saveProfileToStorage(data) {
        try {
            const raw = JSON.stringify(data);
            profileKeys.forEach((key) => localStorage.setItem(key, raw));
            // sync ไป API ด้วย
            try {
              const p = JSON.parse(raw);
              saveProfileToApi({
                first_name: (p.name || '').split(' ')[0] || p.name || '',
                last_name:  (p.name || '').split(' ').slice(1).join(' ') || '',
                tagline:    p.tagline || '',
                about:      p.about   || '',
                address_line1: p.address || '',
              });
            } catch (_) {}
        } catch (e) { console.error('Failed to save profile data', e); }
    }

    function loadAvatarFromStorage() {
        for (const key of avatarKeys) {
            try {
                const saved = localStorage.getItem(key);
                if (saved) return saved;
            } catch (e) {}
        }
        return null;
    }

    function saveAvatarToStorage(dataUrl) {
        avatarKeys.forEach((key) => localStorage.setItem(key, dataUrl));
    }

    // โหลดข้อมูลจาก API - ไม่มี mock data
    let profileData = {
        name: '',
        tagline: '',
        followers: 0,
        heroImage: '',
        avatar: '',
        about: '',
        phone: '',
        email: '',
        location: { line1: '', line2: '', mapEmbed: '', mapLink: '', lat: '', lng: '' },
        services: [],

        products: [],
        reviews: [],
        profile_id: '',
    };

    // โหลดจาก API ก่อน (ถ้ามี) แล้วค่อย fallback localStorage
    loadProfileFromApi().then(async apiData => {
      if (apiData) {
        const name = `${apiData.first_name || ''} ${apiData.last_name || ''}`.trim();
                profileData = Object.assign({}, profileData, {
                    name: name || profileData.name,
                    tagline: apiData.tagline || profileData.tagline,
                    about: apiData.about || profileData.about,
                    phone: apiData.phone || profileData.phone,
                    avatar: normalizeProfileImageUrl(apiData.avatar),
                    heroImage: normalizeProfileImageUrl(apiData.hero_image),
                    profile_id: apiData.profile_id || apiData.id || '',
                });
        const merged = {
          name:    name || '',
          tagline: apiData.tagline || '',
          about:   apiData.about   || '',
          address: apiData.address_line1 || '',
          phone:   apiData.phone   || '',
        };
        // บันทึกลง localStorage เพื่อ fallback
        const role = String(localStorage.getItem('role') || 'buyer').toLowerCase();
        const PROFILE_KEY = `myprofile_data_${role}`;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
        // render ชื่อ
        const nameEl = document.getElementById('profileName') || document.querySelector('.profile-name');
        if (nameEl && name) nameEl.textContent = name;
        if (apiData.avatar) {
          const avatarEl = document.querySelector('.profile-avatar img') || document.getElementById('profileAvatar');
                    if (avatarEl) avatarEl.src = normalizeProfileImageUrl(apiData.avatar);
        }

        // โหลดสินค้า (products) จาก API
                let productPage = 1;
                let productLimit = 20;
                let productHasMore = true;
                async function loadProductsPage(page = 1) {
                    if (!_API_BASE || !(apiData.profile_id || apiData.id)) return;
                    try {
                        showLoading(true);
                        const pRes = await fetch(`${_API_BASE}/api/products?user_id=${apiData.profile_id || apiData.id}&limit=${productLimit}&page=${page}`, { headers: _authH() });
                        showLoading(false);
                        if (pRes.ok) {
                            const pJson = await pRes.json();
                            const apiProducts = (pJson.data || []).map(p => {
                                const gradesArr = Array.isArray(p.product_grades) ? p.product_grades : [];
                                const prices = {};
                                if (gradesArr.length > 0) {
                                    gradesArr.forEach(g => { prices[g.grade] = g.price; });
                                } else if (p.grade && p.price) {
                                    prices[p.grade] = p.price;
                                } else {
                                    prices['A'] = p.price || 0;
                                }
                                return {
                                    fruit:     p.name      || '',
                                    variety:   p.variety   || '',
                                    prices,
                                    unit:      p.unit      || 'กก.',
                                    _id:       p.product_id,
                                    is_active: p.is_active !== false,
                                    distance:  '',
                                    update:    formatTimeAgo(p.updated_at || p.created_at),
                                };
                            });
                            if (page === 1) profileData.products = apiProducts;
                            else profileData.products = (profileData.products || []).concat(apiProducts);
                            productHasMore = apiProducts.length === productLimit;
                            // re-render product section
                            const productContainer = document.getElementById('productListContainer');
                            if (productContainer && typeof renderProductsTo === 'function') renderProductsTo(productContainer);
                            // show/hide load more button
                            let loadMoreBtn = document.getElementById('loadMoreProductsBtn');
                            if (!loadMoreBtn) {
                                loadMoreBtn = document.createElement('button');
                                loadMoreBtn.id = 'loadMoreProductsBtn';
                                loadMoreBtn.className = 'btn btn-load-more';
                                loadMoreBtn.textContent = 'ดูสินค้าต่อ';
                                productContainer.parentNode.appendChild(loadMoreBtn);
                            }
                            loadMoreBtn.style.display = productHasMore ? 'block' : 'none';
                            loadMoreBtn.onclick = function() {
                                if (productHasMore) {
                                    productPage++;
                                    loadProductsPage(productPage);
                                }
                            };
                        }
                    } catch (e) {
                        console.error('Failed to load products:', e);
                        showLoading(false);
                        showAlert('โหลดสินค้าไม่สำเร็จ', 'error');
                    }
                }
                loadProductsPage(1);

                // (ลบ fetch reviews ออกตามคำขอ)
      }
    }).catch(() => {});

    // load saved profile from localStorage
    try {
        const parsed = loadProfileFromStorage();
        if (parsed) {
            profileData = Object.assign({}, profileData, parsed);
        }
    } catch (e) { console.error('Failed to load saved profile', e); }

     /* ==========================================================
         RENDER PROFILE INFO
         ========================================================== */
    const profileNameEl = document.getElementById("profileName");
    const profileTaglineEl = document.getElementById("profileTagline");
    const followersCountEl = document.getElementById("followersCount");
    const heroImageEl = document.getElementById("heroImage");
    const fallbackHeroImage = '../../assets/images/hero.png';
    const fallbackAvatarImage = '../../assets/images/avatar-buyer.svg';

    function normalizeUnitLabel(unit) {
        const value = String(unit || '').trim();
        if (!value) return 'กก.';
        if (/[เธโ�]/.test(value)) return 'กก.';
        return value;
    }

    function setImageWithFallback(img, src, fallback) {
        if (!img) return;
        const normalizedSrc = normalizeProfileImageUrl(src);
        const normalizedFallback = normalizeProfileImageUrl(fallback) || fallback;
        img.onerror = function () {
            this.onerror = null;
            this.src = normalizedFallback;
        };
        img.src = normalizedSrc || normalizedFallback;
    }

    if (profileNameEl) profileNameEl.textContent = profileData.name || '-';
    if (profileTaglineEl) profileTaglineEl.textContent = profileData.tagline || '-';
    if (followersCountEl) followersCountEl.textContent = profileData.followers || '0';
    setImageWithFallback(heroImageEl, profileData.heroImage, fallbackHeroImage);
    
    // โหลดรูป avatar จาก localStorage ก่อน (sync กับ account)
    try {
        const savedAvatar = loadAvatarFromStorage();
        if (savedAvatar && !savedAvatar.includes('assets/images')) {
            profileData.avatar = savedAvatar;
        }
    } catch (_) {}
    
    const profileAvatarEl = document.getElementById("profileAvatar");
    setImageWithFallback(profileAvatarEl, profileData.avatar, fallbackAvatarImage);
    document.getElementById("aboutDesc").textContent = profileData.about;
    const aboutDescEl = document.getElementById("aboutDesc");
    if (aboutDescEl) aboutDescEl.textContent = profileData.about || '-';

    function syncLiveImageState() {
        const nextAvatar = loadAvatarFromStorage();
        if (nextAvatar && !nextAvatar.includes('assets/images')) {
            profileData.avatar = nextAvatar;
        }
        if (profileAvatarEl) setImageWithFallback(profileAvatarEl, profileData.avatar, fallbackAvatarImage);
        if (heroImageEl) setImageWithFallback(heroImageEl, profileData.heroImage, fallbackHeroImage);
        if (profileNameEl) profileNameEl.textContent = profileData.name || '-';
        if (profileTaglineEl) profileTaglineEl.textContent = profileData.tagline || '-';
        if (followersCountEl) followersCountEl.textContent = profileData.followers || '0';
    }

    let liveProfileTimer = null;
    function startLiveProfileSync() {
        if (liveProfileTimer) return;
        liveProfileTimer = setInterval(() => {
            if (document.hidden) return;
            syncLiveImageState();
        }, 15000);
    }

    function stopLiveProfileSync() {
        if (!liveProfileTimer) return;
        clearInterval(liveProfileTimer);
        liveProfileTimer = null;
    }

    window.addEventListener('storage', (e) => {
        if (avatarKeys.includes(e.key) || profileKeys.includes(e.key)) {
            syncLiveImageState();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLiveProfileSync();
        else {
            syncLiveImageState();
            startLiveProfileSync();
        }
    });

    window.addEventListener('focus', () => {
        syncLiveImageState();
    });

    startLiveProfileSync();

    // Change button label to match image
    const editAboutBtnEl = document.getElementById('editAboutBtn');
    if (editAboutBtnEl) {
        editAboutBtnEl.innerHTML = `<span class="material-icons-outlined">edit</span> แก้ไขโปรไฟล์`;
    }
    const addPurchaseBtnEl = document.getElementById('addPurchaseBtn');
    if (addPurchaseBtnEl) {
        addPurchaseBtnEl.innerHTML = `<span class="material-icons-outlined">add_circle</span> + เพิ่มการรับซื้อ`;
    }


    // Render contact info
    function renderContact() {
        const contactPhoneEl = document.getElementById('contactPhone');
        const contactEmailEl = document.getElementById('contactEmail');
        const contactLinksEl = document.getElementById('contactLinks');
        // Replace plain text with styled contact items
        const aboutContact = document.getElementById('aboutContact');
        if (!aboutContact) return;

        // Build fresh contact items
        aboutContact.innerHTML = '';

        if (profileData.phone) {
            aboutContact.innerHTML += `
                <div class="contact-item">
                    <span class="material-icons-outlined">phone</span>
                    <div class="contact-phone">${profileData.phone}</div>
                </div>`;
        }
        if (profileData.email) {
            aboutContact.innerHTML += `
                <div class="contact-item">
                    <span class="material-icons-outlined">email</span>
                    <div class="contact-email">${profileData.email}</div>
                </div>`;
        }
        if (profileData.links && profileData.links.length) {
            profileData.links.forEach(l => {
                aboutContact.innerHTML += `
                    <div class="contact-item">
                        <span class="material-icons-outlined">language</span>
                        <a href="${l}" target="_blank" rel="noopener" style="color:#222;text-decoration:none;font-size:14px;">${l}</a>
                    </div>`;
            });
        }
    }
    renderContact();

    document.getElementById("addressLine1").textContent = profileData.location.line1;
    const addressLine1El = document.getElementById("addressLine1");
    const addressLine2El = document.getElementById("addressLine2");
    const mapIframeEl = document.getElementById("mapIframe");
    const mapLinkEl = document.getElementById("mapLink");
    if (addressLine1El) addressLine1El.textContent = profileData.location?.line1 || '-';
    if (addressLine2El) addressLine2El.textContent = profileData.location?.line2 || '-';
    if (mapIframeEl) mapIframeEl.src = profileData.location?.mapEmbed || '';
    if (mapLinkEl) mapLinkEl.href = profileData.location?.mapLink || '#';

    function saveProfileData() {
        saveProfileToStorage(profileData);
    }

     /* ==========================================================
         RENDER SERVICES (inject after location-card)
         ========================================================== */
    function renderServices() {
        // Remove old services if any
        const old = document.getElementById('servicesSection');
        if (old) old.remove();

        const section = document.createElement('div');
        section.id = 'servicesSection';
        section.innerHTML = `
            <div class="services-title">บริการ</div>
            <div class="service-list">
                ${(profileData.services || []).map(s => `
                    <div class="service-item">
                        <div class="service-icon ${s.color}">
                            <span class="material-icons-outlined">${s.icon}</span>
                        </div>
                        <div class="service-name">${s.name}</div>
                        <div class="service-desc">${s.desc}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Insert before product list
        const productListContainer = document.getElementById('productListContainer');
        const productTitle = document.querySelector('.products-list-title');
        const tabAbout = document.getElementById('tab-about');
        if (tabAbout) {
            if (productTitle) {
                tabAbout.insertBefore(section, productTitle);
            } else if (productListContainer) {
                tabAbout.insertBefore(section, productListContainer);
            } else {
                tabAbout.appendChild(section);
            }
        }
    }
    renderServices();

     function showEmptyState(container, msg) {
        if (!container) return;
        container.innerHTML = `<div class="empty-state" style="padding:20px; text-align:center; color:#666; font-size:14px;">${msg}</div>`;
     }
     function hideEmptyState(container) {
        // Handled by container.innerHTML = ""
     }

     /* ==========================================================
         RENDER PRODUCTS
         ========================================================== */
    const productContainer = document.getElementById("productListContainer");

    function renderProductsTo(container) {
        if (!container) return;
        container.innerHTML = "";
        if (!profileData.products || !profileData.products.length) {
            showEmptyState(container, 'ยังไม่มีสินค้าที่รับซื้อ');
            return;
        }
        hideEmptyState(container);
        profileData.products.forEach((product, idx) => {
            const card = document.createElement("div");
            card.className = "product-card";
            const isOpen = product.is_active !== false;
            card.dataset.isOpen = isOpen ? "true" : "false";
            card.dataset.index = String(idx);
            card.dataset.productId = String(product._id || '');
            // ดึง ID จากข้อมูล profileData
            const currentUid = profileData.profile_id || localStorage.getItem('userId') || '';
            card.dataset.sellerId = String(currentUid);
            card.dataset.sellerName = profileData.name || '';
            card.innerHTML = `
                    <div class="seller-info" style="cursor:default">
                        <div class="seller-avatar">
                            <img src="${profileData.avatar || fallbackAvatarImage}" onerror="this.onerror=null;this.src='${fallbackAvatarImage}';">
                        </div>
                        <div class="seller-text">
                            <div class="seller-name">${profileData.name || '-'}</div>
                            <div class="seller-sub">${product.fruit || '-'}${product.variety ? ` (${product.variety})` : ''}</div>
                        </div>
                        <div style="margin-left:auto;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${isOpen ? '#dcfce7' : '#fee2e2'};color:${isOpen ? '#16a34a' : '#dc2626'};">
                            ${isOpen ? 'เปิดรับซื้อ' : 'ปิดรับซื้อ'}
                        </div>
                    </div>
                <div class="price-row">
                    ${Object.keys(product.prices || {}).filter(g => product.prices[g]).map(g =>
                        `<div class="price-box">
                            <div class="grade">${g}</div>
                            <div class="price">${product.prices[g]} บ./${normalizeUnitLabel(product.unit)}</div>
                        </div>`
                    ).join("")}
                </div>
                <div class="meta-row">
                    <div class="distance">ระยะทาง ${product.distance || '-'}</div>
                    <div class="update-time">${product.update || '-'}</div>
                </div>
                <div class="action-row">
                    <button class="btn-contact" type="button" data-action="toggle-status">
                        <span class="status-text">${isOpen ? 'เปิดรับซื้อ' : 'ปิดรับซื้อ'}</span>
                    </button>
                    <button class="btn-book" type="button" data-action="edit-purchase">แก้ไขการรับซื้อ</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderProductsTo(productContainer);

     /* ==========================================================
         ELEMENTS
         ========================================================== */
    const editCoverBtn = document.getElementById('editCoverBtn');
    const coverInput = document.getElementById('coverInput');
    const editAvatarBtn = document.getElementById('editAvatarBtn');
    const avatarInput = document.getElementById('avatarInput');
    const editProfileCardBtn = document.getElementById('editProfileCardBtn');
    const editAboutModal = document.getElementById('editAboutModal');
    const nameEditor = document.getElementById('nameEditor');
    const taglineEditor = document.getElementById('taglineEditor');
    const aboutEditor = document.getElementById('aboutEditor');
    const phoneEditor = document.getElementById('phoneEditor');
    const emailEditor = document.getElementById('emailEditor');
    const addr2Editor = document.getElementById('addr2Editor');
    const openMapPickerBtn = document.getElementById('openMapPickerBtn');
    const mapPickerContainer = document.getElementById('mapPickerContainer');
    const mapLatEditor = document.getElementById('mapLatEditor');
    const mapLngEditor = document.getElementById('mapLngEditor');
    const mapPickerStatusText = document.getElementById('mapPickerStatusText');
    let pickerMap = null;
    let pickerMarker = null;

    const saveAboutBtn = document.getElementById('saveAboutBtn');
    const cancelAboutBtn = document.getElementById('cancelAboutBtn');

    // Close modal
    if (editAboutModal) {
        const backdrop = editAboutModal.querySelector('.modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', () => { editAboutModal.hidden = true; });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !editAboutModal.hidden) editAboutModal.hidden = true;
        });
    }

     /* ==========================================================
         PRODUCT CARD ACTIONS
         ========================================================== */
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const card = btn.closest(".product-card");
        if (!card) return;
        const action = btn.dataset.action;

        if (action === "toggle-status") {
            const isOpen = card.dataset.isOpen !== "false";
            const newState = !isOpen;
            const productId = card.dataset.productId || '';

            // อัปเดต UI ทันที
            card.dataset.isOpen = String(newState);
            const statusText = card.querySelector(".status-text");
            if (statusText) statusText.textContent = newState ? "ปิด การรับซื้อ" : "เปิด การรับซื้อ";
            // อัปเดต badge สี
            const badge = card.querySelector('.seller-info > div[style*="border-radius"]');
            if (badge) {
                badge.style.background = newState ? '#dcfce7' : '#fee2e2';
                badge.style.color = newState ? '#16a34a' : '#dc2626';
                badge.textContent = newState ? '● เปิดรับซื้อ' : '○ ปิดรับซื้อ';
            }

            // ส่ง API
            if (productId && _API_BASE) {
                const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
                fetch(`${_API_BASE}/api/products/${productId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ is_active: newState }),
                }).catch(() => {
                    // rollback ถ้า API ล้มเหลว
                    card.dataset.isOpen = String(isOpen);
                    if (statusText) statusText.textContent = isOpen ? "เปิดรับซื้อ" : "ปิดรับซื้อ";
                });
            }
            return;
        }

        if (action === "edit-purchase") {
            const idx = Number(card.dataset.index);
            const product = profileData.products[idx];
            if (!product) {
                const nextUrl = "setbooking/setbooking-step1.html";
                if (window.navigateWithTransition) window.navigateWithTransition(nextUrl); else window.location.href = nextUrl;
                return;
            }
            
            // Prepare grades in the format expected by step1
            const gradesArr = Object.entries(product.prices || {}).map(([grade, price]) => ({ grade, price }));
            
            const payload = {
                product: { 
                    id: product._id, // Real database product_id
                    name: product.fruit 
                },
                variety: product.variety ? { name: product.variety } : null,
                details: product.description || "",
                grades: gradesArr,
                createdAt: new Date().toISOString(),
                editSource: { 
                    page: "myprofile", 
                    index: idx,
                    isEdit: true, // Flag to indicate we are editing
                    product_id: product._id 
                }
            };
            
            try { 
                sessionStorage.setItem("setbooking_step1", JSON.stringify(payload)); 
            } catch (err) {
                console.error("Failed to save step1 payload for editing", err);
            }
            
            const nextUrl = "setbooking/setbooking-step1.html";
            if (window.navigateWithTransition) window.navigateWithTransition(nextUrl); else window.location.href = nextUrl;
        }
    });

     /* ==========================================================
         ACTION ROW BUTTONS
         ========================================================== */
    const editAboutBtn = document.getElementById("editAboutBtn");
    const addPurchaseBtn = document.getElementById("addPurchaseBtn");
    const tabButtons = document.querySelectorAll('.profile-tabs .tab-btn');

    function openEditModal() {
        if (nameEditor) nameEditor.value = profileData.name || '';
        if (taglineEditor) taglineEditor.value = profileData.tagline || '';
        aboutEditor.value = profileData.about || '';
        phoneEditor.value = profileData.phone || '';
        emailEditor.value = profileData.email || '';
        addr1Editor.value = profileData.location?.line1 || '';
        addr2Editor.value = profileData.location?.line2 || '';
        mapLatEditor.value = profileData.location?.lat || '';
        mapLngEditor.value = profileData.location?.lng || '';
        
        if (mapLatEditor.value && mapLngEditor.value) {
            mapPickerStatusText.textContent = "ปักหมุดแล้ว (" + parseFloat(mapLatEditor.value).toFixed(4) + ", " + parseFloat(mapLngEditor.value).toFixed(4) + ")";
        } else {
            mapPickerStatusText.textContent = "เลือกตำแหน่งบนแผนที่...";
        }
        
        editAboutModal.hidden = false;
        mapPickerContainer.style.display = 'none';

    }

    if (editAboutBtn) editAboutBtn.addEventListener("click", openEditModal);
    if (editProfileCardBtn) editProfileCardBtn.addEventListener('click', openEditModal);
    
    if (openMapPickerBtn) {
        openMapPickerBtn.addEventListener('click', () => {
            if (mapPickerContainer.style.display === 'none') {
                mapPickerContainer.style.display = 'block';
                if (!pickerMap) {
                    const defaultLat = mapLatEditor.value || 13.7563;
                    const defaultLng = mapLngEditor.value || 100.5018;
                    pickerMap = L.map('leafletMapDiv').setView([defaultLat, defaultLng], 13);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap'
                    }).addTo(pickerMap);
                    
                    if (mapLatEditor.value) {
                        pickerMarker = L.marker([defaultLat, defaultLng]).addTo(pickerMap);
                    }
                    
                    pickerMap.on('click', function(e) {
                        if (!pickerMarker) {
                            pickerMarker = L.marker(e.latlng).addTo(pickerMap);
                        } else {
                            pickerMarker.setLatLng(e.latlng);
                        }
                        mapLatEditor.value = e.latlng.lat;
                        mapLngEditor.value = e.latlng.lng;
                        mapPickerStatusText.textContent = "ปักหมุดแล้ว (" + e.latlng.lat.toFixed(4) + ", " + e.latlng.lng.toFixed(4) + ")";
                    });
                }
                setTimeout(() => pickerMap.invalidateSize(), 200);
            } else {
                mapPickerContainer.style.display = 'none';
            }
        });
        
        const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');
        if (getCurrentLocationBtn) {
            getCurrentLocationBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    return showAlert('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง', 'error');
                }
                const oldText = getCurrentLocationBtn.innerHTML;
                getCurrentLocationBtn.innerHTML = '<span class="material-icons-outlined">hourglass_empty</span> กำลังค้นหาตำแหน่ง...';
                getCurrentLocationBtn.disabled = true;
                
                navigator.geolocation.getCurrentPosition((position) => {
                    getCurrentLocationBtn.innerHTML = oldText;
                    getCurrentLocationBtn.disabled = false;
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    if (pickerMap) {
                        pickerMap.setView([lat, lng], 15);
                        if (!pickerMarker) {
                            pickerMarker = L.marker([lat, lng]).addTo(pickerMap);
                        } else {
                            pickerMarker.setLatLng([lat, lng]);
                        }
                    }
                    mapLatEditor.value = lat;
                    mapLngEditor.value = lng;
                    mapPickerStatusText.textContent = "ปักหมุดแล้ว (" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")";
                }, (err) => {
                    getCurrentLocationBtn.innerHTML = oldText;
                    getCurrentLocationBtn.disabled = false;
                    showAlert('ไม่สามารถดึงตำแหน่งได้ โปรดอนุญาตการเข้าถึงตำแหน่งก่อน', 'error');
                }, { enableHighAccuracy: true });
            });
        }
    }

    if (addPurchaseBtn) addPurchaseBtn.addEventListener("click", () => {
        if (window.navigateWithTransition) window.navigateWithTransition("setbooking/setbooking-step1.html"); else window.location.href = "setbooking/setbooking-step1.html";
    });

    // Tabs
    if (tabButtons && tabButtons.length) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                const panel = document.getElementById(`tab-${tab}`);
                if (panel) panel.classList.add('active');
                const cardTop = document.querySelector('.profile-info-card');
                if (cardTop) window.scrollTo({ top: cardTop.offsetTop, behavior: 'smooth' });
            });
        });
    }

    // Cover upload
    if (editCoverBtn && coverInput) {
        editCoverBtn.addEventListener('click', () => coverInput.click());
        coverInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
                if (window.appNotify) window.appNotify('รูปปกใหญ่เกินไป (เกิน 5MB)', 'error');
                coverInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                profileData.heroImage = reader.result;
                document.getElementById('heroImage').src = reader.result;
                saveProfileData();
            };
            reader.readAsDataURL(f);
            coverInput.value = '';
        });
    }

    // Avatar upload
    if (editAvatarBtn && avatarInput) {
        editAvatarBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            if (f.size > 3 * 1024 * 1024) {
                if (window.appNotify) window.appNotify('รูปใหญ่เกินไป (เกิน 3MB)', 'error');
                avatarInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                profileData.avatar = dataUrl;
                document.getElementById('profileAvatar').src = dataUrl;
                
                // บันทึกใน localStorage key เดียวกับ account
                saveAvatarToStorage(dataUrl);
                saveProfileData();
            };
            reader.readAsDataURL(f);
            avatarInput.value = '';
        });
    }

    // Modal actions
    if (cancelAboutBtn) cancelAboutBtn.addEventListener('click', () => { editAboutModal.hidden = true; });
    if (saveAboutBtn) saveAboutBtn.addEventListener('click', () => {
        // Validate required fields
        if (!nameEditor.value.trim()) {
            showAlert('กรุณากรอกชื่อโปรไฟล์', 'error');
            nameEditor.focus();
            return;
        }
        if (!taglineEditor.value.trim()) {
            showAlert('กรุณากรอกคำอธิบายสั้น', 'error');
            taglineEditor.focus();
            return;
        }
        // บันทึกชื่อและ tagline
        profileData.name = nameEditor.value.trim();
        profileData.tagline = taglineEditor.value.trim();
        profileData.about = aboutEditor.value || '';
        profileData.phone = phoneEditor.value || '';
        profileData.email = emailEditor.value || '';
        profileData.location = profileData.location || {};
        profileData.location.line1 = addr1Editor.value || '';
        profileData.location.line2 = addr2Editor.value || '';
        
        // Use Lat/Lng if picked, else fallback to address
        const pickedLat = mapLatEditor.value;
        const pickedLng = mapLngEditor.value;
        profileData.location.lat = pickedLat;
        profileData.location.lng = pickedLng;
        
        let finalEmbed = '';
        let finalLink = '';
        if (pickedLat && pickedLng) {
            finalEmbed = `https://maps.google.com/maps?q=${pickedLat},${pickedLng}&z=15&output=embed`;
            finalLink = `https://maps.google.com/?q=${pickedLat},${pickedLng}`;
        } else {
            const fullAddr = [profileData.location.line1, profileData.location.line2].filter(Boolean).join(' ');
            const mapQ = fullAddr || profileData.name || '';
            if (mapQ) {
                finalEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&z=13&output=embed`;
                finalLink =  `https://maps.google.com/?q=${encodeURIComponent(mapQ)}`;
            }
        }
        profileData.location.mapEmbed = finalEmbed;
        profileData.location.mapLink = finalLink;
        profileData.links = [];

        // อัปเดตชื่อและ tagline บนหน้า
        if (profileNameEl) profileNameEl.textContent = profileData.name;
        if (profileTaglineEl) profileTaglineEl.textContent = profileData.tagline;
        if (aboutDescEl) aboutDescEl.textContent = profileData.about;
        if (addressLine1El) addressLine1El.textContent = profileData.location.line1 || '';
        if (addressLine2El) addressLine2El.textContent = profileData.location.line2 || '';
        if (mapLinkEl) mapLinkEl.href = profileData.location.mapLink || '';
        if (mapIframeEl) mapIframeEl.src = profileData.location.mapEmbed || profileData.location.mapLink || '';
        renderContact();
        saveProfileData();
        showAlert('บันทึกโปรไฟล์สำเร็จ', 'success');
        editAboutModal.hidden = true;
    });

     /* ==========================================================
         APPLY SAVED BOOKING PAYLOAD
         ========================================================== */
    (function applySavedPayload() {
        try {
            const raw = sessionStorage.getItem("setbooking_payload");
            if (!raw) return;
            const payload = JSON.parse(raw);
            const step1 = payload && payload.step1;
            if (!step1 || !step1.editSource || step1.editSource.page !== "myprofile") return;
            const idx = Number(step1.editSource.index);
            if (!Number.isFinite(idx) || idx < 0 || idx >= profileData.products.length) return;
            const target = profileData.products[idx];
            const prodName = (step1.product && step1.product.name) || target.fruit;
            const varietyName = (step1.variety && step1.variety.name) ? ` ${step1.variety.name}` : "";
            target.fruit = (prodName + varietyName).trim();
            const prices = {};
            if (Array.isArray(step1.grades)) {
                step1.grades.forEach(g => { if (g && g.grade) prices[String(g.grade)] = Number(g.price) || 0; });
            }
            if (Object.keys(prices).length) target.prices = prices;
            target.update = "เมื่อสักครู่";
            renderProductsTo(productContainer);
            try {
                sessionStorage.removeItem("setbooking_payload");
                sessionStorage.removeItem("setbooking_step1");
            } catch (e) {}
        } catch (err) { console.error("Failed to apply saved booking payload", err); }
    })();
});
