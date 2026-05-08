document.addEventListener("DOMContentLoaded", function () {

    // โ”€โ”€ Login Guard โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    if (window.AuthGuard && typeof AuthGuard.requireLogin === 'function') {
        AuthGuard.requireLogin();
    }
    // โ”€โ”€ API helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const _API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    const _TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
    function _authH(json) {
        const t = localStorage.getItem(_TOKEN_KEY) || '';
        const h = t ? { 'Authorization': 'Bearer ' + t } : {};
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }

    // ป้องกัน XSS: escape ข้อความจาก server ก่อน inject ลง innerHTML เสมอ
    const esc = (s) => window.AgriPriceUI ? window.AgriPriceUI.escapeHtml(s) : s;


    const resolveAssetPath = (p) => window.AgriPriceRouter ? window.AgriPriceRouter.resolveAsset(p) : p;
    function normalizeProfileImageUrl(raw) {
        const value = String(raw || '').trim();
        if (!value) return '';
        if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
        if (value.startsWith('/uploads/')) return _API_BASE ? (_API_BASE + value) : value;
        // [FIX] Force relative path for local assets to avoid 404
        if (value.includes('assets/images/')) {
            return '../../' + value.substring(value.indexOf('assets/'));
        }
        return value;
    }
    async function loadProfileFromApi() {
        if (!window.api) return null;
        try {
            return await window.api.getProfile();
        } catch (_) {
            showAlert(window.i18nT ? window.i18nT('profile_load_error', 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้') : 'ไม่สามารถโหลดข้อมูลโปรไฟล์ได้', 'error');
            return null;
        }
    }
    async function saveProfileToApi(fields) {
        if (!window.api) return false;
        try {
            const res = await window.api.updateProfile(fields);
            return !!res;
        } catch (_) { return false; }
    }
    async function uploadAvatarToApi(file) {
        if (!window.api) return false;
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const res = await window.api.updateProfile(formData);
            return !!res;
        } catch (_) { return false; }
    }
    async function uploadHeroToApi(file) {
        if (!window.api) return false;
        const formData = new FormData();
        formData.append('hero_image', file);
        try {
            const res = await window.api.updateProfile(formData);
            return !!res;
        } catch (_) { return false; }
    }
    // ──────────────────────────────────────────────────────────────────────────


    const role = window.Auth ? window.Auth.getRole() : String(localStorage.getItem(window.STORAGE_KEYS?.ROLE || 'role') || 'buyer').toLowerCase();
    const PROFILE_KEY = window.STORAGE_KEYS?.PROFILE ? window.STORAGE_KEYS.PROFILE(role) : `myprofile_data_${role}`;
    const AVATAR_KEY = window.STORAGE_KEYS?.AVATAR ? window.STORAGE_KEYS.AVATAR(role) : `profile_avatar_dataurl_${role}`;
    const profileKeys = [PROFILE_KEY];
    const avatarKeys = [AVATAR_KEY];

    function loadProfileFromStorage() {
        for (const key of profileKeys) {
            try {
                const saved = localStorage.getItem(key);
                if (saved) return JSON.parse(saved);
            } catch (e) { }
        }
        return null;
    }

    function saveProfileToStorage(data) {
        try {
            const raw = JSON.stringify(data);
            profileKeys.forEach((key) => localStorage.setItem(key, raw));
            // [NEW] Sync with user_data for home page distance calculation
            try {
                const userRaw = localStorage.getItem('user_data');
                if (userRaw) {
                    const userData = JSON.parse(userRaw);
                    // Ensure we use the values from profileData/data
                    userData.lat = data.location?.lat ? parseFloat(data.location.lat) : null;
                    userData.lng = data.location?.lng ? parseFloat(data.location.lng) : null;
                    localStorage.setItem('user_data', JSON.stringify(userData));
                    console.log("[MyProfile] Sync user_data with coords:", { lat: userData.lat, lng: userData.lng });
                }
            } catch (err) { console.error("[MyProfile] Sync failed:", err); }

            // sync ไป API ด้วย
            try {
                const p = JSON.parse(raw);
                saveProfileToApi({
                    first_name: (p.name || '').split(' ')[0] || p.name || '',
                    last_name: (p.name || '').split(' ').slice(1).join(' ') || '',
                    tagline: p.tagline || '',
                    about: p.about || '',
                    address_line1: p.location?.line1 || '',
                    address_line2: p.location?.line2 || '',
                    phone: p.phone || '',
                    email: p.email || '',
                    lat: p.location?.lat || null,
                    lng: p.location?.lng || null,
                });
            } catch (_) { }
        } catch (e) { console.error('Failed to save profile data', e); }
    }

    function loadAvatarFromStorage() {
        for (const key of avatarKeys) {
            try {
                const saved = localStorage.getItem(key);
                if (saved) return saved;
            } catch (e) { }
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
                email: apiData.email || profileData.email,
                avatar: normalizeProfileImageUrl(apiData.avatar),
                heroImage: normalizeProfileImageUrl(apiData.hero_image),
                profile_id: apiData.profile_id || apiData.id || '',
                services: Array.isArray(apiData.services) ? apiData.services : profileData.services,
                followers: apiData.followers_count || 0,
                following: apiData.following_count || 0,
                location: {
                    line1: apiData.address_line1 || '',
                    line2: apiData.address_line2 || '',
                    lat: apiData.lat || null,
                    lng: apiData.lng || null,
                    mapEmbed: apiData.lat && apiData.lng ? `https://maps.google.com/maps?q=${apiData.lat},${apiData.lng}&z=15&output=embed` : '',
                    mapLink: apiData.lat && apiData.lng ? `https://maps.google.com/?q=${apiData.lat},${apiData.lng}` : ''
                }
            });
            const merged = {
                name: name || '',
                tagline: apiData.tagline || '',
                about: apiData.about || '',
                phone: apiData.phone || '',
                email: apiData.email || '',
                location: profileData.location,
                services: profileData.services
            };
            // บันทึกลง localStorage เพื่อ fallback
            const role = window.Auth ? window.Auth.getRole() : String(localStorage.getItem(window.STORAGE_KEYS?.ROLE || 'role') || 'buyer').toLowerCase();
            const PROFILE_KEY = window.STORAGE_KEYS?.PROFILE ? window.STORAGE_KEYS.PROFILE(role) : `myprofile_data_${role}`;
            localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
            // render ชื่อ
            const nameEl = document.getElementById('profileName') || document.querySelector('.profile-name');
            if (nameEl && name) nameEl.textContent = name;
            if (apiData.avatar) {
                const avatarEl = document.querySelector('.profile-avatar img') || document.getElementById('profileAvatar');
                if (avatarEl) avatarEl.src = normalizeProfileImageUrl(apiData.avatar);
            }
            // Refresh UI with API data
            if (profileTaglineEl) profileTaglineEl.textContent = profileData.tagline || '-';
            if (aboutDescEl) aboutDescEl.textContent = profileData.about || '-';
            if (addressLine1El) addressLine1El.textContent = profileData.location?.line1 || '';
            if (addressLine2El) addressLine2El.textContent = profileData.location?.line2 || '';
            if (mapIframeEl) mapIframeEl.src = profileData.location?.mapEmbed || '';
            if (mapLinkEl) mapLinkEl.href = profileData.location?.mapLink || '#';
            
            const badgeTitleEl = document.getElementById('heroBadgeTitle');
            if (badgeTitleEl) badgeTitleEl.textContent = profileData.tagline || 'ผู้รับซื้อ/ล้ง';

            if (typeof window.onProfileDataReady === 'function') window.onProfileDataReady(profileData);

            // โหลดสินค้า (products) จาก API
            let productPage = 1;
            let productLimit = 20;
            let productHasMore = true;
            async function loadProductsPage(page = 1) {
                const actualApiData = apiData.data || apiData;
                const uid = actualApiData.profile_id || actualApiData.id || localStorage.getItem('user_id');
                
                if (!window.api || !uid) return;
                try {
                    const pJson = await window.api.getProducts({
                        user_id: uid,
                        limit: productLimit,
                        page: page
                    });
                    if (pJson) {
                        const apiProducts = (pJson.data || pJson || []).map(p => {
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
                                fruit: p.name || '',
                                variety: p.variety || '',
                                prices,
                                unit: p.unit || 'กก.',
                                _id: p.product_id,
                                is_active: p.is_active !== false,
                                distance: '',
                                update: (window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(p.updated_at || p.created_at) : (p.updated_at || p.created_at)),
                            };
                        });
                        if (page === 1) profileData.products = apiProducts;
                        else profileData.products = (profileData.products || []).concat(apiProducts);
                        productHasMore = apiProducts.length === productLimit;
                        // re-render product section
                        const productContainer = document.getElementById('productListContainer');
                        if (productContainer && typeof renderProductsTo === 'function') {
                            renderProductsTo(productContainer);
                        }
                        // show/hide load more button
                        let loadMoreBtn = document.getElementById('loadMoreProductsBtn');
                        if (!loadMoreBtn) {
                            loadMoreBtn = document.createElement('button');
                            loadMoreBtn.id = 'loadMoreProductsBtn';
                            loadMoreBtn.className = 'btn btn-load-more';
                            loadMoreBtn.textContent = window.i18nT ? window.i18nT('load_more_products', 'ดูสินค้าต่อ') : 'ดูสินค้าต่อ';
                            productContainer.parentNode.appendChild(loadMoreBtn);
                        }
                        loadMoreBtn.style.display = productHasMore ? 'block' : 'none';
                        loadMoreBtn.onclick = function () {
                            if (productHasMore) {
                                productPage++;
                                loadProductsPage(productPage);
                            }
                        };
                    }
                } catch (e) {
                    console.error('Failed to load products:', e);
                    showAlert(window.i18nT ? window.i18nT('product_load_error', 'โหลดสินค้าไม่สำเร็จ') : 'โหลดสินค้าไม่สำเร็จ', 'error');
                }
            }
            loadProductsPage(1);

            // (ลบ fetch reviews ออกตามคำขอ)
        }
    }).catch(() => { });

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
        if (/[เธโ]/.test(value)) return 'กก.';
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
    if (followersCountEl) followersCountEl.textContent = profileData.followers ?? '-';
    const followingCountEl = document.getElementById("followingCount");
    if (followingCountEl) followingCountEl.textContent = profileData.following ?? '-';

    const badgeTitleEl = document.getElementById('heroBadgeTitle');
    if (badgeTitleEl) badgeTitleEl.textContent = profileData.tagline || 'ผู้รับซื้อ/ล้ง';
    setImageWithFallback(heroImageEl, profileData.heroImage, fallbackHeroImage);

    // โหลดรูป avatar จาก localStorage ก่อน (sync กับ account)
    try {
        const savedAvatar = loadAvatarFromStorage();
        if (savedAvatar && !savedAvatar.includes('assets/images')) {
            profileData.avatar = savedAvatar;
        }
    } catch (_) { }

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
        if (followersCountEl) followersCountEl.textContent = profileData.followers ?? '-';
        const followingCountEl = document.getElementById("followingCount");
        if (followingCountEl) followingCountEl.textContent = profileData.following ?? '-';

        const badgeTitleEl = document.getElementById('heroBadgeTitle');
        if (badgeTitleEl) badgeTitleEl.textContent = profileData.tagline || 'ผู้รับซื้อ/ล้ง';
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

    // Fire the onProfileDataReady hook so the page's tab scripts can populate
    // contact, services, and location tabs (Frame 15, 16, 17)
    if (typeof window.onProfileDataReady === 'function') {
        window.onProfileDataReady(profileData);
    }

    const addressLine1El = document.getElementById("addressLine1");
    const addressLine2El = document.getElementById("addressLine2");
    const mapIframeEl = document.getElementById("mapIframe");
    const mapLinkEl = document.getElementById("mapLink");

    if (addressLine1El) addressLine1El.textContent = profileData.location?.line1 || '';
    if (addressLine2El) addressLine2El.textContent = profileData.location?.line2 || '';
    if (mapIframeEl) mapIframeEl.src = profileData.location?.mapEmbed || '';
    if (mapLinkEl) mapLinkEl.href = profileData.location?.mapLink || '#';

    function saveProfileData() {
        saveProfileToStorage(profileData);
    }

    /* ==========================================================
        RENDER SERVICES (inject after location-card)
        ========================================================== */
    function showAlert(msg, type = 'info') {
        if (window.appNotify) window.appNotify(msg, type);
        else if (type === 'error') console.error(msg);
        else console.log(msg);
    }
    const SERVICES_META = {
        'On-site buying': { icon: 'local_shipping', color: 'green', desc: 'มีบริการรถรับซื้อถึงสวนของเกษตรกร' },
        'Cash payment': { icon: 'payments', color: 'orange', desc: 'ชำระเงินสดทันทีเมื่อส่งมอบสินค้า' },
        'Standardized scale': { icon: 'scale', color: 'blue', desc: 'ใช้เครื่องชั่งมาตรฐาน กรมการค้าภายใน' },
        'Packaging service': { icon: 'inventory_2', color: 'purple', desc: 'มีบริการคัดเกรดและแพ็กกล่อง' },
        // Thai mapping
        'รับซื้อถึงที่': { icon: 'local_shipping', color: 'green', desc: 'มีบริการรถรับซื้อถึงสวนของเกษตรกร' },
        'จ่ายเงินสด': { icon: 'payments', color: 'orange', desc: 'ชำระเงินสดทันทีเมื่อส่งมอบสินค้า' },
        'มีตราชั่งมาตรฐาน': { icon: 'scale', color: 'blue', desc: 'ใช้เครื่องชั่งมาตรฐาน กรมการค้าภายใน' },
        'บริการคัดเกรด': { icon: 'inventory_2', color: 'purple', desc: 'มีบริการคัดเกรดและแพ็กกล่อง' },
        'จองคิวล่วงหน้า': { icon: 'event_available', color: 'blue', desc: 'สามารถจองคิวขายล่วงหน้าผ่านแอปได้' }
    };



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
            showEmptyState(container, window.i18nT ? window.i18nT('no_purchase_items', 'ยังไม่มีสินค้าที่รับซื้อ') : 'ยังไม่มีสินค้าที่รับซื้อ');
            return;
        }
        hideEmptyState(container);
        profileData.products.forEach((product, idx) => {
            const card = document.createElement("div");
            card.className = "product-card-light";
            const isOpen = product.is_active !== false;
            card.dataset.isOpen = isOpen ? "true" : "false";
            card.dataset.index = String(idx);
            card.dataset.productId = String(product._id || '');
            const currentUid = profileData.profile_id || profileData.id || localStorage.getItem('user_id') || '';
            card.dataset.sellerId = String(currentUid);
            card.dataset.sellerName = profileData.name || '';

            card.innerHTML = `
                <div class="pc-header">
                    <div class="pc-seller-info">
                        <div class="pc-avatar">
                            <img src="${esc(profileData.avatar || fallbackAvatarImage)}" onerror="this.onerror=null;this.src='${esc(fallbackAvatarImage)}';">
                        </div>
                        <div class="pc-seller-text">
                            <div class="pc-name">${esc(profileData.name || '-')}</div>
                            <div class="pc-sub">${esc(product.fruit || '-')}${product.variety ? ` (${esc(product.variety)})` : ''}</div>
                        </div>
                    </div>
                    <div style="padding:4px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${isOpen ? '#dcfce7' : '#fee2e2'};color:${isOpen ? '#16a34a' : '#dc2626'}; height: max-content;">
                        ${isOpen ? (window.i18nT ? window.i18nT('buying_open', 'เปิดรับซื้อ') : 'เปิดรับซื้อ') : (window.i18nT ? window.i18nT('buying_closed', 'ปิดรับซื้อ') : 'ปิดรับซื้อ')}
                    </div>
                </div>

                <div class="pc-grades-row">
                    ${Object.keys(product.prices || {}).filter(g => product.prices[g]).map(g =>
                `<div class="pc-grade-box">
                            <div class="pc-grade-letter">${esc(g)}</div>
                            <div class="pc-grade-price">${esc(String(product.prices[g]))} บ./${esc(normalizeUnitLabel(product.unit))}</div>
                        </div>`
            ).join("")}
                </div>

                <div class="pc-footer">
                    <div class="pc-footer-left">
                        <span class="material-icons-outlined" style="font-size:15px; color:#00a651;">place</span>
                        ${window.i18nT ? window.i18nT('distance_label', 'ระยะทาง') : 'ระยะทาง'} ${esc(String(product.distance || '-'))}
                    </div>
                    <div>${window.i18nT ? window.i18nT('update_label', 'อัปเดต') : 'อัปเดต'} ${esc(String(product.update || '-'))}</div>
                </div>

                <div class="pc-actions">
                    <button class="pc-btn-contact" type="button" data-action="toggle-status">
                        <span class="status-text">${isOpen ? (window.i18nT ? window.i18nT('buying_closed', 'ปิดรับซื้อ') : 'ปิดรับซื้อ') : (window.i18nT ? window.i18nT('buying_open', 'เปิดรับซื้อ') : 'เปิดรับซื้อ')}</span>
                    </button>
                    <button class="pc-btn-book" type="button" data-action="edit-purchase">${window.i18nT ? window.i18nT('edit_purchase', 'แก้ไขการรับซื้อ') : 'แก้ไขการรับซื้อ'}</button>
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
    const addr1Editor = document.getElementById('addr1Editor');
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
        const card = btn.closest(".product-card-light");
        if (!card) return;
        const action = btn.dataset.action;

        if (action === "toggle-status") {
            const isOpen = card.dataset.isOpen !== "false";
            const newState = !isOpen;
            const productId = card.dataset.productId || '';

            // อัปเดต UI ทันที
            card.dataset.isOpen = String(newState);
            const statusText = card.querySelector(".status-text");
            if (statusText) statusText.textContent = newState ? (window.i18nT ? window.i18nT('buying_closed', 'ปิด การรับซื้อ') : 'ปิด การรับซื้อ') : (window.i18nT ? window.i18nT('buying_open', 'เปิด การรับซื้อ') : 'เปิด การรับซื้อ');
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
        try {
            console.log("openEditModal called. profileData:", profileData);
            if (nameEditor) nameEditor.value = profileData.name || '';
            if (taglineEditor) taglineEditor.value = profileData.tagline || '';
            if (aboutEditor) aboutEditor.value = profileData.about || '';
            if (phoneEditor) phoneEditor.value = profileData.phone || '';
            if (emailEditor) emailEditor.value = profileData.email || '';
            if (addr1Editor) addr1Editor.value = profileData.location?.line1 || '';
            if (addr2Editor) addr2Editor.value = profileData.location?.line2 || '';
            if (mapLatEditor) mapLatEditor.value = profileData.location?.lat || '';
            if (mapLngEditor) mapLngEditor.value = profileData.location?.lng || '';

            // Check Services Checkboxes
            const servicesEditor = document.getElementById('servicesEditor');
            if (servicesEditor) {
                const checks = servicesEditor.querySelectorAll('input[type="checkbox"]');
                const currentSvcNames = (profileData.services || []).map(s => s.name);
                checks.forEach(chk => {
                    chk.checked = currentSvcNames.includes(chk.value);
                });
            }

            if (mapLatEditor && mapLatEditor.value && mapLngEditor && mapLngEditor.value) {
                if (mapPickerStatusText) mapPickerStatusText.textContent = "ปักหมุดแล้ว (" + parseFloat(mapLatEditor.value).toFixed(4) + ", " + parseFloat(mapLngEditor.value).toFixed(4) + ")";
            } else {
                if (mapPickerStatusText) mapPickerStatusText.textContent = "เลือกตำแหน่งบนแผนที่...";
            }

            if (editAboutModal) editAboutModal.hidden = false;
            if (mapPickerContainer) mapPickerContainer.style.display = 'none';
        } catch (error) {
            console.error("Error opening modal:", error);
            if (window.showAlert) showAlert("Error: " + error.message, "error");
            else console.error("Error: " + error.message);
        }
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

                    pickerMap.on('click', function (e) {
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
    if (saveAboutBtn) saveAboutBtn.addEventListener('click', async () => {
        // Validate required fields
        if (!nameEditor.value.trim()) {
            showAlert('กรุณากรอกชื่อโปรไฟล์', 'error');
            nameEditor.focus();
            return;
        }

        const oldText = saveAboutBtn.innerHTML;
        saveAboutBtn.innerHTML = '<span class="material-icons-outlined spin">hourglass_empty</span> กำลังบันทึก...';
        saveAboutBtn.disabled = true;

        // บันทึกข้อมูล
        profileData.name = nameEditor.value.trim();
        profileData.tagline = taglineEditor.value.trim();
        profileData.about = aboutEditor.value || '';
        profileData.phone = phoneEditor.value || '';
        profileData.email = emailEditor.value || '';
        profileData.location = profileData.location || {};
        profileData.location.line1 = addr1Editor.value || '';
        profileData.location.line2 = addr2Editor.value || '';

        // Collect Services
        const servicesEditor = document.getElementById('servicesEditor');
        if (servicesEditor) {
            const checks = servicesEditor.querySelectorAll('input[type="checkbox"]:checked');
            profileData.services = Array.from(checks).map(chk => ({ name: chk.value }));
        }

        const pickedLat = mapLatEditor.value;
        const pickedLng = mapLngEditor.value;
        profileData.location.lat = pickedLat ? parseFloat(pickedLat) : null;
        profileData.location.lng = pickedLng ? parseFloat(pickedLng) : null;

        let finalEmbed = '';
        let finalLink = '';
        if (profileData.location.lat && profileData.location.lng) {
            finalEmbed = `https://maps.google.com/maps?q=${profileData.location.lat},${profileData.location.lng}&z=15&output=embed`;
            finalLink = `https://maps.google.com/?q=${profileData.location.lat},${profileData.location.lng}`;
        } else {
            const fullAddr = [profileData.location.line1, profileData.location.line2].filter(Boolean).join(' ');
            const mapQ = fullAddr || profileData.name || '';
            if (mapQ) {
                finalEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(mapQ)}&z=13&output=embed`;
                finalLink = `https://maps.google.com/?q=${encodeURIComponent(mapQ)}`;
            }
        }
        profileData.location.mapEmbed = finalEmbed;
        profileData.location.mapLink = finalLink;

        // อัปเดตหน้าจอ
        if (profileNameEl) profileNameEl.textContent = profileData.name;
        if (profileTaglineEl) profileTaglineEl.textContent = profileData.tagline;
        if (aboutDescEl) aboutDescEl.textContent = profileData.about;
        if (addressLine1El) addressLine1El.textContent = profileData.location.line1 || '';
        if (addressLine2El) addressLine2El.textContent = profileData.location.line2 || '';
        if (mapLinkEl) mapLinkEl.href = profileData.location.mapLink || '';
        if (mapIframeEl) mapIframeEl.src = profileData.location.mapEmbed || '';

        // Sync with API
        const success = await saveProfileToApi({
            first_name: profileData.name.split(' ')[0],
            last_name: profileData.name.split(' ').slice(1).join(' '),
            tagline: profileData.tagline,
            about: profileData.about,
            phone: profileData.phone,
            email: profileData.email,
            address_line1: profileData.location.line1,
            address_line2: profileData.location.line2,
            lat: profileData.location.lat,
            lng: profileData.location.lng,
            services: profileData.services
        });

        saveAboutBtn.innerHTML = oldText;
        saveAboutBtn.disabled = false;

        if (success) {
            saveProfileToStorage(profileData);
            if (typeof window.onProfileDataReady === 'function') window.onProfileDataReady(profileData);
            showAlert('บันทึกโปรไฟล์สำเร็จ', 'success');
            editAboutModal.hidden = true;
        } else {
            showAlert('บันทึกลงเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
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
            } catch (e) { }
        } catch (err) { console.error("Failed to apply saved booking payload", err); }
        // CSS Injection for services
    const style = document.createElement('style');
    style.textContent = `
        .services-container { margin: 24px 0; padding: 0 16px; }
        .services-title { font-size: 18px; font-weight: 800; margin-bottom: 16px; color: var(--text-main, #111827); }
        .service-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .service-card { 
            display: flex; align-items: center; gap: 16px; 
            padding: 16px; background: rgba(255,255,255,0.05); 
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.08);
        }
        [data-theme="light"] .service-card { background: #f9fafb; border-color: #efefef; }
        
        .service-icon-wrap { 
            width: 48px; height: 48px; border-radius: 12px; 
            display: grid; place-items: center; flex-shrink: 0;
        }
        .service-icon-wrap.green { background: rgba(25,182,90,0.1); color: #19b65a; }
        .service-icon-wrap.orange { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .service-icon-wrap.blue { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .service-icon-wrap.purple { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        
        .service-content { display: flex; flex-direction: column; gap: 2px; }
        .service-name { font-size: 15px; font-weight: 800; color: var(--text-main, #111827); }
        .service-desc { font-size: 12px; color: var(--text-muted, #6b7280); font-weight: 500; line-height: 1.4; }
    `;
    document.head.appendChild(style);
})();
});
