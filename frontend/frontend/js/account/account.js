// js/account/account.js
(function () {
  "use strict";

  // =========================
  // CONFIG (รองรับ DB/Backend)
  // =========================
  const AUTH_TOKEN_KEY = window.AUTH_TOKEN_KEY || "token"; // ถ้ามีระบบ auth ก็ใช้ได้
  const ME_ENDPOINT = window.API_ME_ENDPOINT || "/api/profile";   // backend ปัจจุบันใช้ /api/profile

  function getApiBase() {
    return (window.API_BASE_URL || "").replace(/\/$/, "");
  }

  // เปิดโหมด debug ได้ด้วย window.ACCOUNT_DEBUG = true
  const DEBUG = !!window.ACCOUNT_DEBUG;

  // =========================
  // SAFE FALLBACK (no mock content)
  // =========================
  const emptyUser = {
    id: 0,
    fullName: "-",
    roleLabel: "-",
    memberSince: "",
    avatarUrl: "",
    stats: { following: 0, followers: 0, pros: 0 },
  };

  // =========================
  // DOM ELEMENTS
  // =========================
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

  // =========================
  // HELPERS
  // =========================
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
    return `สมาชิกตั้งแต่ ${year}`;
  }

  function getToken() {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch (_) {
      return null;
    }
  }

  function getRole() {
    try {
      return String(localStorage.getItem("role") || "guest").toLowerCase();
    } catch (_) {
      return "guest";
    }
  }

  function getRelativePrefixToRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../" + "../".repeat(depth);
  }

  function resolveAssetPath(p) {
    const prefix = getRelativePrefixToRoot();
    const normalized = String(p || "").replace(/^\/+/, "");
    return prefix + normalized;
  }

  function getDefaultAvatarByRole(role) {
    const normalizedRole = String(role || "guest").toLowerCase();
    if (normalizedRole === "farmer") return resolveAssetPath("assets/images/avatar-farmer.svg");
    if (normalizedRole === "buyer") return resolveAssetPath("assets/images/avatar-buyer.svg");
    return resolveAssetPath("assets/images/avatar-guest.svg");
  }

  function getAvatarKeysByRole(role) {
    const normalizedRole = String(role || "guest").toLowerCase();
    const scopedKey = `profile_avatar_dataurl_${normalizedRole}`;

    // buyer ยังรองรับ key เก่าเพื่อ migration แบบไม่สะดุด
    if (normalizedRole === "buyer") {
      return [scopedKey, "profile_avatar_dataurl"];
    }

    return [scopedKey];
  }

  function getProfileKeysByRole(role) {
    const normalizedRole = String(role || "guest").toLowerCase();
    const scopedKey = `myprofile_data_${normalizedRole}`;

    // buyer ยังรองรับ key เก่าเพื่อ migration แบบไม่สะดุด
    if (normalizedRole === "buyer") {
      return [scopedKey, "myprofile_data"];
    }

    return [scopedKey];
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

  // =========================
  // AVATAR PERSIST (local + sync with myprofile)
  // =========================
  function loadSavedAvatar(role) {
    try {
      // ลองโหลดจาก key ตาม role ก่อน
      const avatarKeys = getAvatarKeysByRole(role);
      let saved = null;
      for (const key of avatarKeys) {
        saved = localStorage.getItem(key);
        if (saved) break;
      }
      
      // ถ้าไม่มี ให้ลองโหลดจาก myprofile data ตาม role
      if (!saved) {
        const parsed = loadJsonByKeys(getProfileKeysByRole(role));
        if (parsed && parsed.avatar && !parsed.avatar.includes("assets/images")) {
          saved = parsed.avatar;
        }
      }
      
      if (saved && avatarImg) {
        avatarImg.src = saved;
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function saveAvatarDataUrl(dataUrl) {
    try {
      const role = getRole();
      const avatarKeys = getAvatarKeysByRole(role);

      // บันทึก key ตาม role (+ key เก่าของ buyer เพื่อ backward compatibility)
      avatarKeys.forEach((key) => localStorage.setItem(key, dataUrl));
      
      // อัปเดต myprofile_data ตาม role ด้วย
      const profileKeys = getProfileKeysByRole(role);
      const parsed = loadJsonByKeys(profileKeys);
      if (parsed) {
        parsed.avatar = dataUrl;
        profileKeys.forEach((key) => localStorage.setItem(key, JSON.stringify(parsed)));
      }
    } catch (_) {}
  }

  function clearSavedAvatar() {
    try {
      const role = getRole();
      const avatarKeys = getAvatarKeysByRole(role);
      avatarKeys.forEach((key) => localStorage.removeItem(key));
      // ลบ old key ด้วย
      localStorage.removeItem("acc_avatar_dataurl");
    } catch (_) {}
  }

  // =========================
  // RENDER
  // =========================
  function renderUser(u) {
    if (!u) return;

    const role = getRole();
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
    if (buyerDashboardLink) {
      buyerDashboardLink.style.display = role === "buyer" ? "flex" : "none";
    }

    const s = u.stats || {};
    safeText(statFollowing, s.following ?? 0);
    safeText(statFollowers, s.followers ?? 0);
    safeText(statPros, s.pros ?? 0);
    
    // ซ่อน "รายการโปร" สำหรับ buyer
    const prosStatEl = statPros?.closest('.stat');
    const prosStatDivider = prosStatEl?.previousElementSibling;
    
    if (role === "buyer") {
      // ซ่อน stat รายการโปรและ divider ด้านหน้า
      if (prosStatEl) prosStatEl.style.display = "none";
      if (prosStatDivider?.classList.contains('stat-divider')) {
        prosStatDivider.style.display = "none";
      }
    } else {
      // แสดงสำหรับ farmer/guest
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
    // ปรับ mapping ให้ตรง backend ของคุณได้
    const fullNameFromParts = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    const roleRaw = String(data.role || "").toLowerCase();
    const roleLabel = roleRaw === "buyer" ? "ผู้รับซื้อ" : roleRaw === "farmer" ? "เกษตรกร" : (data.roleLabel || data.role || emptyUser.roleLabel);

    return {
      id: data.id ?? data.userId ?? 0,
      fullName: data.fullName ?? data.name ?? fullNameFromParts ?? emptyUser.fullName,
      roleLabel,
      memberSince: data.memberSince ?? data.createdAt ?? data.created_at ?? emptyUser.memberSince,
      avatarUrl: data.avatarUrl ?? data.avatar ?? emptyUser.avatarUrl,
      stats: {
        following: data.stats?.following ?? data.followingCount ?? data.following_count ?? emptyUser.stats.following,
        followers: data.stats?.followers ?? data.followerCount ?? data.followers_count ?? emptyUser.stats.followers,
        pros: data.stats?.pros ?? data.promoCount ?? emptyUser.stats.pros,
      },
    };
  }

  async function fetchMeFromApi() {
    if (window.APP_CONFIG_READY) {
      try { await window.APP_CONFIG_READY; } catch (_) {}
    }

    const apiBase = getApiBase();
    if (!apiBase) {
      log("API_BASE_URL not set -> use mock");
      return null;
    }

    const token = getToken(); // มี token ก็ส่งไป, ไม่มี token ก็เป็น guest ได้
    const url = apiBase + ME_ENDPOINT;

    log("Fetching:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include", // สำหรับ backend ที่ใช้ cookie session
    });

    if (!res.ok) {
      log("API not ok:", res.status);
      return null;
    }

    const data = await res.json();
    return mapApiUserToViewModel(data);
  }

  async function initUser() {
    try {
      const me = await fetchMeFromApi();
      if (me) {
        renderUser(me);
        return;
      }

      // fallback: ใช้ข้อมูลจริงจาก localStorage ถ้ามี, ไม่เติมข้อมูลปลอม
      const role = getRole();
      const roleLabel = role === "buyer" ? "ผู้รับซื้อ" : role === "farmer" ? "เกษตรกร" : "ผู้ใช้งาน";
      
      // โหลดข้อมูลจาก myprofile_data ถ้ามี
      let userData = {
        ...emptyUser,
        role,
        roleLabel,
        stats: { ...emptyUser.stats },
      };
      
      try {
        const parsed = loadJsonByKeys(getProfileKeysByRole(role));
        if (parsed) {
          
          // sync จาก myprofile
          if (parsed.name) {
            userData.fullName = parsed.name;
          }

          if (parsed.avatar) {
            userData.avatarUrl = parsed.avatar;
          }

          if (parsed.memberSince || parsed.createdAt) {
            userData.memberSince = parsed.memberSince || parsed.createdAt;
          }

          if (parsed.following !== undefined) {
            userData.stats = {
              ...userData.stats,
              following: parsed.following
            };
          }
          
          // sync followers จาก myprofile
          if (parsed.followers !== undefined) {
            userData.stats = {
              ...userData.stats,
              followers: parsed.followers
            };
          }

          if (parsed.pros !== undefined) {
            userData.stats = {
              ...userData.stats,
              pros: parsed.pros
            };
          }
        }
      } catch (err) {
        log("Failed to load myprofile data:", err);
      }
      
      renderUser(userData);
    } catch (e) {
      log("fetch error:", e);
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
    const role = getRole();
    const avatarKeys = getAvatarKeysByRole(role);
    const profileKeys = getProfileKeysByRole(role);
    if (avatarKeys.includes(e.key) || profileKeys.includes(e.key)) {
      syncLiveUser();
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

      // กันมือถือค้าง: จำกัด 3MB
      if (file.size > 3 * 1024 * 1024) {
        alert("รูปใหญ่เกินไป (เกิน 3MB) กรุณาเลือกรูปใหม่");
        fileInput.value = "";
        return;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        avatarImg.src = dataUrl;
        saveAvatarDataUrl(dataUrl);

        // อนาคต: อัปโหลดขึ้น backend ได้ตรงนี้
        // await uploadAvatarToApi(file);
      } catch (_) {
        alert("อ่านไฟล์รูปไม่สำเร็จ");
      } finally {
        fileInput.value = "";
      }
    });
  } else {
    // ถ้าไม่มี element ก็ยังพยายามโหลดรูปที่เคยเซฟไว้
    loadSavedAvatar(getRole());
  }

  startLiveSync();

// =========================
// LOGOUT -> ไปหน้า index
// =========================
function getProjectBasePath() {
  // รองรับกรณี /agriprice_fixed/pages/account/account.html
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}/` : "/";
}

function goHome() {
  const base = getProjectBasePath();
  if (window.navigateWithTransition) window.navigateWithTransition(base + "index.html"); else window.location.href = base + "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // เรียก initUser เพื่อโหลดข้อมูลและแสดงปุ่มตาม role
  initUser();

  const logoutBtn = document.getElementById("logoutBtn");
  const logoutModal = document.getElementById("logoutModal");
  const logoutConfirmBtn = document.getElementById("logoutConfirmBtn");
  const logoutCancelBtn = document.getElementById("logoutCancelBtn");
  
  // ฟังก์ชันแสดง modal
  function showLogoutModal() {
    if (logoutModal) {
      logoutModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  }
  
  // ฟังก์ชันซ่อน modal
  function hideLogoutModal() {
    if (logoutModal) {
      logoutModal.style.display = "none";
      document.body.style.overflow = "";
    }
  }
  
  // คลิกปุ่ม logout -> แสดง modal
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      showLogoutModal();
    });
  }
  
  // คลิกปุ่ม "ไม่ใช่" -> ซ่อน modal
  if (logoutCancelBtn) {
    logoutCancelBtn.addEventListener("click", () => {
      hideLogoutModal();
    });
  }
  
  // คลิก overlay -> ซ่อน modal
  if (logoutModal) {
    const overlay = logoutModal.querySelector(".logout-modal-overlay");
    if (overlay) {
      overlay.addEventListener("click", () => {
        hideLogoutModal();
      });
    }
  }
  
  // คลิกปุ่ม "ใช่" -> ออกจากระบบจริง
  if (logoutConfirmBtn) {
    logoutConfirmBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
      } catch (_) {}

      clearSavedAvatar();

      try { sessionStorage.removeItem("redirectAfterAuth"); } catch (_) {}

      // ไปหน้า Home
      if (window.navigateWithTransition) window.navigateWithTransition("../../index.html"); else window.location.href = "../../index.html";
    });
  }
});

})();

