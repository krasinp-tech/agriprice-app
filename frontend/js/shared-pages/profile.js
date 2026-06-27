(function() {
  "use strict";

  const api = window.api || {};
  const helpers = window.ProfileHelpers || {};

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  async function setupFollowButton(uid) {
    const followBtn = document.getElementById('followBtn');
    if (!followBtn || !api.call) return;

    let isFollowing = false;

    // Check status
    try {
      const res = await api.call('GET', `/api/follow/${uid}/status`);
      if (res && res.data && res.data.following) {
        isFollowing = true;
      }
    } catch (err) {
      console.error('[Profile] Follow Status Check Error:', err);
    }

    const followersCountEl = document.getElementById('followersCount');

    function updateFollowBtnUI() {
      if (isFollowing) {
        followBtn.innerHTML = `
          <span class="material-icons-outlined" style="font-size: 20px;">person_remove</span>
          <span>${t('unfollow', 'เลิกติดตาม')}</span>
        `;
        followBtn.classList.add('following');
      } else {
        followBtn.innerHTML = `
          <span class="material-icons-outlined" style="font-size: 20px;">person_add</span>
          <span>${t('follow', 'ติดตาม')}</span>
        `;
        followBtn.classList.remove('following');
      }
    }

    updateFollowBtnUI();

    followBtn.onclick = async () => {
      followBtn.disabled = true;
      try {
        if (isFollowing) {
          await api.call('DELETE', `/api/follow/${uid}`);
          isFollowing = false;
          // Decrement count
          if (followersCountEl) {
            const current = parseInt(followersCountEl.textContent) || 0;
            followersCountEl.textContent = Math.max(0, current - 1);
          }
        } else {
          await api.call('POST', `/api/follow/${uid}`);
          isFollowing = true;
          // Increment count
          if (followersCountEl) {
            const current = parseInt(followersCountEl.textContent) || 0;
            followersCountEl.textContent = current + 1;
          }
        }
        updateFollowBtnUI();
      } catch (err) {
        console.error('[Profile] Follow action failed:', err);
        if (window.showToast) window.showToast(t('action_failed', 'ทำรายการไม่สำเร็จ'), 'error');
      } finally {
        followBtn.disabled = false;
      }
    };
  }

  async function loadProfile(uid) {
    if (!uid || !api.getProfileById) return;
    try {
      const data = await api.getProfileById(uid);
      if (data) {
        helpers.renderBasicInfo(data);
        const roleLabel = data.role === 'buyer' ? t('role_buyer', 'ผู้รับซื้อ') : t('role_farmer', 'เกษตรกร');
        const taglineEl = document.getElementById('profileTagline') || document.getElementById('heroBadgeTitle');
        if (taglineEl) taglineEl.textContent = data.tagline || roleLabel;
        
        const statusText = document.getElementById('onlineStatusText');
        if (statusText) statusText.textContent = t('online', 'ออนไลน์');

        // Setup Actions
        const myId = api.getUser()?.id;
        if (String(uid) === String(myId)) {
          const actionRow = document.querySelector('.profile-action-row');
          if (actionRow) actionRow.style.display = 'none';
        } else {
          // Contact button click
          const contactBtn = document.getElementById('contactBtn');
          if (contactBtn) {
            contactBtn.onclick = () => {
              window.location.href = `./chat.html?targetId=${uid}`;
            };
          }

          // Follow button logic
          setupFollowButton(uid);
        }

        await loadProducts(uid, data);
      }
    } catch (err) {
      console.error('[Profile] Error:', err);
    }
  }

  async function loadProducts(uid, profileData = null) {
    const container = document.getElementById('productListContainer');
    if (!container || !api.getProducts) return;

    try {
      const res = await api.getProducts({ user_id: uid });
      let items = (res.data || res || []).map(helpers.mapProductData);
      
      if (profileData) {
        const sellerName = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() || t('role_user', 'ผู้ใช้งาน');
        items = items.map(p => ({
          ...p,
          title: sellerName,
          subtitle: p.subtitle ? `${p.title} (${p.subtitle})` : p.title,
          avatar: profileData.avatar || '../../assets/images/avatar-buyer.svg'
        }));
      }
      
      if (window.ProductCard && window.ProductCard.mount) {
        await window.ProductCard.mount(container, items, {
          handlers: {
            onBook: (p) => window.location.href = `../farmer/booking/booking-step1.html?product_id=${p.id}`,
            onContact: (p) => window.location.href = `./chat.html?targetId=${uid}`
          }
        });
      }
    } catch (err) {
      console.error('[Profile] Products Error:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const userId = new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('uid');
    
    // If viewing our own profile, redirect to myprofile.html
    if (userId && api.getUser) {
      const myId = api.getUser()?.id;
      if (String(userId) === String(myId)) {
        const dest = '../buyer/myprofile.html';
        if (window.navigateWithTransition) window.navigateWithTransition(dest);
        else window.location.href = dest;
        return;
      }
    }
    
    if (userId) loadProfile(userId);
  });

})();
