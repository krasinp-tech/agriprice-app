(function() {
  "use strict";

  const api = window.api || {};
  const helpers = window.ProfileHelpers || {};
  let presenceTimer = null;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function renderPresence(presence) {
    const row = document.getElementById('profilePresence');
    const text = document.getElementById('onlineStatusText');
    const online = presence === true || presence?.online === true;
    row?.classList.toggle('is-offline', !online);
    if (text) {
      text.textContent = window.AgriPresence?.formatStatus?.(presence)
        || (online ? t('online', 'ออนไลน์') : t('offline', 'ออฟไลน์'));
      text.removeAttribute('data-i18n');
    }
  }

  async function refreshPresence(uid) {
    if (!uid || !api.getUserPresence || document.hidden || navigator.onLine === false) {
      renderPresence(false);
      return;
    }
    try {
      const response = await api.getUserPresence(uid);
      const presence = response?.data || response || {};
      renderPresence(presence);
    } catch (_) {
      renderPresence(false);
    }
  }

  function watchPresence(uid) {
    clearInterval(presenceTimer);
    refreshPresence(uid);
    presenceTimer = setInterval(() => refreshPresence(uid), 30 * 1000);
  }

  function escapeHtml(value) {
    if (window.AgriPriceUI?.escapeHtml) return window.AgriPriceUI.escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeExternalUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      return /^https?:$/i.test(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function getProfileLink(link) {
    if (!link) return null;
    const rawUrl = typeof link === 'string' ? link : (link.url || link.href || '');
    const href = normalizeExternalUrl(rawUrl);
    if (!href) return null;
    const label = typeof link === 'string'
      ? link
      : (link.label || link.title || link.url || link.href || href);
    return { href, label };
  }

  function renderContactTab(data) {
    const mount = document.getElementById('contactList');
    if (!mount) return;

    const rows = [];
    const phone = String(data.phone || '').trim();
    const email = String(data.email || '').trim();
    if (phone) {
      rows.push(`
        <div class="contact-item-row">
          <span class="material-icons-outlined">phone</span>
          <a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ''))}">${escapeHtml(phone)}</a>
        </div>
      `);
    }
    if (email) {
      rows.push(`
        <div class="contact-item-row">
          <span class="material-icons-outlined">email</span>
          <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
        </div>
      `);
    }

    (Array.isArray(data.links) ? data.links : [])
      .map(getProfileLink)
      .filter(Boolean)
      .forEach((link) => {
        rows.push(`
          <div class="contact-item-row">
            <span class="material-icons-outlined">language</span>
            <a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>
          </div>
        `);
      });

    mount.innerHTML = rows.length
      ? rows.join('')
      : `<p style="color:#aaa;font-size:14px;padding:16px 0;">${escapeHtml(t('no_contact_info', 'No contact information'))}</p>`;
  }

  function renderServicesTab(data) {
    const mount = document.getElementById('servicesList');
    if (!mount) return;

    const services = Array.isArray(data.services) ? data.services : [];
    if (services.length === 0) {
      mount.innerHTML = `<div style="color:#94a3b8;font-size:13px;padding:10px 0;">${escapeHtml(t('no_services_info', 'No services listed'))}</div>`;
      return;
    }

    mount.innerHTML = services.map((service) => {
      const name = typeof service === 'string' ? service : (service.service_name || service.name || '');
      return `
        <div class="service-row">
          <span class="material-icons-outlined">check_circle</span>
          <span>${escapeHtml(name)}</span>
        </div>
      `;
    }).join('');
  }

  function renderLocationTab(data) {
    const addressLine1 = document.getElementById('addressLine1');
    const addressLine2 = document.getElementById('addressLine2');
    const mapIframe = document.getElementById('mapIframe');

    const line1 = data.address_line1 || '';
    const line2 = data.address_line2 || '';
    if (addressLine1) addressLine1.textContent = line1 || '-';
    if (addressLine2) addressLine2.textContent = line2;

    if (!mapIframe) return;
    const mapQuery = data.lat && data.lng
      ? `${data.lat},${data.lng}`
      : (data.map_link || [line1, line2].filter(Boolean).join(' '));
    mapIframe.src = mapQuery
      ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
      : '';
  }

  function renderProfileTabs(data) {
    renderContactTab(data);
    renderServicesTab(data);
    renderLocationTab(data);
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
        renderProfileTabs(data);
        const roleLabel = data.role === 'buyer' ? t('role_buyer', 'ผู้รับซื้อ') : t('role_farmer', 'เกษตรกร');
        const taglineEl = document.getElementById('profileTagline') || document.getElementById('heroBadgeTitle');
        if (taglineEl) taglineEl.textContent = data.tagline || roleLabel;
        
        watchPresence(uid);

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
          sellerId: uid,
          // title = ชื่อสินค้า, subtitle = ชื่อเกรด/ประเภท (ไม่ใช้ชื่อผู้ขายเป็น title)
          sellerName: sellerName,
          avatar: profileData.avatar || '../../assets/images/avatar-buyer.svg'
        }));
      }
      
      if (window.ProductCard && window.ProductCard.mount) {
        await window.ProductCard.mount(container, items, {
          handlers: {
            onBook: (p) => {
              const offerId = p.offerId || p.offer_id || p.productId || p.product_id || p.id;
              const q = new URLSearchParams({ offer_id: offerId, product_id: offerId }).toString();
              window.location.href = `../farmer/booking/booking-step1.html?${q}`;
            },
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

  document.addEventListener('visibilitychange', () => {
    const userId = new URLSearchParams(window.location.search).get('id') || new URLSearchParams(window.location.search).get('uid');
    if (!document.hidden && userId) refreshPresence(userId);
  });
  window.addEventListener('offline', () => renderPresence(false));
  window.addEventListener('beforeunload', () => clearInterval(presenceTimer));

})();
