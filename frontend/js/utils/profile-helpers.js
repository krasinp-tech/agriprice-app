(function() {
  /**
   * ============================================================
   * AGRIPRICE - Profile Helpers & Shared Logic
   * ============================================================
   */
  
  if (window.ProfileHelpers) return;

  const api = window.api || {};
  const fallbackAvatar = '../../assets/images/avatar-buyer.svg';
  const fallbackHero = '../../assets/images/hero.png';

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function normalizeUrl(url, type = 'avatar') {
    const raw = String(url || '').trim();
    if (!raw) return type === 'hero' ? fallbackHero : fallbackAvatar;
    if (/^(https?:\/\/|data:|blob:)/i.test(raw)) return raw;
    
    const base = api.getBase ? api.getBase() : (window.API_BASE_URL || '').replace(/\/$/, '');
    if (raw.startsWith('/uploads/')) return base + raw;
    if (raw.includes('assets/images/')) {
        return '../../' + raw.substring(raw.indexOf('assets/'));
    }
    return raw;
  }

  function setImage(imgEl, src, type = 'avatar') {
    if (!imgEl) return;
    const fb = type === 'hero' ? fallbackHero : fallbackAvatar;
    imgEl.onerror = function() {
      this.onerror = null;
      this.src = fb;
    };
    imgEl.src = normalizeUrl(src, type);
  }

  function getLoggedInUserLocation() {
    try {
      const rawUser = localStorage.getItem("user_data");
      if (rawUser) {
        const user = JSON.parse(rawUser);
        const lat = parseFloat(user.lat || user.latitude);
        const lng = parseFloat(user.lng || user.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    } catch (e) {}
    try {
      const role = localStorage.getItem("role") || "buyer";
      const rawProfile = localStorage.getItem(`myprofile_data_${role}`);
      if (rawProfile) {
        const profile = JSON.parse(rawProfile);
        const lat = parseFloat(profile.location?.lat || profile.lat || null);
        const lng = parseFloat(profile.location?.lng || profile.lng || null);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    } catch (e) {}
    try {
      const rawLoc = localStorage.getItem("location");
      if (rawLoc) {
        const loc = JSON.parse(rawLoc);
        const lat = parseFloat(loc?.lat || loc?.latitude);
        const lng = parseFloat(loc?.lng || loc?.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng };
        }
      }
    } catch (e) {}
    return null;
  }

  function mapProductData(p) {
    const unit = p.unit || t('kg_unit', 'กก.');
    let prices = { priceA: null, priceB: null, priceC: null };
    const bahtUnit = t('unit_baht', 'บ.');
    const unitStr = `${bahtUnit}/${unit}`;
    
    const gradesArr = Array.isArray(p.grades) ? p.grades : (Array.isArray(p.product_grades) ? p.product_grades : []);
    if (gradesArr.length > 0) {
        gradesArr.forEach(g => {
            const gName = String(g.grade || t('mixed', 'คละ')).toUpperCase();
            const pStr = `${Number(g.price || 0)} ${unitStr}`;
            if (gName === 'B') prices.priceB = pStr;
            else if (gName === 'C') prices.priceC = pStr;
            else prices.priceA = pStr;
        });
        if (!prices.priceA) {
            const firstGrade = gradesArr[0];
            prices.priceA = `${Number(firstGrade.price || p.price || 0)} ${unitStr}`;
        }
    } else {
        const priceStr = `${Number(p.price || 0)} ${unitStr}`;
        const gradeName = (p.grade || t('mixed', 'คละ')).toUpperCase();
        if (gradeName === 'B') prices.priceB = priceStr;
        else if (gradeName === 'C') prices.priceC = priceStr;
        else prices.priceA = priceStr;
    }

    // Calculate distance
    let distanceStr = t('distance_unspecified', '- กม.');
    try {
      const userLoc = getLoggedInUserLocation();
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const sLat = parseFloat(p.lat ?? profile?.lat ?? null);
      const sLng = parseFloat(p.lng ?? profile?.lng ?? null);

      if (userLoc && !isNaN(sLat) && !isNaN(sLng)) {
        if (window.LocationHelper && typeof window.LocationHelper.calculateDistance === 'function') {
          const distKm = window.LocationHelper.calculateDistance(userLoc.lat, userLoc.lng, sLat, sLng);
          if (distKm !== null && !isNaN(distKm)) {
            if (typeof window.LocationHelper.formatDistance === 'function') {
              distanceStr = window.LocationHelper.formatDistance(distKm);
            } else {
              distanceStr = distKm < 1 ? `${Math.round(distKm * 1000)} ${t('meter_unit', 'ม.')}` : `${distKm.toFixed(1)} ${t('km', 'กม.')}`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[ProfileHelpers] Distance calculation failed:', err);
    }

    let updatedStr = window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(p.updated_at || p.created_at) : (p.updated_at || p.created_at);
    const updatedLabel = t('updated', 'อัปเดต');
    if (updatedStr && !updatedStr.startsWith(updatedLabel)) {
      updatedStr = `${updatedLabel} ${updatedStr}`;
    }

    return {
      id: p.product_id || p.id,
      title: t(p.name, p.name) || '',
      subtitle: t(p.variety, p.variety) || '',
      priceA: prices.priceA || '',
      priceB: prices.priceB || '',
      priceC: prices.priceC || '',
      unit: unit,
      updated: updatedStr,
      is_active: p.is_active !== false,
      distance: distanceStr
    };
  }

  function renderBasicInfo(data) {
    if (!data) return;
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || t('role_user', 'ผู้ใช้งาน');
    
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = name;

    const taglineEl = document.getElementById('profileTagline') || document.getElementById('heroBadgeTitle');
    if (taglineEl) {
        const defaultRole = data.role === 'buyer' ? t('role_buyer', 'ผู้รับซื้อ') : t('role_farmer', 'เกษตรกร');
        taglineEl.textContent = data.tagline || defaultRole;
    }

    const followersEl = document.getElementById('followersCount');
    if (followersEl) followersEl.textContent = data.followers_count || 0;

    const followingEl = document.getElementById('followingCount');
    if (followingEl) followingEl.textContent = data.following_count || 0;

    const aboutEl = document.getElementById('aboutDesc');
    if (aboutEl) aboutEl.textContent = data.about || '-';

    setImage(document.getElementById('profileAvatar'), data.avatar, 'avatar');
    setImage(document.getElementById('heroImage'), data.hero_image, 'hero');
  }

  window.ProfileHelpers = {
    normalizeUrl,
    setImage,
    mapProductData,
    renderBasicInfo
  };

})();
