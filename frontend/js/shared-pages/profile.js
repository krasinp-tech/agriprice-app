document.addEventListener("DOMContentLoaded", async function () {
  const DEBUG_PROFILE = !!window.AGRIPRICE_DEBUG;

  const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';

  // โ”€โ”€ Helper UI โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  function showLoading(visible) {
    let el = document.getElementById('loadingOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loadingOverlay';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;font-size:16px;color:#555;';
      el.textContent = 'กำลังโหลด...';
      document.body.appendChild(el);
    }
    el.style.display = visible ? 'flex' : 'none';
  }

  function showAlert(msg, type) {
    if (window.appNotify) {
      window.appNotify(msg, type === 'error' ? 'error' : 'success');
      return;
    }

    let el = document.getElementById('alertBanner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'alertBanner';
      el.style.cssText = 'position:fixed;right:16px;bottom:16px;padding:10px 14px;border-radius:14px;font-size:14px;z-index:9999;max-width:min(92vw,360px);text-align:left;box-shadow:0 10px 30px rgba(0,0,0,.12);';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'error' ? '#fee2e2' : '#d1fae5';
    el.style.color       = type === 'error' ? '#b91c1c' : '#065f46';
    el.style.display     = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  function showEmptyState(container, msg) {
    let empty = container.querySelector('.empty-state');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.cssText = 'padding:32px;text-align:center;color:#aaa;font-size:14px;';
      container.appendChild(empty);
    }
    empty.textContent = msg;
    empty.style.display = 'block';
  }

  function hideEmptyState(container) {
    const el = container.querySelector('.empty-state');
    if (el) el.style.display = 'none';
  }

  function getRole() {
    try {
      const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null');
      if (u && u.role) return String(u.role).toLowerCase();
    } catch (_) {}
    return (localStorage.getItem('role') || 'farmer').toLowerCase();
  }

  function getMyId() {
    try {
      const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null');
      return u?.id || null;
    } catch (_) { return null; }
  }

  function authHeaders() {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  function resolveAssetPath(p) {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    const dir = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    const idx = dir.lastIndexOf('/pages/');
    if (idx === -1) return String(p || '').replace(/^\/+/, '');
    const afterPages = dir.substring(idx + '/pages/'.length);
    const depth = afterPages.split('/').filter(Boolean).length;
    return '../' + '../'.repeat(depth) + String(p || '').replace(/^\/+/, '');
  }

  // โ”€โ”€ เธญเนเธฒเธ uid เธเธฒเธ URL โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const params = new URLSearchParams(window.location.search);
  const uid    = params.get('uid') || params.get('id') || params.get('userId') || null;
  const nameQ  = params.get('name') || '';

  if (DEBUG_PROFILE) console.log('[profile] uid:', uid, 'API_BASE:', API_BASE);

  if (!uid) {
    showAlert('ไม่พบ uid ใน URL กรุณากลับหน้าหลักแล้วลองใหม่', 'error');
  }

  const myId    = getMyId();
  const isOwnProfile = uid && myId && uid === myId;

  // โ”€โ”€ เธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฒเธ API โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  let profileData = {
    name: nameQ || '', tagline: '', followers: 0, following: 0,
    heroImage: '', avatar: '', role: '', badgeTitle: '', badgeSub: '', about: '',
    location: { line1: '', line2: '', mapEmbed: '', mapLink: '' },
  };
  let apiProducts = [];
  let isFollowing = false;

  if (API_BASE && uid) {
    try {
      showLoading(true);

      // เนเธซเธฅเธ”เธเธฃเนเธญเธกเธเธฑเธเธ—เธธเธเธญเธขเนเธฒเธ
      const [pRes, prodRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/profiles/${uid}`,        { headers: authHeaders() }),
        fetch(`${API_BASE}/api/products?user_id=${uid}`,{ headers: authHeaders() }),
        uid && myId && !isOwnProfile
          ? fetch(`${API_BASE}/api/follow/${uid}/status`, { headers: authHeaders() })
          : Promise.resolve(null),
      ]);

      // เนเธเธฃเนเธเธฅเน
      if (pRes.ok) {
        const p = await pRes.json();
        profileData = {
          name:      `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          tagline:   p.tagline    || '',
          followers: p.followers_count  ?? 0,
          following: p.following_count  ?? 0,
          heroImage: p.hero_image || '',
          avatar:    p.avatar     || '',
          role:      p.role       || '',
          badgeTitle:p.tagline    || '',
          badgeSub:  p.address_line1 || '',
          about:     p.about      || '',
          location: {
            line1:   p.address_line1 || '',
            line2:   p.address_line2 || '',
            mapLink: p.map_link      || '',
            mapEmbed:p.map_link
              ? `https://maps.google.com/maps?q=${encodeURIComponent(p.map_link)}&z=13&output=embed`
              : '',
          },
        };
      } else { showAlert('ไม่พบข้อมูลโปรไฟล์', 'error'); }

      // เธชเธดเธเธเนเธฒ
      if (prodRes.ok) {
        const prodJson = await prodRes.json();
        apiProducts = (prodJson.data || []).map(p => {
          const gradesArr = Array.isArray(p.product_grades) ? p.product_grades : [];
          const prices = {};
          if (gradesArr.length > 0) {
            gradesArr.forEach(g => { prices[g.grade] = g.price; });
          } else if (p.grade && p.price) {
            prices[p.grade] = p.price;
          } else { prices['A'] = p.price; }
          return { fruit: p.name || 'สินค้า', variety: p.variety || '', prices, unit: p.unit || 'กก.', _id: p.product_id };
        });
      }


      // เธชเธ–เธฒเธเธฐ follow
      if (statusRes && statusRes.ok) {
        const statusJson = await statusRes.json();
        isFollowing = statusJson.following || false;
      }

      showLoading(false);
    } catch (e) {
      showLoading(false);
      showAlert('เกิดข้อผิดพลาด: ' + (e.message || 'ไม่สามารถโหลดข้อมูลได้'), 'error');
    }
  }

  // โ”€โ”€ Render header โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const set    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const normalizeProfileImageUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
    if (value.startsWith('/uploads/')) return API_BASE ? (API_BASE + value) : value;
    if (value.startsWith('/assets/')) return resolveAssetPath(value.replace(/^\//, ''));
    if (value.startsWith('assets/')) return resolveAssetPath(value);
    return value;
  };
  const roleAvatar = String(profileData.role || '').toLowerCase() === 'farmer'
    ? resolveAssetPath('assets/images/avatar-farmer.svg')
    : (String(profileData.role || '').toLowerCase() === 'buyer'
      ? resolveAssetPath('assets/images/avatar-buyer.svg')
      : resolveAssetPath('assets/images/avatar-guest.svg'));
  const fallbackImages = {
    heroImage: resolveAssetPath('assets/images/hero.png'),
    profileAvatar: roleAvatar,
  };
  const normalizeUnitLabel = (unit) => {
    const value = String(unit || '').trim();
    if (!value) return 'กก.';
    if (/[เธโ�]/.test(value)) return 'กก.';
    return value;
  };
  const setSrc = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    const fallback = fallbackImages[id];
    if (fallback) {
      el.onerror = function () {
        this.onerror = null;
        this.src = normalizeProfileImageUrl(fallback) || fallback;
      };
    }
    if (val) el.src = normalizeProfileImageUrl(val) || val;
    else if (fallback) el.src = normalizeProfileImageUrl(fallback) || fallback;
  };
  const setHref= (id, val) => { const el = document.getElementById(id); if (el && val) el.href = val; };

  set('profileName',    profileData.name);
  set('profileTagline', profileData.tagline);
  set('followersCount', profileData.followers);
  setSrc('heroImage',   profileData.heroImage);
  setSrc('profileAvatar', profileData.avatar);
  set('heroBadgeTitle', profileData.badgeTitle);
  set('heroBadgeSub',   profileData.badgeSub);
  set('aboutDesc',      profileData.about);
  set('addressLine1',   profileData.location.line1);
  set('addressLine2',   profileData.location.line2);
  setHref('mapLink',    profileData.location.mapLink);
  const mapEl = document.getElementById('mapIframe');
  if (mapEl) mapEl.src = profileData.location.mapEmbed;


  // โ”€โ”€ Follow Button โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    if (isOwnProfile) {
      // เธเนเธญเธเธเธธเนเธกเธ–เนเธฒเน€เธเนเธเนเธเธฃเนเธเธฅเนเธ•เธฑเธงเน€เธญเธ
      followBtn.style.display = 'none';
    } else {
      // เธ•เธฑเนเธเธเนเธฒเธเธธเนเธกเธ•เธฒเธกเธชเธ–เธฒเธเธฐ
      function renderFollowBtn(following) {
        followBtn.innerHTML = following
          ? '<span class="material-icons-outlined">person_remove</span>'
          : '<span class="material-icons-outlined">person_add</span>';
        followBtn.title   = following ? 'เลิกติดตาม' : 'ติดตาม';
        followBtn.dataset.following = following ? 'true' : 'false';
        followBtn.style.background  = following ? '#e5e7eb' : '';
      }

      renderFollowBtn(isFollowing);

      followBtn.addEventListener('click', async () => {
        if (!myId) { showAlert('กรุณาเข้าสู่ระบบก่อน', 'error'); return; }

        const currently = followBtn.dataset.following === 'true';
        followBtn.disabled = true;

        try {
          const method = currently ? 'DELETE' : 'POST';
          const res = await fetch(`${API_BASE}/api/follow/${uid}`, {
            method,
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          });
          const json = await res.json();

          if (res.ok) {
            isFollowing = json.following;
            renderFollowBtn(isFollowing);
            // เธญเธฑเธเน€เธ”เธ• followers count เธเธเธซเธเนเธฒ
            set('followersCount', json.followers_count ?? profileData.followers);
            showAlert(isFollowing ? 'ติดตามแล้ว' : 'เลิกติดตามแล้ว', 'success');
          } else {
            showAlert(json.message || 'เกิดข้อผิดพลาด', 'error');
          }
        } catch (e) {
          showAlert('เกิดข้อผิดพลาด', 'error');
        } finally {
          followBtn.disabled = false;
        }
      });
    }
  }

  // โ”€โ”€ Followers List Button โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const followersCountEl = document.getElementById('followersCount');
  if (followersCountEl && uid) {
    followersCountEl.style.cursor = 'pointer';
    followersCountEl.addEventListener('click', async () => {
      await showFollowersList(uid);
    });
  }

  async function showFollowersList(targetUid) {
    try {
      const res = await fetch(`${API_BASE}/api/follow/${targetUid}/followers`, { headers: authHeaders() });
      if (!res.ok) { showAlert('โหลดรายชื่อไม่สำเร็จ', 'error'); return; }
      const json = await res.json();
      const list = json.data || [];

      // เธชเธฃเนเธฒเธ modal เนเธชเธ”เธเธฃเธฒเธขเธเธทเนเธญ
      let modal = document.getElementById('followersModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'followersModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:flex;align-items:flex-end;justify-content:center;';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:#fff;width:100%;max-width:480px;border-radius:16px 16px 0 0;max-height:70vh;overflow-y:auto;padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;font-size:16px;">ผู้ติดตาม (${list.length})</h3>
            <button id="closeFollowersModal" style="background:none;border:none;font-size:20px;cursor:pointer;">×</button>
          </div>
          ${list.length === 0
            ? '<p style="text-align:center;color:#aaa;padding:24px 0;">ยังไม่มีผู้ติดตาม</p>'
            : list.map(u => `
                  <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6;cursor:pointer;" 
                    onclick="window.navigateWithTransition('profile.html?uid=${u.profile_id}')">
                <img src="${normalizeProfileImageUrl(u.avatar) || roleAvatar}" alt="" onerror="this.onerror=null;this.src='${roleAvatar}'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;">
                <div>
                  <div style="font-weight:600;font-size:14px;">${u.first_name} ${u.last_name}</div>
                  <div style="font-size:12px;color:#888;">${u.tagline || (u.role === 'buyer' ? 'ผู้รับซื้อ' : 'เกษตรกร')}</div>
                </div>
              </div>`).join('')
          }
        </div>`;

      modal.style.display = 'flex';
      document.getElementById('closeFollowersModal').onclick = () => { modal.style.display = 'none'; };
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    } catch (e) {
      showAlert('เกิดข้อผิดพลาด', 'error');
    }
  }

  // โ”€โ”€ Render products โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const productContainer = document.getElementById('productListContainer');
  const role    = getRole();
  const isBuyer = role === 'buyer';

  if (productContainer) {
    productContainer.innerHTML = '';
    if (!apiProducts.length) {
      showEmptyState(productContainer, 'ยังไม่มีสินค้า');
    } else {
      hideEmptyState(productContainer);
      apiProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const priceHtml = Object.entries(product.prices || {}).map(([g, price]) => {
          if (!price) return '';
          return `<div class="price-box"><div class="grade">${g}</div><div class="price">${price} บ./${normalizeUnitLabel(product.unit)}</div></div>`;
        }).join('');
        const actionHtml = !isBuyer ? `
          <div class="action-row" data-actions>
            <button class="btn-contact" type="button" data-action="contact">ติดต่อ</button>
            <button class="btn-book" type="button" data-action="book" data-uid="${uid || ''}">จองคิว</button>
          </div>` : '';
        card.innerHTML = `
          <div class="product-header">
            <div class="seller-info" style="cursor:default">
              <div class="seller-avatar"><img src="${profileData.avatar || fallbackImages.profileAvatar}" alt="" onerror="this.onerror=null;this.src='${fallbackImages.profileAvatar}';"></div>
              <div class="seller-text">
                <div class="seller-name">${profileData.name}</div>
                <div class="seller-sub">${product.fruit}${product.variety ? ` (${product.variety})` : ''}</div>
              </div>
            </div>
          </div>
          <div class="price-row">${priceHtml}</div>
          ${actionHtml}`;
        productContainer.appendChild(card);
      });

      productContainer.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (isBuyer) { e.preventDefault(); return; }
        if (action === 'book') {
          e.preventDefault();
          localStorage.setItem('bookingReferrer', window.location.href);
          if (uid) {
            localStorage.setItem('bookingFarmerId', uid);
            localStorage.setItem('bookingFarmerName', profileData.name || '');
          }
          if (window.navigateWithTransition) window.navigateWithTransition('../farmer/booking/booking-step1.html'); else window.location.href = '../farmer/booking/booking-step1.html';
        }
        if (action === 'contact') {
          e.preventDefault();
          if (uid && API_BASE) {
            const token = localStorage.getItem(TOKEN_KEY) || '';
            fetch(`${API_BASE}/api/chats/start`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ other_id: uid }),
            }).then(r => r.json()).then(j => {
              if (j.chatId) {
                const nextHref = `../shared/chat.html?chatId=${j.chatId}`;
                if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
              }
            }).catch(() => { showAlert('เริ่มแชทล้มเหลว', 'error'); });
          }
        }
      });
    }
  }

  // โ”€โ”€ Render reviews โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€


  // โ”€โ”€ Upload helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  async function patchProfile(formData) {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token || !API_BASE) return false;
    try {
      const res = await fetch(API_BASE + '/api/profile', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });
      return res.ok;
    } catch (_) { return false; }
  }

  const avatarInput = document.getElementById('avatarFile');
  const avatarImg   = document.getElementById('profileAvatar');
  if (avatarInput && avatarImg) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        avatarImg.src = e.target.result;
        const fd = new FormData(); fd.append('avatar', file);
        await patchProfile(fd);
      };
      reader.readAsDataURL(file);
    });
  }

  const heroInput = document.getElementById('heroFile');
  const heroImg   = document.getElementById('heroImage');
  if (heroInput && heroImg) {
    heroInput.addEventListener('change', async () => {
      const file = heroInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        heroImg.src = e.target.result;
        const fd = new FormData(); fd.append('hero_image', file);
        await patchProfile(fd);
      };
      reader.readAsDataURL(file);
    });
  }

  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const token = localStorage.getItem(TOKEN_KEY) || '';
      if (!token || !API_BASE) return;
      const fields = {
        about:       document.getElementById('aboutDesc')?.textContent    || '',
        tagline:     document.getElementById('profileTagline')?.textContent || '',
        address_line1: document.getElementById('addressLine1')?.textContent || '',
      };
      await fetch(API_BASE + '/api/profile', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    });
  }
});
