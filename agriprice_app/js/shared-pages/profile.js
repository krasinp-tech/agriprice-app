document.addEventListener("DOMContentLoaded", function () {

    // ===== role helper =====
    function getRole() {
        try {
            const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
            const u = raw ? JSON.parse(raw) : null;
            if (u && u.role) return String(u.role).toLowerCase();
        } catch (_) {}
        return (localStorage.getItem("role") || "farmer").toLowerCase();
    }

    /* ==========================================================
       🔶 MOCK DATA (จำลองข้อมูล รอเชื่อมต่อ DATABASE)
       ========================================================== */
    const profileData = {
        name: "ล้งกนก ผลไม้หลังสวน",
        tagline: "รับซื้อผลไม้สดถึงสวน • ให้บริการ 15 ปี",
        followers: 358,
        // หน้าอยู่ที่ pages/shared/* => ต้องถอย 2 ชั้นไปหา assets/
        heroImage: "../../assets/images/Gemini_Generated_Image_30unn130unn130un.png",
        avatar: "../../assets/images/ล้งกนก ผลไม้หลังสวน.png",
        badgeTitle: "สวนทุเรียน",
        badgeSub: "ชุมพร",
        about: "ล้งกนก ดำเนินธุรกิจรับซื้อผลไม้สดมากว่า 15 ปี ให้ราคายุติธรรม โปร่งใส จ่ายเงินสดทันที",
        location: {
            line1: "123/45 หมู่ 2 ตำบลบางแก้ว",
            line2: "อำเภอบางพลี จังหวัดชุมพร 10540",
            mapEmbed: "https://maps.google.com/maps?q=ชุมพร,Thailand&z=13&output=embed",
            mapLink: "https://maps.google.com/?q=ชุมพร,Thailand"
        },
        products: [
            {
                id: "card-durian-1",
                fruit: "ทุเรียน หมอนทอง",
                prices: { A: 180, B: 160, C: 120 },
                distance: "7 กม.",
                update: "32 นาที"
            },
            {
                id: "card-durian-2",
                fruit: "ทุเรียน ก้านยาว",
                prices: { A: 176, B: 158, C: 118 },
                distance: "8 กม.",
                update: "35 นาที"
            },
            {
                id: "card-longkong-1",
                fruit: "ลองกอง",
                prices: { A: 78, B: 62, C: 48 },
                distance: "6 กม.",
                update: "25 นาที"
            },
            {
                id: "card-durian-3",
                fruit: "ทุเรียน ชะนี",
                prices: { A: 170, B: 152, C: 112 },
                distance: "10 กม.",
                update: "29 นาที"
            },
            {
                id: "card-mixed-1",
                fruit: "ผลไม้รวมฤดูกาล",
                prices: { A: 95, B: 82, C: 68 },
                distance: "9 กม.",
                update: "41 นาที"
            },
            {
                id: "card-durian-4",
                fruit: "ทุเรียน พวงมณี",
                prices: { A: 168, B: 150, C: 110 },
                distance: "11 กม.",
                update: "46 นาที"
            }
        ],
        reviews: [
            { name: "สมชาย ใจดี", date: "2 ธ.ค. 2567", rating: 5, text: "ราคาดี บริการถึงสวน จ่ายเงินสดทันที" },
            { name: "มาลี สุขสันต์", date: "28 พ.ย. 2567", rating: 5, text: "ราคายุติธรรม แนะนำเลยค่ะ" },
            { name: "วิชัย เกษตรกร", date: "20 พ.ย. 2567", rating: 4, text: "โดยรวมดีครับ มาตรงเวลา" }
        ]
    };

    /* ==========================================================
       🔶 RENDER PROFILE INFO
       ========================================================== */

    document.getElementById("profileName").textContent = profileData.name;
    document.getElementById("profileTagline").textContent = profileData.tagline;
    document.getElementById("followersCount").textContent = profileData.followers;
    document.getElementById("heroImage").src = profileData.heroImage;
    document.getElementById("profileAvatar").src = profileData.avatar;
    document.getElementById("heroBadgeTitle").textContent = profileData.badgeTitle;
    document.getElementById("heroBadgeSub").textContent = profileData.badgeSub;
    document.getElementById("aboutDesc").textContent = profileData.about;

    document.getElementById("addressLine1").textContent = profileData.location.line1;
    document.getElementById("addressLine2").textContent = profileData.location.line2;
    document.getElementById("mapIframe").src = profileData.location.mapEmbed;
    document.getElementById("mapLink").href = profileData.location.mapLink;

    document.getElementById("reviewCount").textContent =
        "(" + profileData.reviews.length + ")";

    /* ==========================================================
       🔶 RENDER PRODUCTS
       ========================================================== */

    const productContainer = document.getElementById("productListContainer");
    const role = getRole();
    const isBuyer = role === "buyer";

    profileData.products.forEach(product => {

        const card = document.createElement("div");
        card.className = "product-card";
        // ✅ เพิ่ม id เพื่อ scroll to card
        if (product.id) {
            card.id = product.id;
        }

        let actionHtml = `<div class="action-row" data-actions>`;

        // ถ้าไม่ใช่ buyer ให้แสดงปุ่มส่งข้อความและ/หรือจองคิวตามสิทธิ์
        if (!isBuyer) {
            actionHtml += `
                <button class="btn-contact" type="button" data-action="contact">ติดต่อ</button>
                <button class="btn-book" type="button" data-action="book">จองคิว</button>
            `;
        }

        actionHtml += `</div>`;

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
                ${["A","B","C"].map(g =>
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

            ${actionHtml}
        `;

        productContainer.appendChild(card);
    });


    /* ==========================================================
       🔶 EVENT: BOOKING BUTTON (บันทึก referrer)
       ========================================================== */
    
    productContainer.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const role = getRole();

        // buyer ห้าม book/contact
        if (role === 'buyer' && (action === 'book' || action === 'contact')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (action === 'book') {
            e.preventDefault();
            localStorage.setItem("bookingReferrer", window.location.href);
            window.location.href =
                role === "buyer"
                    ? "../buyer/setbooking/booking.html"
                    : "../farmer/booking/booking-step1.html";
            return;
        }

        if (action === 'contact') {
            e.preventDefault();
            console.log('contact clicked');
        }
    });

    /* ==========================================================
       🔶 RENDER REVIEWS
       ========================================================== */

    const reviewContainer = document.getElementById("reviewListContainer");

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
                <div class="review-rating" style="margin-left:auto">
                    ${"★".repeat(r.rating)}${"☆".repeat(5-r.rating)}
                </div>
            </div>
            <div class="review-text">${r.text}</div>
        `;

        reviewContainer.appendChild(item);
    });

    /* ==========================================================
       🔶 SCROLL TO CARD (from favorites)
       ========================================================== */
    const urlParams = new URLSearchParams(window.location.search);
    const scrollToCardId = urlParams.get('scrollTo');
    
    if (scrollToCardId) {
        // รอให้ DOM render เสร็จ
        setTimeout(() => {
            const targetCard = document.getElementById(scrollToCardId);
            if (targetCard) {
                targetCard.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                // เพิ่ม highlight effect
                targetCard.style.transition = 'box-shadow 0.3s ease';
                targetCard.style.boxShadow = '0 0 0 3px rgba(11, 133, 60, 0.4)';
                setTimeout(() => {
                    targetCard.style.boxShadow = '';
                }, 1500);
            }
        }, 300);
    }

});

