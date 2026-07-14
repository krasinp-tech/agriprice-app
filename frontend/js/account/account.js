// js/account/account.js
(function () {
  "use strict";

  // [FIX] fallback ต้องมี AVATAR/PROFILE เป็น function ด้วย ไม่งั้นจะ TypeError: KEYS.AVATAR is not a function
  const KEYS = window.STORAGE_KEYS || {
    TOKEN: 'token',
    ROLE: 'role',
    USER_DATA: 'user_data',
    THEME: 'agriprice_theme',
    AVATAR: (role) => `profile_avatar_dataurl_${role || 'guest'}`,
    PROFILE: (role) => `myprofile_data_${role || 'guest'}`,
  };
  const Auth = window.Auth || { getRole: () => 'guest', getToken: () => null };
  const api = window.api || {};
  const AuthGuard = window.AuthGuard || {};
  const DEBUG = !!window.AGRIPRICE_DEBUG;

  // =========================
  // DOM ELEMENTS
  // =========================
  const avatarImg   = document.getElementById("avatarImg");
  const profileName = document.getElementById("profileName");
  const profileSub  = document.getElementById("profileSub");
  const statFollowing = document.getElementById("statFollowing");
  const statFollowers = document.getElementById("statFollowers");
  const statPros      = document.getElementById("statPros");

  const buyerProfileLink   = document.getElementById("buyerProfileLink");
  const buyerDashboardLink = document.getElementById("buyerDashboardLink");

  // =========================
  // HELPERS
  // =========================
  function safeText(el, v) {
    if (!el) return;
    el.textContent = v == null ? "" : String(v);
  }

  function formatMemberSince(val) {
    if (!val) return "-";
    // val could be "2024" or ISO string
    const year = String(val).slice(0, 4);
    const label = window.i18nT ? window.i18nT('member_since', 'สมาชิกตั้งแต่') : 'สมาชิกตั้งแต่';
    return `${label} ${year}`;
  }

  function getDefaultAvatarByRole(role) {
    let root = '../../';
    if (typeof window.getRelativePrefixToRoot === 'function') {
      root = window.getRelativePrefixToRoot();
    }

    if (role === 'buyer') return root + 'assets/images/avatar-buyer.svg';
    if (role === 'farmer') return root + 'assets/images/avatar-farmer.svg';
    return root + 'assets/images/avatar-guest.svg';
  }

  function loadSavedAvatar(role) {
    if (!avatarImg) return false;
    const key = KEYS.AVATAR(role);
    const saved = localStorage.getItem(key);
    if (saved) {
      avatarImg.src = saved;
      return true;
    }
    return false;
  }

  function saveAvatarDataUrl(dataUrl) {
    const role = api.getRole ? api.getRole() : 'guest';
    localStorage.setItem(KEYS.AVATAR(role), dataUrl);
  }

  function clearSavedAvatar(role) {
    localStorage.removeItem(KEYS.AVATAR(role));
  }

  function loadJsonByKeys(keys) {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        return JSON.parse(raw);
      } catch (_) {}
    }
    return null;
  }

  function getBase() {
    return (window.API_BASE_URL || '').replace(/\/$/, '');
  }

  // [FIX] emptyUser must be defined as fallback
  const emptyUser = {
    fullName: "-",
    roleLabel: "-",
    memberSince: null,
    avatarUrl: "",
    stats: { following: 0, followers: 0, pros: 0 },
  };

  // =========================
  // RENDER
  // =========================
  function renderUser(u) {
    if (!u) return;

    const role = api.getRole ? api.getRole() : 'guest';
    const defaultAvatar = getDefaultAvatarByRole(role);

    // avatar: ถ้ามีรูปที่ user เคยเลือกไว้ ให้ใช้ก่อน
    const hasSaved = loadSavedAvatar(role);
    if (!hasSaved && avatarImg) {
      const isRelative = u.avatarUrl && !u.avatarUrl.startsWith('data:') && !u.avatarUrl.startsWith('http://') && !u.avatarUrl.startsWith('https://');
      const rootPrefix = (typeof window.getRelativePrefixToRoot === 'function') ? window.getRelativePrefixToRoot() : '../../';
      avatarImg.src = isRelative ? (rootPrefix + u.avatarUrl.replace(/^\/+/, '')) : (u.avatarUrl || defaultAvatar);
    }
    if (avatarImg) {
      avatarImg.onerror = function () {
        this.onerror = null;
        this.src = defaultAvatar;
      };
    }

    safeText(profileName, u.fullName || "-");

    const sub = `${u.roleLabel || "-"} • ${formatMemberSince(u.memberSince)}`;
    safeText(profileSub, sub);

    // buyer-only menu
    if (buyerProfileLink) {
      buyerProfileLink.style.display = role === "buyer" ? "flex" : "none";
    }

    const tier = String(u.tier || "free").toLowerCase();
    const buyerUpgradeLink = document.getElementById("buyerUpgradeLink");

    if (role === "buyer") {
      if (buyerUpgradeLink) {
        buyerUpgradeLink.style.display = "flex";
        const title = buyerUpgradeLink.querySelector(".menu-title");
        const sub = buyerUpgradeLink.querySelector(".menu-sub");
        if (tier === "pro") {
          if (title) {
            title.textContent = window.i18nT ? window.i18nT('manage_package', 'จัดการแพ็กเกจ') : 'จัดการแพ็กเกจ';
            title.setAttribute('data-i18n', 'manage_package');
          }
          if (sub) {
            sub.textContent = window.i18nT ? window.i18nT('manage_package_desc', 'ดูรายละเอียดการสมัครสมาชิก หรือยกเลิก') : 'ดูรายละเอียดการสมัครสมาชิก หรือยกเลิก';
            sub.setAttribute('data-i18n', 'manage_package_desc');
          }
        } else {
          if (title) {
            title.textContent = window.i18nT ? window.i18nT('upgrade_pro', 'อัปเกรดเป็นโปร') : 'อัปเกรดเป็นโปร';
            title.setAttribute('data-i18n', 'upgrade_pro');
          }
          if (sub) {
            sub.textContent = window.i18nT ? window.i18nT('upgrade_pro_desc', 'ปลดล็อกฟีเจอร์พรีเมียม') : 'ปลดล็อกฟีเจอร์พรีเมียม';
            sub.setAttribute('data-i18n', 'upgrade_pro_desc');
          }
        }
      }

      if (tier === "pro") {
        if (buyerDashboardLink) buyerDashboardLink.style.display = "flex";
      } else {
        if (buyerDashboardLink) buyerDashboardLink.style.display = "none";
      }
    } else {
      if (buyerDashboardLink) buyerDashboardLink.style.display = "none";
      if (buyerUpgradeLink) buyerUpgradeLink.style.display = "none";
    }

    const proBadge = document.getElementById("proBadge");
    if (proBadge) {
      proBadge.style.display = tier === "pro" ? "inline-flex" : "none";
    }

    const s = u.stats || {};
    safeText(statFollowing, s.following ?? 0);
    safeText(statFollowers, s.followers ?? 0);

    const localProsCount = window.FavoritesStore ? window.FavoritesStore.read().length : (s.pros ?? 0);
    safeText(statPros, localProsCount);

    // Only show "รายการโปรด" for farmers (who bookmark buyers)
    const showPros = role === "farmer";
    const prosStatEl = statPros?.closest('.stat');
    const prosStatDivider = prosStatEl?.previousElementSibling;

    if (prosStatEl) prosStatEl.style.display = showPros ? "" : "none";
    if (prosStatDivider?.classList.contains('stat-divider')) {
      prosStatDivider.style.display = showPros ? "" : "none";
    }
  }

  let liveSyncTimer = null;
  let liveSyncBusy = false;

  async function syncLiveUser() {
    if (liveSyncBusy) return;
    liveSyncBusy = true;
    try {
      await initUser();
    } finally {
      liveSyncBusy = false;
    }
  }

  function startLiveSync() {
    if (liveSyncTimer) return;
    liveSyncTimer = setInterval(() => {
      if (document.hidden) return;
      syncLiveUser();
    }, 15000);
  }

  function stopLiveSync() {
    if (!liveSyncTimer) return;
    clearInterval(liveSyncTimer);
    liveSyncTimer = null;
  }

  // =========================
  // FETCH USER FROM API (รองรับ DB)
  // =========================
  function mapApiUserToViewModel(data) {
    const fullNameFromParts = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    const roleRaw = String(data.role || "").toLowerCase();
    const roleLabel = roleRaw === "buyer" ? (window.i18nT ? window.i18nT('role_buyer', 'ผู้รับซื้อ') : "ผู้รับซื้อ") : roleRaw === "farmer" ? (window.i18nT ? window.i18nT('role_farmer', 'เกษตรกร') : "เกษตรกร") : (data.roleLabel || data.role || emptyUser.roleLabel);

    // Fallback: ถ้า API ไม่ส่ง tier มา หรือเป็น free ให้ลองเช็คจาก Token
    let finalTier = data.tier ?? data.tierLabel ?? "free";
    if (finalTier === "free") {
      try {
        const token = api.getToken ? api.getToken() : '';
        if (token) {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.tier === 'pro') finalTier = 'pro';
          }
        }
      } catch (e) { }
    }

    return {
      id: window.resolveProfileId ? window.resolveProfileId(data.profile_id, data.id, data.userId) : (data.id || 0),
      fullName: data.fullName ?? data.name ?? fullNameFromParts ?? emptyUser.fullName,
      roleLabel,
      memberSince: data.memberSince ?? data.createdAt ?? data.created_at ?? emptyUser.memberSince,
      avatarUrl: data.avatarUrl ?? data.avatar ?? emptyUser.avatarUrl,
      tier: finalTier,
      stats: {
        following: data.stats?.following ?? data.following_count ?? data.followingCount ?? emptyUser.stats.following,
        followers: data.stats?.followers ?? data.followers_count ?? data.followerCount ?? emptyUser.stats.followers,
        pros: data.stats?.pros ?? data.promoCount ?? emptyUser.stats.pros,
      },
    };
  }

  async function fetchMeFromApi() {
    if (window.APP_CONFIG_READY) {
      try { await window.APP_CONFIG_READY; } catch (err) {
        if (DEBUG) console.warn('[Account] Config ready error:', err);
      }
    }

    if (!api.getProfile) return null;

    try {
      const data = await api.getProfile();
      if (!data) return null;
      return mapApiUserToViewModel(data);
    } catch (err) {
      if (DEBUG) console.warn('[Account] Fetch me failed:', err);
      return null;
    }
  }

  async function initUser() {
    try {
      const me = await fetchMeFromApi();
      if (me) {
        renderUser(me);
        return;
      }

      // fallback: ใช้ข้อมูลจริงจาก localStorage
      const role = api.getRole ? api.getRole() : 'guest';
      const roleLabel = role === "buyer" ? (window.i18nT ? window.i18nT('role_buyer', 'ผู้รับซื้อ') : "ผู้รับซื้อ") : role === "farmer" ? (window.i18nT ? window.i18nT('role_farmer', 'เกษตรกร') : "เกษตรกร") : (window.i18nT ? window.i18nT('role_user', 'ผู้ใช้งาน') : "ผู้ใช้งาน");

      let userData = {
        ...emptyUser,
        role,
        roleLabel,
        stats: { ...emptyUser.stats },
      };

      try {
        const profileKey = KEYS.PROFILE(role);
        const parsed = loadJsonByKeys([profileKey]);
        if (parsed) {
          if (parsed.name) userData.fullName = parsed.name;
          if (parsed.avatar) userData.avatarUrl = parsed.avatar;
          if (parsed.memberSince || parsed.createdAt) userData.memberSince = parsed.memberSince || parsed.createdAt;
          if (parsed.following !== undefined) userData.stats.following = parsed.following;
          if (parsed.followers !== undefined) userData.stats.followers = parsed.followers;
          if (parsed.pros !== undefined) userData.stats.pros = parsed.pros;
        }
      } catch (err) {
        if (DEBUG) console.warn('[Account] Profile data load failed:', err);
      }

      renderUser(userData);
    } catch (err) {
      if (DEBUG) console.warn('[Account] Init user error:', err);
      renderUser(emptyUser);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLiveSync();
    else {
      syncLiveUser();
      startLiveSync();
    }
  });

  window.addEventListener("focus", () => {
    syncLiveUser();
  });

  window.addEventListener("storage", (e) => {
    const role = api.getRole ? api.getRole() : 'guest';
    if (e.key === KEYS.AVATAR(role) || e.key === KEYS.PROFILE(role)) {
      syncLiveUser();
    }
    if (e.key === KEYS.THEME) {
      const dmCheck = document.getElementById('darkModeCheck');
      const dmStatus = document.getElementById('darkModeStatus');
      const dmToggle = document.getElementById('darkModeToggle');
      const isDark = e.newValue === 'dark';
      if (dmCheck) dmCheck.checked = isDark;
      const track = dmToggle ? dmToggle.querySelector('.toggle-track') : null;
      if (track) track.classList.toggle('on', isDark);
      if (dmStatus) dmStatus.textContent = isDark ? (window.i18nT ? window.i18nT('on', 'เปิดอยู่') : 'เปิดอยู่') : (window.i18nT ? window.i18nT('off', 'ปิดอยู่') : 'ปิดอยู่');
      if (window.__AGRIPRICE_APPLY_THEME) {
        window.__AGRIPRICE_APPLY_THEME(e.newValue || 'light');
      } else {
        document.documentElement.setAttribute('data-theme', e.newValue || 'light');
        if (document.body) document.body.setAttribute('data-theme', e.newValue || 'light');
      }
    }
  });

  // =========================
  // AVATAR PICKER
  // =========================
  const editBtn   = document.getElementById("avatarEditBtn");
  const fileInput = document.getElementById("avatarFile");

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (editBtn && fileInput && avatarImg) {
    editBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      if (file.size > 3 * 1024 * 1024) {
        const msg = window.i18nT ? window.i18nT('image_too_large_error', 'รูปใหญ่เกินไป (เกิน 3MB) กรุณาเลือกรูปใหม่') : 'รูปใหญ่เกินไป (เกิน 3MB) กรุณาเลือกรูปใหม่';
        if (window.appNotify) window.appNotify(msg, 'error');
        else console.warn(msg);
        fileInput.value = "";
        return;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        avatarImg.src = dataUrl;
        saveAvatarDataUrl(dataUrl);

        const formData = new FormData();
        formData.append('avatar', file);

        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const currentBase = getBase();
        const token = api.getToken ? api.getToken() : '';

        if (currentBase && token) {
          fetch(currentBase + '/api/profile', {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
          })
            .then(res => res.json())
            .then(data => {
              if (window.AGRIPRICE_DEBUG) console.log('[Account] Avatar uploaded successfully:', data);
            })
            .catch(err => {
              if (window.AGRIPRICE_DEBUG) console.error('[Account] Avatar upload failed:', err);
            });
        }

      } catch (err) {
        if (DEBUG) console.error('[Account] Avatar reading failed:', err);
        const msg = window.i18nT ? window.i18nT('read_file_error', 'อ่านไฟล์รูปไม่สำเร็จ') : 'อ่านไฟล์รูปไม่สำเร็จ';
        if (window.appNotify) window.appNotify(msg, 'error');
        else console.error(msg);
      } finally {
        fileInput.value = "";
      }
    });
  } else {
    if (api.getRole) loadSavedAvatar(api.getRole());
  }

  startLiveSync();

  // [Pull-to-Refresh] Connect to global-anim utility
  if (window.initPullToRefresh) {
    window.initPullToRefresh(async () => {
      await syncLiveUser();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initUser();

    const logoutBtn = document.getElementById("logoutBtn");
    const logoutModal = document.getElementById("logoutModal");
    const logoutConfirmBtn = document.getElementById("logoutConfirmBtn");
    const logoutCancelBtn = document.getElementById("logoutCancelBtn");

    function showLogoutModal() {
      if (logoutModal) {
        logoutModal.style.display = "flex";
        document.body.style.overflow = "hidden";
      }
    }

    function hideLogoutModal() {
      if (logoutModal) {
        logoutModal.style.display = "none";
        document.body.style.overflow = "";
      }
    }

    if (logoutBtn) logoutBtn.addEventListener("click", showLogoutModal);
    if (logoutCancelBtn) logoutCancelBtn.addEventListener("click", hideLogoutModal);

    if (logoutModal) {
      const overlay = logoutModal.querySelector(".logout-modal-overlay");
      if (overlay) overlay.addEventListener("click", hideLogoutModal);
    }

    if (logoutConfirmBtn) {
      logoutConfirmBtn.addEventListener("click", () => {
        if (api.getRole) clearSavedAvatar(api.getRole());
        if (api.logout) api.logout();
        else if (AuthGuard.logout) AuthGuard.logout();
      });
    }

    // [Theme] Dark Mode Toggle Logic
    const dmToggle = document.getElementById('darkModeToggle');
    const dmCheck = document.getElementById('darkModeCheck');
    const dmStatus = document.getElementById('darkModeStatus');

    if (dmToggle && dmCheck) {
      const updateUI = (isDark) => {
        dmCheck.checked = isDark;
        // sync toggle-track visual state
        const track = dmToggle.querySelector('.toggle-track');
        if (track) track.classList.toggle('on', isDark);
        if (dmStatus) dmStatus.textContent = isDark ? (window.i18nT ? window.i18nT('on', 'เปิดอยู่') : 'เปิดอยู่') : (window.i18nT ? window.i18nT('off', 'ปิดอยู่') : 'ปิดอยู่');
      };

      const applyTheme = (isDark) => {
        const theme = isDark ? 'dark' : 'light';
        if (window.__AGRIPRICE_APPLY_THEME) {
          window.__AGRIPRICE_APPLY_THEME(theme, { persist: true, broadcast: true });
        } else {
          document.documentElement.setAttribute('data-theme', theme);
          if (document.body) document.body.setAttribute('data-theme', theme);
          localStorage.setItem(KEYS.THEME, theme);

          const metaTheme = document.querySelector('meta[name="theme-color"]');
          if (metaTheme) {
            metaTheme.setAttribute('content', isDark ? '#000000' : '#0B853C');
          }

          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'agriprice:theme', theme }, '*');
          }
        }
      };

      const currentTheme = localStorage.getItem(KEYS.THEME);
      const isDarkNow = currentTheme ? currentTheme === 'dark' : false;

      updateUI(isDarkNow);

      dmToggle.addEventListener('click', (e) => {
        if (e.target === dmCheck) return;
        e.preventDefault();
        const nextDark = !dmCheck.checked;
        updateUI(nextDark);
        applyTheme(nextDark);
      });

      dmCheck.addEventListener('change', (e) => {
        const nextDark = e.target.checked;
        updateUI(nextDark);
        applyTheme(nextDark);
      });
    }
  });
})();
