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
    const res = await fetch('../../components/product-card/product-card.html');
    const html = await res.text();
    const holder = document.createElement('div');
    holder.innerHTML = html;
    return holder.querySelector('#productCardTpl');
  }

  function formatProductPrices(product) {
    const prices = { priceA: '', priceB: '', priceC: '' };
    const grades = Array.isArray(product?.grades)
      ? product.grades
      : (Array.isArray(product?.product_grades) ? product.product_grades : []);

    const unitLabel = window.i18nT ? window.i18nT('unit_baht', 'Baht') : 'Baht';
    const unit = product?.unit || '';
    const suffix = unit ? `${unitLabel}/${unit}` : unitLabel;

    grades.forEach(grade => {
      const label = String(grade?.grade_name || grade?.grade || 'A').toUpperCase();
      const price = Number(grade?.price || 0);
      if (!price) return;
      const text = `${price} ${suffix}`;
      if (label === 'B') prices.priceB = text;
      else if (label === 'C') prices.priceC = text;
      else prices.priceA = text;
    });

    if (!prices.priceA && Number(product?.price || 0)) {
      prices.priceA = `${Number(product.price)} ${suffix}`;
    }

    return prices;
  }

  async function enrichProductFavorites(items) {
    if (!window.api?.getProduct) return items;

    return Promise.all(items.map(async item => {
      const kind = item.kind || 'seller';
      const productId = item.offerId || item.offer_id || item.productId || (kind === 'product' ? item.id : '');
      const hasAnyPrice = !!(item.priceA || item.priceB || item.priceC);
      const needsProduct = kind === 'product' && productId && (!item.sellerId || !hasAnyPrice);
      if (!needsProduct) return item;

      try {
        const res = await window.api.getProduct(productId);
        const product = res?.data || res;
        if (!product) return item;

        const profile = Array.isArray(product.profiles) ? product.profiles[0] : product.profiles;
        const sellerName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
        const productName = product.variety ? `${product.name || ''} (${product.variety})`.trim() : (product.name || '');
        const prices = formatProductPrices(product);
        const sellerId = item.sellerId || item.profileId || product.user_id || profile?.profile_id || '';

        return {
          ...item,
          sellerId,
          profileId: item.profileId || sellerId,
          sellerName: item.sellerName || sellerName || item.title || '',
          productName: item.productName || productName || item.sub || item.subtitle || '',
          subtitle: item.subtitle || productName || item.productName || '',
          avatar: item.avatar || profile?.avatar || product.image || '',
          priceA: item.priceA || prices.priceA,
          priceB: item.priceB || prices.priceB,
          priceC: item.priceC || prices.priceC,
        };
      } catch (_) {
        return item;
      }
    }));
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
    const unique = merged.filter(item => {
      const kind = item.kind || 'seller';
      const id = kind === 'product'
        ? (item.offerId || item.offer_id || item.productId || item.id || item.favoriteId)
        : (item.sellerId || item.profileId || item.id || item.favoriteId);
      const key = `${kind}:${id}`;
      if (!id || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return enrichProductFavorites(unique);
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
        const kind = item.kind || 'seller';
        const productId = item.offerId || item.offer_id || item.productId || (kind === 'product' ? item.id : '');
        const sellerId = item.sellerId || item.profileId || (kind === 'seller' ? item.id : '');
        const favoriteId = kind === 'product' ? productId : sellerId;
        
        // Map data
        card.dataset.sellerId = sellerId;
        card.dataset.offerId = productId;
        card.dataset.productId = productId;
        card.dataset.sellerName = item.sellerName || item.title || '';
        card.dataset.favoriteId = favoriteId;
        card.dataset.favoriteKind = kind;
        
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
      if (!uid && !name) return;
      const q = uid ? `uid=${encodeURIComponent(uid)}` : `name=${encodeURIComponent(name)}`;
      window.location.href = `profile.html?${q}`;
    }
    
    if (action === 'book') {
      localStorage.setItem("bookingReferrer", window.location.href);
      if (card.dataset.sellerId) localStorage.setItem("bookingFarmerId", card.dataset.sellerId);
      if (card.dataset.sellerName) localStorage.setItem("bookingFarmerName", card.dataset.sellerName);
      const offerId = card.dataset.offerId || card.dataset.productId;
      if (offerId) {
        localStorage.setItem("bookingOfferId", offerId);
        localStorage.setItem("bookingProductId", offerId);
      }
      
      const role = (JSON.parse(localStorage.getItem('user_data') || '{}').role || 'farmer').toLowerCase();
      const next = role === 'buyer' ? '../buyer/setbooking/booking.html' : '../farmer/booking/booking-step1.html';
      window.location.href = next;
    }

    if (action === 'contact') {
      const targetId = card.dataset.sellerId;
      if (!targetId) {
        if (window.appNotify) window.appNotify(t('chat_not_available', 'ไม่พบข้อมูลสำหรับการแชท'), 'warning');
        return;
      }
      window.location.href = `chat.html?targetId=${encodeURIComponent(targetId)}`;
    }

    if (action === 'toggle-favorite') {
      const id = card.dataset.favoriteId;
      const kind = card.dataset.favoriteKind;
      if (window.FavoritesStore) {
        card.remove();
        if (mount.children.length === 0) emptyEl.style.display = 'block';

        const skipKey = `${kind}:${id}`;

        // Sync deletion with backend API
        if (kind === 'seller') {
          (async () => {
            try {
              if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
              const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
              const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
              if (currentBase && token) {
                await fetch(currentBase + '/api/favorites/' + encodeURIComponent(id), {
                  method: 'DELETE',
                  headers: { 'Authorization': 'Bearer ' + token }
                });
              }
            } catch (err) {
              console.error('[FavoritesPage] Failed to delete from backend:', err);
            } finally {
              // Delete from store after backend sync is finished to prevent UI race condition
              window.FavoritesStore.remove(id, skipKey, kind);
            }
          })();
        } else {
          window.FavoritesStore.remove(id, skipKey, kind);
        }
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
