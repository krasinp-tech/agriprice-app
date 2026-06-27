/**
 * Home Page Controller - AgriPrice v3
 */
(function() {
    const state = window.AgriState;
    const router = window.AgriRouter;
    const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

    async function fetchOffers() {
        const mount = document.getElementById('offersMount');
        try {
            const res = await fetch(`${API_BASE}/offers`);
            const json = await res.json();
            
            if (json.success) {
                renderOffers(json.data.data);
            }
        } catch (err) {
            console.error('[Home] Fetch error:', err);
            mount.innerHTML = `<div class="empty-state">
                <span class="material-icons-outlined">error_outline</span>
                <p>ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>
            </div>`;
        }
    }

    function renderOffers(offers) {
        const mount = document.getElementById('offersMount');
        if (!offers || offers.length === 0) {
            mount.innerHTML = `<div class="empty-state">
                <span class="material-icons-outlined">inventory_2</span>
                <p>ยังไม่มีประกาศรับซื้อในขณะนี้</p>
            </div>`;
            return;
        }

        mount.innerHTML = '';
        offers.forEach(offer => {
            const card = document.createElement('buy-offer-card');
            card.setAttribute('id', offer.id);
            card.setAttribute('title', offer.title);
            card.setAttribute('price', offer.base_price);
            card.setAttribute('unit', offer.unit);
            card.setAttribute('category', offer.category);
            card.setAttribute('image', offer.image_url || 'assets/images/default.png');
            
            const buyer = offer.profiles || {};
            card.setAttribute('buyer-name', `${buyer.first_name} ${buyer.last_name}`);
            card.setAttribute('buyer-avatar', buyer.avatar || 'assets/images/avatar-buyer.svg');
            
            // Add click listener for navigation
            card.addEventListener('click', () => {
                router.navigate(`pages/shared/offer-detail.html?id=${offer.id}`);
            });

            mount.appendChild(card);
        });
    }

    function initUserHeader() {
        const user = state.getState().user;
        const label = document.getElementById('userNameLabel');
        if (user && label) {
            const name = user.first_name || '';
            const welcomeText = window.i18nT ? window.i18nT('welcome_user', 'ยินดีต้อนรับคุณ {name}').replace('{name}', name) : `ยินดีต้อนรับคุณ ${name}`;
            label.textContent = welcomeText;
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        initUserHeader();
        fetchOffers();
        
        // Listen for state changes
        state.subscribe((newState) => {
            initUserHeader();
        });
    });
})();
