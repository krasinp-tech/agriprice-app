document.addEventListener("DOMContentLoaded", function () {

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

    /* ==========================================================
       🔶 MOCK DATA
       ========================================================== */
    let profileData = {
        name: "ล้งกนก ผลไม้หลังสวน",
        tagline: "รับซื้อผลไม้สดถึงสวน • ให้บริการ 15 ปี",
        followers: 358,
        // หมายเหตุ: หน้าอยู่ที่ pages/buyer/* => ต้องถอย 2 ชั้นไปหา assets/
        heroImage: "../../assets/images/Gemini_Generated_Image_30unn130unn130un.png",
        avatar: "../../assets/images/ล้งกนก ผลไม้หลังสวน.png",
        about: "ล้งกนก ดำเนินธุรกิจรับซื้อผลไม้สดมากว่า 15 ปี ประสบการณ์ในการคัดเลือกผลไม้คุณภาพดี ให้ราคาที่เป็นธรรม และมีบริการรับซื้อถึงสวน สะดวกสำหรับเกษตรกร พร้อมจ่ายเงินสดทันที",
        phone: "0902866361",
        email: "nokianokia1235@gmail.com",
        links: ["https://www.youtube.com/"],
        location: {
            line1: "123/45 หมู่ 2 ตำบลบางแก้ว",
            line2: "อำเภอบางพลี จังหวัดชุมพร 10540",
            mapEmbed: "https://maps.google.com/maps?q=ชุมพร,Thailand&z=13&output=embed",
            mapLink: "https://maps.google.com/?q=ชุมพร,Thailand"
        },
        services: [
            { icon: "agriculture", color: "green", name: "รับซื้อถึงสวน", desc: "บริการรับซื้อผลไม้ถึงบ้านเกษตรกร" },
            { icon: "payments", color: "money", name: "จ่ายเงินสด", desc: "จ่ายเงินสดทันทีตามน้ำหนัก" },
            { icon: "verified", color: "orange", name: "ตรวจสอบคุณภาพ", desc: "มีผู้เชี่ยวชาญตรวจสอบคุณภาพผลไม้" },
            { icon: "calendar_month", color: "purple", name: "จองคิวล่วงหน้า", desc: "สามารถนัดหมายล่วงหน้าได้" }
        ],
        products: [
            {
                fruit: "ทุเรียน หมอนทอง",
                prices: { A: 180, B: 160, C: 120 },
                distance: "7 กม.",
                update: "32 นาที"
            },
            {
                fruit: "มังคุด",
                prices: { A: 150, B: 130, C: 100 },
                distance: "7 กม.",
                update: "40 นาที"
            }
        ],
        reviews: [
            { name: "สมชาย ใจดี", date: "2 ธ.ค. 2567", rating: 5, text: "ราคาดี บริการถึงสวน จ่ายเงินสดทันที" },
            { name: "มาลี สุขสันต์", date: "28 พ.ย. 2567", rating: 5, text: "ราคายุติธรรม แนะนำเลยค่ะ" },
            { name: "วิชัย เกษตรกร", date: "20 พ.ย. 2567", rating: 4, text: "โดยรวมดีครับ มาตรงเวลา" }
        ]
    };

    // load saved profile from localStorage
    try {
        const parsed = loadProfileFromStorage();
        if (parsed) {
            profileData = Object.assign({}, profileData, parsed);
        }
    } catch (e) { console.error('Failed to load saved profile', e); }

    /* ==========================================================
       🔶 RENDER PROFILE INFO
       ========================================================== */
    document.getElementById("profileName").textContent = profileData.name;
    document.getElementById("profileTagline").textContent = profileData.tagline;
    document.getElementById("followersCount").textContent = profileData.followers;
    document.getElementById("heroImage").src = profileData.heroImage;
    
    // ✅ โหลดรูป avatar จาก localStorage ก่อน (sync กับ account)
    try {
        const savedAvatar = loadAvatarFromStorage();
        if (savedAvatar && !savedAvatar.includes('assets/images')) {
            profileData.avatar = savedAvatar;
        }
    } catch (_) {}
    
    document.getElementById("profileAvatar").src = profileData.avatar;
    document.getElementById("aboutDesc").textContent = profileData.about;

    // Change button label to match image
    const editAboutBtnEl = document.getElementById('editAboutBtn');
    if (editAboutBtnEl) {
        editAboutBtnEl.innerHTML = `<span class="material-icons-outlined">edit</span> แก้ไขโปรไฟล์`;
    }
    const addPurchaseBtnEl = document.getElementById('addPurchaseBtn');
    if (addPurchaseBtnEl) {
        addPurchaseBtnEl.innerHTML = `<span class="material-icons-outlined">add_circle</span> + เพิ่มการรับซื้อ`;
    }

    // Update review tab count to 127 to match design
    const reviewCountEl = document.getElementById("reviewCount");
    if (reviewCountEl) reviewCountEl.textContent = "(127)";

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
    document.getElementById("addressLine2").textContent = profileData.location.line2;
    document.getElementById("mapIframe").src = profileData.location.mapEmbed;
    document.getElementById("mapLink").href = profileData.location.mapLink;

    function saveProfileData() {
        saveProfileToStorage(profileData);
    }

    /* ==========================================================
       🔶 RENDER SERVICES (inject after location-card)
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

    /* ==========================================================
       🔶 RENDER PRODUCTS
       ========================================================== */
    const productContainer = document.getElementById("productListContainer");

    function renderProductsTo(container) {
        if (!container) return;
        container.innerHTML = "";
        profileData.products.forEach((product, idx) => {
            const card = document.createElement("div");
            card.className = "product-card";
            card.dataset.isOpen = "true";
            card.dataset.index = String(idx);

            card.innerHTML = `
                <div class="product-header">
                    <div class="seller-info" style="cursor:default">
                        <div class="seller-avatar">
                            <img src="${profileData.avatar}">
                        </div>
                        <div class="seller-text">
                            <div class="seller-name">${profileData.name}</div>
                            <div class="seller-sub">${product.fruit}</div>
                        </div>
                    </div>
                </div>
                <div class="price-row">
                    ${Object.keys(product.prices || {}).map(g =>
                        `<div class="price-box">
                            <div class="grade">${g}</div>
                            <div class="price">${product.prices[g]} บ.กก.</div>
                        </div>`
                    ).join("")}
                </div>
                <div class="meta-row">
                    <div class="distance">○ ระยะทาง ${product.distance}</div>
                    <div class="update-time">อัปเดท ${product.update}</div>
                </div>
                <div class="action-row">
                    <button class="btn-contact" type="button" data-action="toggle-status">
                        <span class="status-text">ปิด การรับซื้อ</span>
                    </button>
                    <button class="btn-book" type="button" data-action="edit-purchase">แก้ไขการรับซื้อ</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderProductsTo(productContainer);

    /* ==========================================================
       🔶 ELEMENTS
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
    const mapLinkEditor = document.getElementById('mapLinkEditor');
    const linksEditor = document.getElementById('linksEditor');
    const saveAboutBtn = document.getElementById('saveAboutBtn');
    const cancelAboutBtn = document.getElementById('cancelAboutBtn');
    const reviewProductsPlaceholder = document.getElementById('reviewProductsPlaceholder');
    const reviewListContainer = document.getElementById("reviewListContainer");
    let reviewInjected = false;

    // Close modal
    if (editAboutModal) {
        const backdrop = editAboutModal.querySelector('.modal-backdrop');
        if (backdrop) backdrop.addEventListener('click', () => { editAboutModal.hidden = true; });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !editAboutModal.hidden) editAboutModal.hidden = true;
        });
    }

    /* ==========================================================
       🔶 PRODUCT CARD ACTIONS
       ========================================================== */
    document.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const card = btn.closest(".product-card");
        if (!card) return;
        const action = btn.dataset.action;

        if (action === "toggle-status") {
            const isOpen = card.dataset.isOpen !== "false";
            card.dataset.isOpen = !isOpen;
            const statusText = card.querySelector(".status-text");
            if (statusText) statusText.textContent = isOpen ? "เปิด การรับซื้อ" : "ปิด การรับซื้อ";
            btn.classList.toggle("active", !isOpen);
            return;
        }

        if (action === "edit-purchase") {
            const idx = Number(card.dataset.index);
            const product = profileData.products[idx];
            // หน้าอยู่ที่ pages/buyer/myprofile.html => ไป setbooking ในโฟลเดอร์เดียวกัน
            if (!product) { window.location.href = "setbooking/setbooking-step1.html"; return; }
            const gradesArr = Object.entries(product.prices || {}).map(([grade, price]) => ({ grade, price }));
            const payload = {
                product: { id: `local-${idx}`, name: product.fruit },
                variety: null, details: "",
                grades: gradesArr,
                createdAt: new Date().toISOString(),
                editSource: { page: "myprofile", index: idx }
            };
            try { sessionStorage.setItem("setbooking_step1", JSON.stringify(payload)); } catch (err) {}
            window.location.href = "setbooking/setbooking-step1.html";
        }
    });

    /* ==========================================================
       🔶 ACTION ROW BUTTONS
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
        mapLinkEditor.value = profileData.location?.mapLink || profileData.location?.mapEmbed || '';
        linksEditor.value = (profileData.links || []).join('\n');
        editAboutModal.hidden = false;
    }

    if (editAboutBtn) editAboutBtn.addEventListener("click", openEditModal);
    if (editProfileCardBtn) editProfileCardBtn.addEventListener('click', openEditModal);
    if (addPurchaseBtn) addPurchaseBtn.addEventListener("click", () => {
        window.location.href = "setbooking/setbooking-step1.html";
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
                if (tab === 'reviews') {
                    setTimeout(() => checkReviewsScroll(), 220);
                } else {
                    if (reviewProductsPlaceholder) {
                        reviewProductsPlaceholder.innerHTML = '';
                        reviewInjected = false;
                    }
                }
            });
        });
    }

    function checkReviewsScroll() {
        try {
            if (!reviewProductsPlaceholder || !reviewListContainer) return;
            const activeTab = document.querySelector('.profile-tabs .tab-btn.active')?.dataset.tab;
            if (activeTab !== 'reviews') return;
            const rect = reviewListContainer.getBoundingClientRect();
            if (rect.bottom <= window.innerHeight + 24 && !reviewInjected) {
                renderProductsTo(reviewProductsPlaceholder);
                reviewInjected = true;
            }
        } catch (e) {}
    }

    window.addEventListener('scroll', () => window.requestAnimationFrame(checkReviewsScroll));

    // Cover upload
    if (editCoverBtn && coverInput) {
        editCoverBtn.addEventListener('click', () => coverInput.click());
        coverInput.addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
                alert('รูปปกใหญ่เกินไป (เกิน 5MB)');
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
                alert('รูปใหญ่เกินไป (เกิน 3MB)');
                avatarInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                profileData.avatar = dataUrl;
                document.getElementById('profileAvatar').src = dataUrl;
                
                // ✅ บันทึกใน localStorage key เดียวกับ account
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
        // ✅ บันทึกชื่อและ tagline
        if (nameEditor) profileData.name = nameEditor.value || '';
        if (taglineEditor) profileData.tagline = taglineEditor.value || '';
        
        profileData.about = aboutEditor.value || '';
        profileData.phone = phoneEditor.value || '';
        profileData.email = emailEditor.value || '';
        profileData.location = profileData.location || {};
        profileData.location.line1 = addr1Editor.value || '';
        profileData.location.line2 = addr2Editor.value || '';
        profileData.location.mapLink = mapLinkEditor.value || '';
        profileData.links = (linksEditor.value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

        // ✅ อัพเดทชื่อและ tagline บนหน้า
        document.getElementById('profileName').textContent = profileData.name || '';
        document.getElementById('profileTagline').textContent = profileData.tagline || '';
        
        document.getElementById('aboutDesc').textContent = profileData.about;
        document.getElementById('addressLine1').textContent = profileData.location.line1 || '';
        document.getElementById('addressLine2').textContent = profileData.location.line2 || '';
        document.getElementById('mapLink').href = profileData.location.mapLink || '';
        document.getElementById('mapIframe').src = profileData.location.mapEmbed || profileData.location.mapLink || '';
        renderContact();
        saveProfileData();
        editAboutModal.hidden = true;
    });

    /* ==========================================================
       🔶 RENDER REVIEWS
       ========================================================== */
    profileData.reviews.forEach(r => {
        const item = document.createElement("div");
        item.className = "review-item";
        item.innerHTML = `
            <div class="review-header">
                <div class="reviewer-avatar">👤</div>
                <div>
                    <div class="reviewer-name">${r.name}</div>
                    <div class="reviewer-date">${r.date}</div>
                </div>
                <div class="review-rating">
                    ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}
                </div>
            </div>
            <div class="review-text">${r.text}</div>
        `;
        reviewListContainer.appendChild(item);
    });

    /* ==========================================================
       🔶 APPLY SAVED BOOKING PAYLOAD
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