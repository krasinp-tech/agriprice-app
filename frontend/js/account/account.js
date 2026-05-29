/**
 * account.js
 * ไฟล์จัดการหน้าเมนูหลักของ "บัญชีผู้ใช้"
 * แสดงข้อมูลส่วนตัว, รูปโปรไฟล์, สถิติผู้ติดตาม, ยอดเงินในกระเป๋า (ถ้ามี),
 * และเป็นศูนย์รวมเมนูการตั้งค่าต่างๆ ของผู้ใช้ทั้งเกษตรกรและผู้ซื้อ
 */
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

  // เปิดโหมด debug ได้ด้วย window.ACCOUNT_DEBUG = true
  const DEBUG = !!(window.ACCOUNT_DEBUG || window.AGRIPRICE_DEBUG);

  // SAFE FALLBACK (no mock content)
  const emptyUser = {
    id: 0,
    fullName: "-",
    roleLabel: "-",
    memberSince: "",
    avatarUrl: "",
    stats: { following: 0, followers: 0, pros: 0 },
  };

  // DOM ELEMENTS
  const avatarImg = document.getElementById("avatarImg");
  const profileName = document.getElementById("profileName");
  const profileSub = document.getElementById("profileSub");
  const statFollowing = document.getElementById("statFollowing");
  const statFollowers = document.getElementById("statFollowers");
  const statPros = document.getElementById("statPros");

  const buyerProfileLink = document.getElementById("buyerProfileLink");
  const buyerDashboardLink = document.getElementById("buyerDashboardLink");

  const editBtn = document.getElementById("avatarEditBtn");
  const fileInput = document.getElementById("avatarFile");
  const logoutBtn = document.getElementById("logoutBtn");

  // HELPERS
  function log(...args) {
    if (DEBUG) console.log("[account]", ...args);
  }

  function safeText(el, v) {
    if (!el) return;
    el.textContent = v == null ? "" : String(v);
  }

  function formatMemberSince(yearOrDate) {
    if (!yearOrDate) return "-";
    const year = String(yearOrDate).slice(0, 4);
    const label = window.i18nT ? window.i18nT('member_since', 'สมาชิกตั้งแต่') : 'สมาชิกตั้งแต่';
    return `${label} ${year}`;
  }

  function getRelativePrefixToRoot() {
    const path = window.location.pathname.replace(/\\/g, "/");
    const pagesIdx = path.lastIndexOf("/pages/");
    if (pagesIdx === -1) return "";

    const afterPages = path.substring(pagesIdx + "/pages/".length);
    // นับจำนวน folder ที่อยู่หลัง pages/
    const parts = afterPages.split("/").filter(p => p && !p.endsWith(".html"));
    const depth = parts.length;

    // ถ้าอยู่ที่ pages/directly.html -> depth=0 -> ../
    // ถ้าอยู่ที่ pages/buyer/acc.html -> depth=1 -> ../../
    return "../" + "../".repeat(depth);
  }

  function resolveAssetPath(p) {
    const prefix = getRelativePrefixToRoot();
    const normalized = String(p || "").replace(/^\/+/, "");
    // ลองใช้ Path ที่เป็นมิตรกับทั้ง Web Server และ Cordova
    return prefix + normalized;
  }

  function getDefaultAvatarByRole(role) {
    const normalizedRole = String(role || "guest").toLowerCase();
    if (normalizedRole === "farmer") return resolveAssetPath("assets/images/avatar-farmer.svg");
    if (normalizedRole === "buyer") return resolveAssetPath("assets/images/avatar-buyer.svg");
    return resolveAssetPath("assets/images/avatar-guest.svg");
  }

  function loadJsonByKeys(keys) {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        return JSON.parse(raw);
      } catch (err) {
        if (DEBUG) console.warn('[Account] Error parsing JSON for key:', key, err);
      }
    }
    return null;
  }

  // =========================
  // AVATAR PERSIST (local + sync with myprofile)
  // =========================
  function loadSavedAvatar(role) {
    try {
      const avatarKey = KEYS.AVATAR(role);
      let saved = localStorage.getItem(avatarKey);

      // ถ้าไม่มี ให้ลองโหลดจาก myprofile data ตาม role
      if (!saved) {
        const profileKey = KEYS.PROFILE(role);
        const parsed = loadJsonByKeys([profileKey]);
        if (parsed && parsed.avatar && !parsed.avatar.includes("assets/images")) {
          saved = parsed.avatar;
        }
      }

      if (saved && avatarImg) {
        // กรอง Path ที่เสีย (เช่น มีคำว่า undefined หรือขึ้นต้นด้วย ../ มากเกินไป)
        if (saved.includes("undefined") || (saved.startsWith("../") && !window.location.pathname.includes("/pages/"))) {
          if (DEBUG) console.warn('[Account] Ignoring broken saved avatar path:', saved);
          return false;
        }
        avatarImg.src = saved;
        return true;
      }
      return false;
    } catch (err) {
      if (DEBUG) console.warn('[Account] Error loading saved avatar:', err);
      return false;
    }
  }

  function saveAvatarDataUrl(dataUrl) {
    try {
      const role = Auth.getRole();
      const avatarKey = KEYS.AVATAR(role);

      localStorage.setItem(avatarKey, dataUrl);

      // อัปเดต myprofile_data ตาม role ด้วย
      const profileKey = KEYS.PROFILE(role);
      const parsed = loadJsonByKeys([profileKey]);
      if (parsed) {
        parsed.avatar = dataUrl;
        localStorage.setItem(profileKey, JSON.stringify(parsed));
      }
    } catch (err) {
      if (DEBUG) console.warn('[Account] Error saving avatar:', err);
    }
  }

  function clearSavedAvatar() {
    try {
      const role = Auth.getRole();
      localStorage.removeItem(KEYS.AVATAR(role));
    } catch (err) {
      if (DEBUG) console.warn('[Account] Error clearing avatar:', err);
    }
  }

  // =========================
  // RENDER
  // =========================
  function renderUser(u) {
    if (!u) return;

    const role = Auth.getRole();
    const defaultAvatar = getDefaultAvatarByRole(role);

    // avatar: ถ้ามีรูปที่ user เคยเลือกไว้ ให้ใช้ก่อน
    const hasSaved = loadSavedAvatar(role);
    if (!hasSaved && avatarImg) avatarImg.src = u.avatarUrl || defaultAvatar;
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
      if (tier === "pro") {
        if (buyerDashboardLink) buyerDashboardLink.style.display = "flex";
        if (buyerUpgradeLink) buyerUpgradeLink.style.display = "none";
      } else {
        if (buyerDashboardLink) buyerDashboardLink.style.display = "none";
        if (buyerUpgradeLink) buyerUpgradeLink.style.display = "flex";
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
    safeText(statPros, s.pros ?? 0);

    // ซ่อน "รายการโปร" สำหรับ buyer
    const prosStatEl = statPros?.closest('.stat');
    const prosStatDivider = prosStatEl?.previousElementSibling;

    if (role === "buyer") {
      if (prosStatEl) prosStatEl.style.display = "none";
      if (prosStatDivider?.classList.contains('stat-divider')) {
        prosStatDivider.style.display = "none";
      }
    } else {
      if (prosStatEl) prosStatEl.style.display = "";
      if (prosStatDivider?.classList.contains('stat-divider')) {
        prosStatDivider.style.display = "";
      }
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

    // [FIX] Fallback: ถ้า API ไม่ส่ง tier มา หรือเป็น free ให้ลองเช็คจาก Token (เพราะเพิ่งจ่ายเงินอาจจะยังไม่ sync)
    let finalTier = data.tier ?? data.tierLabel ?? "free";
    if (finalTier === "free") {
      try {
        const token = Auth.getToken();
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
      // [FIX] server ส่ง profile_id ไม่ใช่ id
      id: data.profile_id ?? data.id ?? data.userId ?? 0,
      fullName: data.fullName ?? data.name ?? fullNameFromParts ?? emptyUser.fullName,
      roleLabel,
      memberSince: data.memberSince ?? data.createdAt ?? data.created_at ?? emptyUser.memberSince,
      avatarUrl: data.avatarUrl ?? data.avatar ?? emptyUser.avatarUrl,
      tier: finalTier,
      stats: {
        // [FIX] server ส่ง following_count / followers_count (ไม่ใช่ followingCount / followerCount)
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
      const role = Auth.getRole();
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
    const role = Auth.getRole();
    if (e.key === KEYS.AVATAR(role) || e.key === KEYS.PROFILE(role)) {
      syncLiveUser();
    }
    if (e.key === KEYS.THEME) {
      const dmCheck = document.getElementById('darkModeCheck');
      const dmStatus = document.getElementById('darkModeStatus');
      const isDark = e.newValue === 'dark';
      if (dmCheck) dmCheck.checked = isDark;
      if (dmStatus) dmStatus.textContent = isDark ? (window.i18nT ? window.i18nT('on', 'เปิดอยู่') : 'เปิดอยู่') : (window.i18nT ? window.i18nT('off', 'ปิดอยู่') : 'ปิดอยู่');
    }
  });

  // =========================
  // AVATAR PICKER
  // =========================
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

        // [ADDED] อัปโหลดรูปขึ้นเซิร์ฟเวอร์จริงเพื่อให้รูปคงอยู่เมื่อเปิดเครื่องอื่น
        const formData = new FormData();
        formData.append('avatar', file);

        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = Auth.getToken();

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
    loadSavedAvatar(Auth.getRole());
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
        clearSavedAvatar();
        if (Auth.logout) Auth.logout();
        else {
          localStorage.removeItem(KEYS.TOKEN);
          localStorage.removeItem(KEYS.USER_DATA);
          localStorage.removeItem(KEYS.ROLE);

          const path = window.location.pathname;
          const pagesIdx = path.indexOf("/pages/");
          const base = pagesIdx !== -1 ? path.substring(0, pagesIdx + 1) : "/";
          window.location.href = base + "index.html";
        }
      });
    }

    // [Theme] Dark Mode Toggle Logic
    const dmToggle = document.getElementById('darkModeToggle');
    const dmCheck = document.getElementById('darkModeCheck');
    const dmStatus = document.getElementById('darkModeStatus');

    if (dmToggle && dmCheck) {
      const updateUI = (isDark) => {
        dmCheck.checked = isDark;
        if (dmStatus) dmStatus.textContent = isDark ? (window.i18nT ? window.i18nT('on', 'เปิดอยู่') : 'เปิดอยู่') : (window.i18nT ? window.i18nT('off', 'ปิดอยู่') : 'ปิดอยู่');
      };

      const applyTheme = (isDark) => {
        const theme = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(KEYS.THEME, theme);

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
          metaTheme.setAttribute('content', isDark ? '#000000' : '#0B853C');
        }

        if (window.__AGRIPRICE_LOAD_THEME) window.__AGRIPRICE_LOAD_THEME();
      };

      const currentTheme = localStorage.getItem(KEYS.THEME);
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDarkNow = currentTheme ? currentTheme === 'dark' : systemDark;

      updateUI(isDarkNow);

      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(KEYS.THEME)) {
          updateUI(e.matches);
          applyTheme(e.matches);
        }
      });

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
