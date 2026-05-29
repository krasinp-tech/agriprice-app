(function initFavoritesPage() {
  const mount = document.getElementById('favoritesMount');
  const emptyEl = document.getElementById('emptyState');
  const helpers = window.FavoritesHelpers;

  if (!mount || !helpers) return;

  let ALL_ITEMS = [];
  let CURRENT_FILTER = 'all';

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : fallback;
  }

  async function loadTemplate() {
    const res = await fetch('../../components/product-card/product-card.html?v=20260528');
    const html = await res.text();
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.querySelector('#productCardTpl');
  }

  async function fetchAllFavorites() {
    const fromApi = await helpers.fetchFavoritesFromApi();
    const fromStore = helpers.loadFavoritesFromStore();
    
    // Merge and dedupe
    const merged = [
      ...(Array.isArray(fromApi) ? fromApi : []),
      ...(Array.isArray(fromStore) ? fromStore : [])
    ];

    const seen = new Set();
    return merged.filter(item => {
      const id = item.id || item.productId || item.sellerId || item.favoriteId;
      const kind = item.kind || 'seller';
      const key = `${kind}:${id}`;
      if (!id || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function render(items) {
    const filtered = items.filter(item => {
      if (CURRENT_FILTER === 'all') return true;
      return (item.kind || 'seller') === CURRENT_FILTER;
    });

    if (filtered.length === 0) {
      mount.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    mount.innerHTML = '';
    
    loadTemplate().then(tpl => {
      filtered.forEach(item => {
        const card = tpl.content.firstElementChild.cloneNode(true);
        
        // Map data
        card.dataset.sellerId = item.sellerId || item.id;
        card.dataset.productId = item.productId || (item.kind === 'product' ? item.id : '');
        card.dataset.sellerName = item.sellerName || item.title || '';
        card.dataset.favoriteId = item.id;
        card.dataset.favoriteKind = item.kind || 'seller';
        
        const avatar = card.querySelector('[data-bind="avatar"]');
        if (avatar) {
          const rawAvatar = item.avatar || '';
          let finalSrc = '../../assets/images/avatar-guest.svg';
          
          if (rawAvatar) {
            if (rawAvatar.startsWith('http') || rawAvatar.startsWith('data:')) {
              finalSrc = rawAvatar;
            } else if (rawAvatar.startsWith('/uploads') || rawAvatar.startsWith('uploads')) {
              const base = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : '';
              finalSrc = base + (rawAvatar.startsWith('/') ? '' : '/') + rawAvatar;
            } else if (rawAvatar.includes('assets/images')) {
              finalSrc = '../../' + rawAvatar.substring(rawAvatar.indexOf('assets/images'));
            }
          }
          avatar.src = finalSrc;
          avatar.onerror = () => { avatar.src = '../../assets/images/avatar-guest.svg'; avatar.onerror = null; };
        }
        
        card.querySelector('[data-bind="sellerName"]').textContent = item.sellerName || item.title || t('unknown', 'ไม่ทราบชื่อ');
        card.querySelector('[data-bind="sellerSub"]').textContent = item.sellerSub || item.sub || item.productName || '';
        
        // Prices
        ['A', 'B', 'C'].forEach(g => {
          const el = card.querySelector(`[data-bind="price${g}"]`);
          const price = item[`price${g}`];
          if (el) {
            if (price) el.textContent = price;
            else el.closest('.pc-grade-box, .price-box')?.remove();
          }
        });

        const distEl = card.querySelector('[data-bind="distance"]');
        if (distEl) distEl.textContent = item.distance || '';
        
        const timeEl = card.querySelector('[data-bind="updateTime"]');
        if (timeEl) timeEl.textContent = item.updateTime || '';

        // Active heart icon
        const favBtn = card.querySelector('[data-action="toggle-favorite"]');
        if (favBtn) favBtn.classList.add('active');

        mount.appendChild(card);
      });
    });
  }

  // Click handler delegation
  mount.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    
    if (action === 'open-profile') {
      const uid = card.dataset.sellerId;
      const name = card.dataset.sellerName;
      const q = uid ? `uid=${encodeURIComponent(uid)}` : `name=${encodeURIComponent(name)}`;
      window.location.href = `profile.html?${q}`;
    }
    
    if (action === 'book') {
      localStorage.setItem("bookingReferrer", window.location.href);
      if (card.dataset.sellerId) localStorage.setItem("bookingFarmerId", card.dataset.sellerId);
      if (card.dataset.sellerName) localStorage.setItem("bookingFarmerName", card.dataset.sellerName);
      if (card.dataset.productId) localStorage.setItem("bookingProductId", card.dataset.productId);
      
      const role = (JSON.parse(localStorage.getItem('user_data') || '{}').role || 'farmer').toLowerCase();
      const next = role === 'buyer' ? '../buyer/setbooking/booking.html' : '../farmer/booking/booking-step1.html';
      window.location.href = next;
    }

    if (action === 'contact') {
      const targetId = card.dataset.sellerId;
      if (!targetId) return;
      window.location.href = `chat.html?targetId=${encodeURIComponent(targetId)}`;
    }

    if (action === 'toggle-favorite') {
      const id = card.dataset.favoriteId;
      const kind = card.dataset.favoriteKind;
      if (window.FavoritesStore) {
        window.FavoritesStore.remove(id, undefined, kind);
        card.remove();
        if (mount.children.length === 0) emptyEl.style.display = 'block';
      }
    }
  });

  async function init() {
    ALL_ITEMS = await fetchAllFavorites();
    render(ALL_ITEMS);
  }

  window.addEventListener('favorites:changed', async () => {
    ALL_ITEMS = await fetchAllFavorites();
    render(ALL_ITEMS);
  });

  init();
})();
