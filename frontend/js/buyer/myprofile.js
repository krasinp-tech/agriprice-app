document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    // ── Login Guard ──────────────────────────────────────────────────────────
    if (window.AuthGuard && typeof AuthGuard.requireLogin === 'function') {
        AuthGuard.requireLogin();
    }

    // ── API & Helpers ────────────────────────────────────────────────────────
    const api = window.api || {};
    const helpers = window.ProfileHelpers || {};
    const ui = window.AgriPriceUI || {};
    const esc = (s) => ui.escapeHtml ? ui.escapeHtml(s) : s;

    // ── Storage Keys ────────────────────────────────────────────────────────
    const role = api.getRole ? api.getRole() : 'buyer';
    const KEYS = window.STORAGE_KEYS || {
        PROFILE: (r) => `myprofile_data_${r}`,
        AVATAR: (r) => `profile_avatar_dataurl_${r}`
    };
    const PROFILE_KEY = KEYS.PROFILE(role);
    const AVATAR_KEY = KEYS.AVATAR(role);

    // ── Data Model ──────────────────────────────────────────────────────────
    let profileData = {
        name: '', tagline: '', followers: 0, heroImage: '', avatar: '', about: '',
        phone: '', email: '', location: { line1: '', line2: '', mapEmbed: '', mapLink: '', lat: '', lng: '' },
        services: [], products: [], profile_id: '', links: [],
    };

    // ── Initialization ──────────────────────────────────────────────────────
    async function syncProfile() {
        if (api.getProfile) {
            try {
                const apiData = await api.getProfile();
                if (apiData) {
                    profileData = {
                        ...profileData,
                        name: `${apiData.first_name || ''} ${apiData.last_name || ''}`.trim(),
                        tagline: apiData.tagline || '',
                        about: apiData.about || '',
                        phone: apiData.phone || '',
                        email: apiData.email || '',
                        avatar: apiData.avatar,
                        heroImage: apiData.hero_image,
                        profile_id: apiData.profile_id,
                        followers: apiData.followers_count || 0,
                        tier: apiData.tier || 'free',
                        services: Array.isArray(apiData.services) ? apiData.services : (apiData.services ? JSON.parse(apiData.services) : []),
                        links: Array.isArray(apiData.links) ? apiData.links : (apiData.links ? JSON.parse(apiData.links) : []),
                        location: {
                            line1: apiData.address_line1 || '',
                            line2: apiData.address_line2 || '',
                            lat: apiData.lat, lng: apiData.lng,
                            mapEmbed: apiData.lat ? `https://maps.google.com/maps?q=${apiData.lat},${apiData.lng}&z=15&output=embed` : '',
                            mapLink: apiData.lat ? `https://maps.google.com/?q=${apiData.lat},${apiData.lng}` : ''
                        }
                    };
                    renderUI();
                    localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));
                    if (profileData.avatar) {
                        localStorage.setItem(AVATAR_KEY, profileData.avatar);
                    }
                    
                    // Update user_data in localStorage with synced profile coordinates
                    try {
                        const rawUser = localStorage.getItem("user_data");
                        if (rawUser) {
                            const user = JSON.parse(rawUser);
                            user.lat = apiData.lat;
                            user.lng = apiData.lng;
                            localStorage.setItem("user_data", JSON.stringify(user));
                        }
                    } catch (_) {}

                    await loadProducts();
                }
            } catch (err) { console.error('[MyProfile] API Sync Error:', err); }
        }
    }

    async function init() {
        // 1. Load from storage first (instant UI)
        try {
            const saved = localStorage.getItem(PROFILE_KEY);
            if (saved) profileData = { ...profileData, ...JSON.parse(saved) };
            const savedAvatar = localStorage.getItem(AVATAR_KEY);
            if (savedAvatar) profileData.avatar = savedAvatar;
        } catch (_) { }

        // 2. Initial Render
        renderUI();

        // 3. Sync from API
        await syncProfile();
    }

    function renderUI() {
        helpers.renderBasicInfo({
            first_name: profileData.name.split(' ')[0] || '',
            last_name: profileData.name.split(' ').slice(1).join(' ') || '',
            tagline: profileData.tagline,
            avatar: profileData.avatar,
            hero_image: profileData.heroImage,
            about: profileData.about,
            followers_count: profileData.followers
        });

        // Hide buyer-specific elements if the user is a farmer
        if (role === 'farmer') {
            const addPurchaseBtn = document.getElementById('addPurchaseBtn');
            if (addPurchaseBtn) addPurchaseBtn.style.display = 'none';
            
            const listTitle = document.querySelector('.products-list-title');
            if (listTitle) listTitle.style.display = 'none';
            
            const servicesTab = document.querySelector('.profile-tab[data-tab="services"]');
            if (servicesTab) servicesTab.style.display = 'none';
            
            const servicesEditor = document.getElementById('servicesEditor');
            const servicesEditorLabel = document.querySelector('label[data-i18n="services_label"]');
            if (servicesEditor) servicesEditor.style.display = 'none';
            if (servicesEditorLabel) servicesEditorLabel.style.display = 'none';
        }

        // Location tab
        const addr1 = document.getElementById('addressLine1');
        const addr2 = document.getElementById('addressLine2');
        const mapIframe = document.getElementById('mapIframe');
        const mapLink = document.getElementById('mapLink');

        if (addr1) addr1.textContent = profileData.location.line1 || '-';
        if (addr2) addr2.textContent = profileData.location.line2 || '';
        if (mapIframe) mapIframe.src = profileData.location.mapEmbed || '';
        if (mapLink) {
            mapLink.href = profileData.location.mapLink || '#';
            mapLink.style.display = profileData.location.mapLink ? 'inline-block' : 'none';
        }

        // Call global callback for other tabs (Contact, Services)
        if (window.onProfileDataReady) {
            window.onProfileDataReady(profileData);
        }
    }

    async function loadProducts() {
        const container = document.getElementById("productListContainer");
        if (!container || !api.getProducts) return;

        try {
            const res = await api.getProducts({ user_id: profileData.profile_id });
            const rawItems = (res.data || res || []);
            const items = rawItems.map(helpers.mapProductData);
            profileData.products = items;

            renderCustomProducts(container);
        } catch (err) { console.error('[MyProfile] Products Error:', err); }
    }

    async function toggleStatus(p, card) {
        const productId = p.id || p.productId;
        const currentStatus = p.is_active;
        const newStatus = !currentStatus;
        
        const btn = card.querySelector('[data-action="toggle-status"]');
        if (btn) btn.disabled = true;

        try {
            const res = await api.updateProduct(productId, { is_active: newStatus });
            if (res && res.success) {
                p.is_active = newStatus;
                
                // Update Badge
                const badge = card.querySelector('.status-badge');
                if (badge) {
                    badge.textContent = newStatus ? 'เปิดรับซื้อ' : 'ปิดรับซื้อ';
                    badge.className = `status-badge ${newStatus ? 'open' : 'closed'}`;
                }
                
                // Update Button Text
                const btnText = card.querySelector('.status-text');
                if (btnText) {
                    btnText.textContent = newStatus ? 'ปิด การรับซื้อ' : 'เปิด การรับซื้อ';
                }

                if (window.showToast) window.showToast('อัปเดตสถานะสำเร็จ');
            }
        } catch (err) {
            console.error('[MyProfile] Toggle status error:', err);
            if (window.showToast) window.showToast('อัปเดตสถานะล้มเหลว');
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function editPurchase(product) {
        const productId = product.id || product.productId;
        const payload = {
            product: { id: productId, name: product.title },
            variety: product.subtitle ? { name: product.subtitle } : null,
            grades: [
                { grade: 'A', price: product.priceA },
                { grade: 'B', price: product.priceB },
                { grade: 'C', price: product.priceC }
            ].filter(g => g.price),
            editSource: { page: "myprofile" }
        };
        sessionStorage.setItem("setbooking_step1", JSON.stringify(payload));
        window.location.href = "setbooking/setbooking-step1.html";
    }

    function renderCustomProducts(container) {
        if (!profileData.products.length) {
            container.innerHTML = `<div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                <span class="material-icons-outlined" style="font-size:48px; margin-bottom:10px; display:block;">inventory_2</span>
                <p data-i18n="no_products_yet">ยังไม่มีรายการรับซื้อ</p>
            </div>`;
            return;
        }

        const items = profileData.products.map(p => ({
            ...p,
            isOwner: true,
            title: profileData.name,
            subtitle: p.subtitle ? `${p.title} (${p.subtitle})` : p.title,
            avatar: profileData.avatar
        }));

        if (window.ProductCard && window.ProductCard.mount) {
            window.ProductCard.mount(container, items, {
                handlers: {
                    onToggleStatus: (p, card) => toggleStatus(p, card),
                    onEdit: (p, card) => editPurchase(p)
                }
            });
        }
    }

    // ── Modal & Editing Logic ────────────────────────────────────────────────
    const editAboutBtn = document.getElementById("editAboutBtn");
    const editAboutModal = document.getElementById("editAboutModal");
    const saveAboutBtn = document.getElementById("saveAboutBtn");
    const cancelAboutBtn = document.getElementById("cancelAboutBtn");

    const nameEditor = document.getElementById('nameEditor');
    const taglineEditor = document.getElementById('taglineEditor');
    const aboutEditor = document.getElementById('aboutEditor');
    const phoneEditor = document.getElementById('phoneEditor');
    const emailEditor = document.getElementById('emailEditor');
    const addr1Editor = document.getElementById('addr1Editor');
    const addr2Editor = document.getElementById('addr2Editor');
    const mapLatEditor = document.getElementById('mapLatEditor');
    const mapLngEditor = document.getElementById('mapLngEditor');

    function openEditModal() {
        if (!editAboutModal) return;
        nameEditor.value = profileData.name || '';
        taglineEditor.value = profileData.tagline || '';
        aboutEditor.value = profileData.about || '';
        phoneEditor.value = profileData.phone || '';
        emailEditor.value = profileData.email || '';
        addr1Editor.value = profileData.location?.line1 || '';
        addr2Editor.value = profileData.location?.line2 || '';
        mapLatEditor.value = profileData.location?.lat || '';
        mapLngEditor.value = profileData.location?.lng || '';

        // Services checkboxes
        const checkboxes = document.querySelectorAll('#servicesEditor input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = profileData.services.includes(cb.value);
        });

        editAboutModal.hidden = false;
    }

    if (editAboutBtn) editAboutBtn.addEventListener("click", openEditModal);
    if (cancelAboutBtn) cancelAboutBtn.addEventListener("click", () => { editAboutModal.hidden = true; });

    if (saveAboutBtn) {
        saveAboutBtn.addEventListener("click", async () => {
            const btn = saveAboutBtn;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'กำลังบันทึก...';

            const selectedServices = Array.from(document.querySelectorAll('#servicesEditor input[type="checkbox"]:checked')).map(cb => cb.value);

            const fields = {
                first_name: nameEditor.value.split(' ')[0] || '',
                last_name: nameEditor.value.split(' ').slice(1).join(' ') || '',
                tagline: taglineEditor.value || '',
                about: aboutEditor.value || '',
                address_line1: addr1Editor.value || '',
                address_line2: addr2Editor.value || '',
                phone: phoneEditor.value || '',
                email: emailEditor.value || '',
                lat: mapLatEditor.value ? parseFloat(mapLatEditor.value) : null,
                lng: mapLngEditor.value ? parseFloat(mapLngEditor.value) : null,
                services: JSON.stringify(selectedServices)
            };

            try {
                const res = await api.updateProfile(fields);
                if (res) {
                    await syncProfile();
                    editAboutModal.hidden = true;
                    if (window.showToast) window.showToast('บันทึกข้อมูลเรียบร้อยแล้ว');
                } else {
                    throw new Error('Update failed');
                }
            } catch (err) {
                console.error('[MyProfile] Save error:', err);
                if (window.showToast) window.showToast('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    // ── Image Uploads ────────────────────────────────────────────────────────
    const avatarInput = document.getElementById('avatarInput');
    const coverInput = document.getElementById('coverInput');

    async function uploadImage(file, type) {
        if (!file || !api.updateProfile) return;
        
        const fd = new FormData();
        fd.append(type === 'avatar' ? 'avatar' : 'hero_image', file);

        try {
            const res = await api.updateProfile(fd);
            if (res) {
                await syncProfile();
                if (window.showToast) window.showToast('อัปโหลดรูปภาพสำเร็จ');
            }
        } catch (err) {
            console.error('[MyProfile] Upload error:', err);
            if (window.showToast) window.showToast('อัปโหลดรูปภาพล้มเหลว');
        }
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) uploadImage(file, 'avatar');
        });
    }
    if (coverInput) {
        coverInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) uploadImage(file, 'hero');
        });
    }

    // ── Map Picker Logic ─────────────────────────────────────────────────────
    let map = null;
    let marker = null;
    const openMapPickerBtn = document.getElementById('openMapPickerBtn');
    const mapPickerContainer = document.getElementById('mapPickerContainer');
    const getCurrentLocationBtn = document.getElementById('getCurrentLocationBtn');

    function initMap() {
        if (map) return;
        const lat = parseFloat(mapLatEditor.value) || 13.7563;
        const lng = parseFloat(mapLngEditor.value) || 100.5018;

        map = L.map('leafletMapDiv').setView([lat, lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker([lat, lng], { draggable: true }).addTo(map);

        marker.on('dragend', function (e) {
            const pos = e.target.getLatLng();
            mapLatEditor.value = pos.lat.toFixed(6);
            mapLngEditor.value = pos.lng.toFixed(6);
        });

        map.on('click', function (e) {
            marker.setLatLng(e.latlng);
            mapLatEditor.value = e.latlng.lat.toFixed(6);
            mapLngEditor.value = e.latlng.lng.toFixed(6);
        });
    }

    if (openMapPickerBtn) {
        openMapPickerBtn.addEventListener('click', () => {
            const isHidden = mapPickerContainer.style.display === 'none';
            mapPickerContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                setTimeout(() => {
                    initMap();
                    map.invalidateSize();
                }, 100);
            }
        });
    }

    if (getCurrentLocationBtn) {
        getCurrentLocationBtn.addEventListener('click', () => {
            if (!navigator.geolocation) return alert('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง');
            navigator.geolocation.getCurrentPosition((pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                mapLatEditor.value = lat.toFixed(6);
                mapLngEditor.value = lng.toFixed(6);
                if (map) {
                    map.setView([lat, lng], 15);
                    marker.setLatLng([lat, lng]);
                }
            }, (err) => {
                alert('ไม่สามารถเข้าถึงตำแหน่งของคุณได้');
            });
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const addPurchaseBtn = document.getElementById('addPurchaseBtn');
    if (addPurchaseBtn) {
        addPurchaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const tier = (profileData.tier || 'free').toLowerCase();
            const limit = tier === 'pro' ? 10 : 3;
            const currentCount = profileData.products ? profileData.products.filter(p => p.is_active !== false).length : 0;
            
            if (currentCount >= limit) {
                const t = (k, f) => window.i18nT ? window.i18nT(k, f) : f;
                if (tier === 'free') {
                    const confirmMsg = t('error_free_limit', 'บัญชี FREE จำกัดการสร้างรายการรับซื้อสูงสุด 3 รายการ ต้องการอัปเกรดเป็น PRO เพื่อรับสิทธิ์เพิ่มรายการได้สูงสุด 10 รายการหรือไม่?');
                    if (window.showConfirm) {
                        window.showConfirm(confirmMsg, (agreed) => {
                            if (agreed) {
                                window.location.href = '../account/subscription.html';
                            }
                        });
                    } else {
                        const confirmUpgrade = confirm(confirmMsg);
                        if (confirmUpgrade) {
                            window.location.href = '../account/subscription.html';
                        }
                    }
                } else {
                    alert(t('error_pro_limit', 'ขออภัย บัญชี PRO จำกัดการสร้างรายการรับซื้อสูงสุด 10 รายการเท่านั้น'));
                }
            } else {
                window.location.href = "setbooking/setbooking-step1.html";
            }
        });
    }

    // Initial load
    init();
});
