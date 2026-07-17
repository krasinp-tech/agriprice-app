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
    const t = (key, fallback, params) => window.i18nT ? window.i18nT(key, fallback, params) : fallback;

    function renderOwnPresence(online) {
        const row = document.getElementById('ownProfilePresence');
        const text = document.getElementById('ownProfilePresenceText');
        row?.classList.toggle('is-offline', !online);
        if (text) {
            text.textContent = online ? t('online', 'ออนไลน์') : t('offline', 'ออฟไลน์');
            text.removeAttribute('data-i18n');
        }
    }

    window.addEventListener('agriprice:presence-self', event => renderOwnPresence(event.detail?.online === true));
    window.addEventListener('offline', () => renderOwnPresence(false));
    window.addEventListener('online', () => window.AgriPresence?.ping?.());
    renderOwnPresence(false);
    window.AgriPresence?.ping?.();

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

            const productsContainer = document.getElementById('productListContainer');
            if (productsContainer) productsContainer.style.display = 'none';
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
        const productId = p.offerId || p.offer_id || p.id || p.productId;
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
                    badge.textContent = newStatus ? t('status_open', 'เปิดรับซื้อ') : t('status_closed', 'ปิดรับซื้อ');
                    badge.className = `status-badge ${newStatus ? 'open' : 'closed'}`;
                }
                // Update Button Text
                const btnText = card.querySelector('.status-text');
                if (btnText) {
                    btnText.textContent = newStatus ? t('close_buying', 'ปิด การรับซื้อ') : t('open_buying', 'เปิด การรับซื้อ');
                }

                if (window.showToast) window.showToast(t('status_update_success', 'อัปเดตสถานะสำเร็จ'));
            }
        } catch (err) {
            console.error('[MyProfile] Toggle status error:', err);
            if (window.showToast) window.showToast(t('status_update_failed', 'อัปเดตสถานะล้มเหลว'));
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function parsePriceValue(value) {
        if (value === undefined || value === null) return null;
        const raw = String(value).trim();
        if (!raw || raw === '-' || raw.toLowerCase() === 'null') return null;
        const match = raw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
        const price = Number(match ? match[0] : raw);
        return Number.isFinite(price) && price > 0 ? price : null;
    }

    function getEditableGrades(product) {
        const source = Array.isArray(product.grades)
            ? product.grades
            : (Array.isArray(product.product_grades)
                ? product.product_grades
                : (Array.isArray(product.offer_grades) ? product.offer_grades : []));

        const grades = source
            .map((g) => ({
                grade: g.grade_name || g.grade || 'A',
                price: parsePriceValue(g.price)
            }))
            .filter((g) => g.price !== null);

        if (grades.length > 0) return grades;

        return [
            { grade: 'A', price: parsePriceValue(product.priceA) },
            { grade: 'B', price: parsePriceValue(product.priceB) },
            { grade: 'C', price: parsePriceValue(product.priceC) },
            { grade: product.grade || 'A', price: parsePriceValue(product.price) }
        ].filter((g) => g.price !== null);
    }

    function editPurchase(product) {
        const productId = product.offerId || product.offer_id || product.id || product.productId;
        const productName = product.productName || product.offerName || product.rawTitle || product.name || product.title;
        const varietyName = product.varietyName || product.rawSubtitle || product.variety || '';
        const grades = getEditableGrades(product);
        if (grades.length === 0) {
            if (window.showToast) window.showToast('Please add at least one valid price before editing');
            return;
        }
        const payload = {
            product: { id: productId, offer_id: productId, name: productName },
            variety: varietyName ? { name: varietyName } : null,
            grades,
            details: product.description || product.rawProduct?.description || '',
            editSource: { page: "myprofile", isEdit: true, offer_id: productId, product_id: productId }
        };
        sessionStorage.setItem("setbooking_step1", JSON.stringify(payload));
        window.location.href = "setbooking/setbooking-step1.html";
    }


    async function deletePurchase(product, card) {
        const productId = product.offerId || product.offer_id || product.id || product.productId;
        if (!productId) return;

        const confirmMsg = window.i18nT
            ? window.i18nT('confirm_delete_purchase', 'คุณต้องการลบการรับซื้อนี้ใช่หรือไม่?')
            : 'คุณต้องการลบการรับซื้อนี้ใช่หรือไม่?';

        const showConfirm = window.showConfirm;

        showConfirm(confirmMsg, async (confirmed) => {
            if (!confirmed) return;
            try {
                if (api.deleteProduct) {
                    await api.deleteProduct(productId);
                } else {
                    await api.call('DELETE', '/api/products/' + productId);
                }

                const successMsg = window.i18nT
                    ? window.i18nT('delete_success', 'ลบรายการรับซื้อสำเร็จ')
                    : 'ลบรายการรับซื้อสำเร็จ';
                if (window.showToast) window.showToast(successMsg, 'success');
                else if (window.appNotify) window.appNotify(successMsg, 'success');
                else window.showAlert?.(successMsg, 'success');

                await loadProducts();
            } catch (err) {
                console.error('[MyProfile] Delete error:', err);
                const errorMsg = window.i18nT
                    ? window.i18nT('delete_failed', 'ลบรายการรับซื้อไม่สำเร็จ')
                    : 'ลบรายการรับซื้อไม่สำเร็จ';
                if (window.showToast) window.showToast(errorMsg, 'error');
                else if (window.appNotify) window.appNotify(errorMsg, 'error');
                else window.showAlert?.(errorMsg, 'error');
            }
        }, {
            variant: 'danger',
            title: t('delete_item', 'ลบรายการ'),
            confirmText: t('delete', 'ลบ')
        });
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
            productName: p.title,
            varietyName: p.subtitle,
            rawTitle: p.title,
            rawSubtitle: p.subtitle,
            title: profileData.name,
            subtitle: p.subtitle ? `${p.title} (${p.subtitle})` : p.title,
            avatar: profileData.avatar
        }));

        if (window.ProductCard && window.ProductCard.mount) {
            window.ProductCard.mount(container, items, {
                handlers: {
                    onToggleStatus: (p, card) => toggleStatus(p, card),
                    onEdit: (p, card) => editPurchase(p),
                    onDelete: (p, card) => deletePurchase(p, card)
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
    const linkTypeEditor = document.getElementById('linkTypeEditor');
    const linkEditor = document.getElementById('linkEditor');
    const linkEditorHint = document.getElementById('linkEditorHint');
    const addr1Editor = document.getElementById('addr1Editor');
    const addr2Editor = document.getElementById('addr2Editor');
    const mapLatEditor = document.getElementById('mapLatEditor');
    const mapLngEditor = document.getElementById('mapLngEditor');
    const prevProfileStepBtn = document.getElementById('prevProfileStepBtn');
    const nextProfileStepBtn = document.getElementById('nextProfileStepBtn');
    const profileEditorProgressFill = document.getElementById('profileEditorProgressFill');
    const profileEditorStepStatus = document.getElementById('profileEditorStepStatus');
    const profileEditorSteps = ['general', 'contact', 'services'];
    let currentProfileStep = 0;

    function activateProfileStep(index, focusPanel = false) {
        currentProfileStep = Math.max(0, Math.min(profileEditorSteps.length - 1, index));
        const targetTab = profileEditorSteps[currentProfileStep];

        editAboutModal?.querySelectorAll('.modal-tab-btn').forEach(button => {
            const active = button.dataset.modalTab === targetTab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        editAboutModal?.querySelectorAll('.modal-tab-panel').forEach(panel => {
            const active = panel.id === `modal-panel-${targetTab}`;
            panel.classList.toggle('active', active);
            panel.setAttribute('aria-hidden', String(!active));
        });

        const progress = ((currentProfileStep + 1) / profileEditorSteps.length) * 100;
        if (profileEditorProgressFill) profileEditorProgressFill.style.width = `${progress}%`;
        if (profileEditorStepStatus) {
            profileEditorStepStatus.textContent = t('profile_step_progress', `ขั้นตอน ${currentProfileStep + 1} จาก ${profileEditorSteps.length}`, {
                current: currentProfileStep + 1,
                total: profileEditorSteps.length
            });
        }
        if (prevProfileStepBtn) prevProfileStepBtn.hidden = currentProfileStep === 0;
        if (nextProfileStepBtn) nextProfileStepBtn.hidden = currentProfileStep === profileEditorSteps.length - 1;
        if (saveAboutBtn) saveAboutBtn.hidden = currentProfileStep !== profileEditorSteps.length - 1;

        editAboutModal?.querySelector('.modal-form-body')?.scrollTo({ top: 0, behavior: 'smooth' });
        if (focusPanel) {
            document.getElementById(`modal-panel-${targetTab}`)?.querySelector('input, textarea, select, button')?.focus({ preventScroll: true });
        }
    }

    function canLeaveCurrentProfileStep() {
        const panel = document.getElementById(`modal-panel-${profileEditorSteps[currentProfileStep]}`);
        const invalidField = panel?.querySelector('input:invalid, textarea:invalid, select:invalid');
        if (!invalidField) return true;
        invalidField.reportValidity?.();
        invalidField.focus();
        return false;
    }

    function setupAddressAutocomplete(input) {
        if (!input) return;

        let geography = null;
        let loadPromise = null;
        let activeIndex = -1;
        let debounceTimer = null;

        const normalize = value => String(value || '')
            .toLocaleLowerCase('th-TH')
            .replace(/(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)/g, '')
            .replace(/\s+/g, '')
            .trim();

        const loadGeography = () => {
            if (geography) return Promise.resolve(geography);
            if (!loadPromise) {
                loadPromise = fetch('../../assets/data/thai-geography.json')
                    .then(response => {
                        if (!response.ok) throw new Error('Unable to load Thai geography data');
                        return response.json();
                    })
                    .then(rows => (geography = Array.isArray(rows) ? rows : []))
                    .catch(error => {
                        loadPromise = null;
                        console.error('[MyProfile] Geography load failed:', error);
                        return [];
                    });
            }
            return loadPromise;
        };

        const closeSuggestions = () => {
            input.parentElement.querySelector('.profile-address-suggestions')?.remove();
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
        };

        const selectSuggestion = row => {
            const isBangkok = Number(row.provinceCode) === 10;
            const subdistrictPrefix = isBangkok ? 'แขวง' : 'ตำบล';
            const districtPrefix = isBangkok ? 'เขต' : 'อำเภอ';
            const provinceText = isBangkok ? row.provinceNameTh : `จังหวัด${row.provinceNameTh}`;
            input.value = `${subdistrictPrefix}${row.subdistrictNameTh} ${districtPrefix}${row.districtNameTh} ${provinceText} ${row.postalCode}`;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            closeSuggestions();
        };

        const renderSuggestions = async () => {
            const query = normalize(input.value);
            closeSuggestions();
            if (!query) return;

            const rows = await loadGeography();
            if (normalize(input.value) !== query) return;

            const matches = rows.map(row => {
                const fields = [
                    normalize(row.subdistrictNameTh),
                    normalize(row.districtNameTh),
                    normalize(row.provinceNameTh),
                    normalize(row.subdistrictNameEn),
                    normalize(row.districtNameEn),
                    normalize(row.provinceNameEn),
                    String(row.postalCode || '')
                ];
                const exact = fields.findIndex(value => value === query);
                const prefix = fields.findIndex(value => value.startsWith(query));
                const includes = fields.findIndex(value => value.includes(query));
                const score = exact >= 0 ? exact : prefix >= 0 ? 10 + prefix : includes >= 0 ? 30 + includes : 999;
                return { row, score };
            })
                .filter(item => item.score < 999)
                .sort((a, b) => a.score - b.score || a.row.subdistrictNameTh.localeCompare(b.row.subdistrictNameTh, 'th'))
                .slice(0, 12);

            if (!matches.length) return;

            const list = document.createElement('div');
            list.id = 'profileAddressSuggestions';
            list.className = 'profile-address-suggestions';
            list.setAttribute('role', 'listbox');

            matches.forEach(({ row }, index) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.id = `profileAddressOption${index}`;
                option.className = 'profile-address-suggestion';
                option.setAttribute('role', 'option');
                option.innerHTML = `<strong></strong><small></small>`;
                option.querySelector('strong').textContent = `${row.subdistrictNameTh}, ${row.districtNameTh}`;
                option.querySelector('small').textContent = `${row.provinceNameTh} · ${row.postalCode}`;
                option.addEventListener('pointerdown', event => event.preventDefault());
                option.addEventListener('click', () => selectSuggestion(row));
                list.appendChild(option);
            });

            input.parentElement.appendChild(list);
            input.setAttribute('aria-expanded', 'true');
        };

        const updateActiveOption = options => {
            options.forEach((option, index) => {
                const active = index === activeIndex;
                option.classList.toggle('active', active);
                option.setAttribute('aria-selected', String(active));
            });
            const active = options[activeIndex];
            if (active) {
                input.setAttribute('aria-activedescendant', active.id);
                active.scrollIntoView({ block: 'nearest' });
            }
        };

        input.addEventListener('focus', loadGeography);
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(renderSuggestions, 120);
        });
        input.addEventListener('keydown', event => {
            const options = [...input.parentElement.querySelectorAll('.profile-address-suggestion')];
            if (!options.length) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                activeIndex = event.key === 'ArrowDown'
                    ? (activeIndex + 1) % options.length
                    : (activeIndex - 1 + options.length) % options.length;
                updateActiveOption(options);
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                options[activeIndex].click();
            } else if (event.key === 'Escape') {
                closeSuggestions();
            }
        });
        input.addEventListener('blur', () => setTimeout(closeSuggestions, 100));
    }

    setupAddressAutocomplete(addr2Editor);

    const contactTypeConfig = {
        line: { placeholderKey: 'contact_line_placeholder', placeholder: 'กรอก LINE ID', hintKey: 'contact_line_hint', hint: 'กรอกเฉพาะ LINE ID ได้ ไม่จำเป็นต้องใส่ลิงก์', inputMode: 'text' },
        facebook: { placeholderKey: 'contact_facebook_placeholder', placeholder: 'ชื่อเพจ ชื่อผู้ใช้ หรือลิงก์ Facebook', hintKey: 'contact_facebook_hint', hint: 'ใส่ชื่อเพจหรือชื่อผู้ใช้ได้', inputMode: 'text' },
        website: { placeholder: 'example.com', hintKey: 'contact_website_hint', hint: 'กรอกชื่อเว็บไซต์หรือลิงก์', inputMode: 'url' },
        email: { placeholder: 'name@example.com', hintKey: 'contact_email_hint', hint: 'กรอกอีเมลสำหรับติดต่อเพิ่มเติม', inputMode: 'email' },
        phone: { placeholder: '0812345678', hintKey: 'contact_phone_hint', hint: 'กรอกเบอร์โทรศัพท์เพิ่มเติม', inputMode: 'tel' }
    };

    function updateContactEditor() {
        if (!linkTypeEditor || !linkEditor) return;
        const config = contactTypeConfig[linkTypeEditor.value] || contactTypeConfig.line;
        linkEditor.placeholder = config.placeholderKey && window.i18nT ? window.i18nT(config.placeholderKey, config.placeholder) : config.placeholder;
        linkEditor.inputMode = config.inputMode;
        if (linkEditorHint) linkEditorHint.textContent = config.hintKey && window.i18nT ? window.i18nT(config.hintKey, config.hint) : config.hint;
    }

    linkTypeEditor?.addEventListener('change', updateContactEditor);
    updateContactEditor();

    function openEditModal() {
        if (!editAboutModal) return;
        nameEditor.value = profileData.name || '';
        taglineEditor.value = profileData.tagline || '';
        aboutEditor.value = profileData.about || '';
        phoneEditor.value = profileData.phone || '';
        emailEditor.value = profileData.email || '';
        if (linkEditor) {
            const firstLink = Array.isArray(profileData.links) ? profileData.links[0] : null;
            linkEditor.value = firstLink ? (firstLink.url || firstLink.href || firstLink) : '';
            if (linkTypeEditor) linkTypeEditor.value = firstLink?.link_type || firstLink?.type || 'line';
            updateContactEditor();
        }
        addr1Editor.value = profileData.location?.line1 || '';
        addr2Editor.value = profileData.location?.line2 || '';
        mapLatEditor.value = profileData.location?.lat || '';
        mapLngEditor.value = profileData.location?.lng || '';

        // Services checkboxes
        const checkboxes = document.querySelectorAll('#servicesEditor input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = profileData.services.includes(cb.value);
        });

        activateProfileStep(0);

        editAboutModal.hidden = false;
        document.body.classList.add('profile-editor-open');
        requestAnimationFrame(() => editAboutModal.querySelector('.modal-close-btn')?.focus());
    }

    if (editAboutBtn) editAboutBtn.addEventListener("click", openEditModal);
    function closeEditModal() {
        if (!editAboutModal) return;
        editAboutModal.hidden = true;
        document.body.classList.remove('profile-editor-open');
        editAboutBtn?.focus();
    }

    if (cancelAboutBtn) cancelAboutBtn.addEventListener("click", closeEditModal);
    editAboutModal?.querySelectorAll('[data-close-profile-modal]').forEach(button => button.addEventListener('click', closeEditModal));
    editAboutModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeEditModal);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && editAboutModal && !editAboutModal.hidden) closeEditModal();
    });

    // Modal tab switching logic
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetIndex = profileEditorSteps.indexOf(btn.dataset.modalTab);
            if (targetIndex < 0 || (targetIndex > currentProfileStep && !canLeaveCurrentProfileStep())) return;
            activateProfileStep(targetIndex);
        });
    });

    prevProfileStepBtn?.addEventListener('click', () => activateProfileStep(currentProfileStep - 1, true));
    nextProfileStepBtn?.addEventListener('click', () => {
        if (canLeaveCurrentProfileStep()) activateProfileStep(currentProfileStep + 1, true);
    });

    if (saveAboutBtn) {
        saveAboutBtn.addEventListener("click", async () => {
            const invalidField = editAboutModal?.querySelector('input:invalid, textarea:invalid, select:invalid');
            if (invalidField) {
                const invalidPanel = invalidField.closest('.modal-tab-panel');
                const invalidStep = profileEditorSteps.findIndex(step => invalidPanel?.id === `modal-panel-${step}`);
                if (invalidStep >= 0) activateProfileStep(invalidStep);
                invalidField.reportValidity?.();
                invalidField.focus();
                return;
            }
            const btn = saveAboutBtn;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="material-icons-outlined">hourglass_top</span><span>${esc(t('saving_btn', 'กำลังบันทึก...'))}</span>`;

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
                links: JSON.stringify((linkEditor && linkEditor.value.trim())
                    ? [{ link_type: linkTypeEditor?.value || 'line', url: linkEditor.value.trim() }]
                    : []),
                lat: mapLatEditor.value ? parseFloat(mapLatEditor.value) : null,
                lng: mapLngEditor.value ? parseFloat(mapLngEditor.value) : null,
                services: JSON.stringify(selectedServices)
            };

            try {
                const res = await api.updateProfile(fields);
                if (res) {
                    await syncProfile();
                    closeEditModal();
                    if (window.showToast) window.showToast(t('profile_save_success', 'บันทึกข้อมูลเรียบร้อยแล้ว'));
                } else {
                    throw new Error('Update failed');
                }
            } catch (err) {
                console.error('[MyProfile] Save error:', err);
                if (window.showToast) window.showToast(t('profile_save_failed', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่'));
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
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
                if (window.showToast) window.showToast(t('image_upload_success', 'อัปโหลดรูปภาพสำเร็จ'));
            }
        } catch (err) {
            console.error('[MyProfile] Upload error:', err);
            if (window.showToast) window.showToast(t('image_upload_failed', 'อัปโหลดรูปภาพล้มเหลว'));
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

    async function initMap() {
        if (map) return true;
        try {
            if (window.LeafletReady) await window.LeafletReady;
        } catch (error) {
            window.showAlert?.(error.message || t('map_unavailable', 'ไม่สามารถโหลดแผนที่ได้'), 'warning');
            return false;
        }
        if (!window.L?.map) {
            window.showAlert?.(t('map_unavailable', 'ไม่สามารถโหลดแผนที่ได้'), 'warning');
            return false;
        }
        const lat = parseFloat(mapLatEditor.value) || 13.7563;
        const lng = parseFloat(mapLngEditor.value) || 100.5018;

        map = window.L.map('leafletMapDiv').setView([lat, lng], 13);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        marker = window.L.marker([lat, lng], { draggable: true }).addTo(map);

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
        return true;
    }

    if (openMapPickerBtn) {
        openMapPickerBtn.addEventListener('click', () => {
            const isHidden = mapPickerContainer.style.display === 'none';
            mapPickerContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                setTimeout(async () => {
                    const ready = await initMap();
                    if (ready) map.invalidateSize();
                }, 100);
            }
        });
    }

    if (getCurrentLocationBtn) {
        getCurrentLocationBtn.addEventListener('click', async () => {
            try {
                let pos = null;
                if (window.AgriPermission?.requestLocation) {
                    const res = await window.AgriPermission.requestLocation();
                    if (res.granted && res.position) pos = res.position;
                } else if (navigator.geolocation) {
                    pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 300000 });
                    });
                } else {
                    window.showAlert?.(t('geolocation_not_supported', 'เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง'), 'warning');
                    return;
                }

                if (!pos) {
                    window.showAlert?.(t('location_access_failed', 'ไม่สามารถเข้าถึงตำแหน่งของคุณได้'), 'error');
                    return;
                }

                const coords = pos.coords || pos;
                const lat = coords.latitude;
                const lng = coords.longitude;
                mapLatEditor.value = lat.toFixed(6);
                mapLngEditor.value = lng.toFixed(6);
                if (map) {
                    map.setView([lat, lng], 15);
                    marker.setLatLng([lat, lng]);
                }
            } catch (_) {
                window.showAlert?.(t('location_access_failed', 'ไม่สามารถเข้าถึงตำแหน่งของคุณได้'), 'error');
            }
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const addPurchaseBtn = document.getElementById('addPurchaseBtn');
    const profileOfferLimitModal = document.getElementById('profileOfferLimitModal');
    const profileOfferLimitClose = document.getElementById('profileOfferLimitClose');
    const profileOfferLimitPlan = document.getElementById('profileOfferLimitPlan');
    const profileOfferLimitUsage = document.getElementById('profileOfferLimitUsage');
    const profileOfferLimitFill = document.getElementById('profileOfferLimitFill');
    const profileOfferLimitUpgrade = document.getElementById('profileOfferLimitUpgrade');
    const profileOfferLimitManage = document.getElementById('profileOfferLimitManage');

    function openProfileOfferLimit(usage = {}) {
        if (!profileOfferLimitModal) return;
        const tier = String(usage.tier || 'free').toLowerCase();
        const limit = Number(usage.limit || (tier === 'pro' ? 10 : 3));
        const used = Math.max(0, Number(usage.activeCount ?? limit));
        profileOfferLimitPlan.textContent = t(tier === 'pro' ? 'current_pro_plan' : 'current_free_plan', tier.toUpperCase());
        profileOfferLimitUsage.textContent = t('offer_limit_usage', `${used} / ${limit}`, { used, limit });
        profileOfferLimitFill.style.width = `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%`;
        profileOfferLimitUpgrade.hidden = tier === 'pro';
        profileOfferLimitModal.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => profileOfferLimitClose?.focus());
    }

    function closeProfileOfferLimit() {
        if (!profileOfferLimitModal) return;
        profileOfferLimitModal.hidden = true;
        document.body.style.overflow = '';
        addPurchaseBtn?.focus();
    }

    profileOfferLimitClose?.addEventListener('click', closeProfileOfferLimit);
    profileOfferLimitModal?.addEventListener('click', event => {
        if (event.target === profileOfferLimitModal) closeProfileOfferLimit();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && profileOfferLimitModal && !profileOfferLimitModal.hidden) closeProfileOfferLimit();
    });
    profileOfferLimitUpgrade?.addEventListener('click', () => { window.location.href = '../account/subscription.html'; });
    profileOfferLimitManage?.addEventListener('click', () => {
        closeProfileOfferLimit();
        document.getElementById('productListContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    if (addPurchaseBtn) {
        addPurchaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const tier = (profileData.tier || 'free').toLowerCase();
            const limit = tier === 'pro' ? 10 : 3;
            const currentCount = profileData.products ? profileData.products.filter(p => p.is_active !== false).length : 0;
            if (currentCount >= limit) {
                openProfileOfferLimit({ tier, limit, activeCount: currentCount });
            } else {
                window.location.href = "setbooking/setbooking-step1.html";
            }
        });
    }

    // Initial load
    let realtimeOfferTimer = null;
    window.addEventListener('agriprice:realtime:offer', () => {
        clearTimeout(realtimeOfferTimer);
        realtimeOfferTimer = setTimeout(loadProducts, 120);
    });

    init();
});
