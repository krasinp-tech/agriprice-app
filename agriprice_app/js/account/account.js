// js/account/account.js
(function () {
  "use strict";

  // =========================
  // CONFIG (รองรับ DB/Backend)
  // =========================
  const AUTH_TOKEN_KEY = window.AUTH_TOKEN_KEY || "token"; // ถ้ามีระบบ auth ก็ใช้ได้
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, ""); // เช่น "https://your-backend.com"
  const ME_ENDPOINT = window.API_ME_ENDPOINT || "/api/users/me";   // ปรับให้ตรง backend ได้

  // เปิดโหมด debug ได้ด้วย window.ACCOUNT_DEBUG = true
  const DEBUG = !!window.ACCOUNT_DEBUG;

  // =========================
  // MOCK USER (fallback)
  // =========================
  const mockUser = {
    id: 1,
    fullName: "สมชาย ใจดี",
    roleLabel: "เกษตรกร",
    memberSince: "2024",
    avatarUrl: "https://i.pravatar.cc/200?img=47",
    stats: { following: 25, followers: 15, pros: 89 },
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
      
      // ถ้าไม่มี ลองโหลดจาก myprofile data ตาม role
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
      
      // อัพเดท myprofile_data ตาม role ด้วย
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

    // avatar: ถ้ามีรูปที่ user เคยเลือกไว้ ให้ใช้ก่อน
    const hasSaved = loadSavedAvatar(role);
    if (!hasSaved && avatarImg) avatarImg.src = u.avatarUrl || mockUser.avatarUrl;

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
    
    // ✅ ซ่อน "รายการโปร" สำหรับ buyer
    const prosStatEl = statPros?.closest('.stat');
    const prosStatDivider = prosStatEl?.previousElementSibling;
    
    if (role === "buyer") {
      // ซ่อน stat รายการโปรและ divider ก่อนหน้า
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

  // =========================
  // FETCH USER FROM API (รองรับ DB)
  // =========================
  function mapApiUserToViewModel(data) {
    // ปรับ mapping ให้ตรง backend ของคุณได้
    return {
      id: data.id ?? data.userId ?? 0,
      fullName: data.fullName ?? data.name ?? mockUser.fullName,
      roleLabel: data.roleLabel ?? data.role ?? mockUser.roleLabel,
      memberSince: data.memberSince ?? data.createdAt ?? mockUser.memberSince,
      avatarUrl: data.avatarUrl ?? data.avatar ?? mockUser.avatarUrl,
      stats: {
        following: data.stats?.following ?? data.followingCount ?? mockUser.stats.following,
        followers: data.stats?.followers ?? data.followerCount ?? mockUser.stats.followers,
        pros: data.stats?.pros ?? data.promoCount ?? mockUser.stats.pros,
      },
    };
  }

  async function fetchMeFromApi() {
    if (!API_BASE) {
      log("API_BASE_URL not set -> use mock");
      return null;
    }

    const token = getToken(); // มี token ก็ส่งไป, ไม่มีก็ยิงแบบ guest ได้ (แล้วแต่ backend)
    const url = API_BASE + ME_ENDPOINT;

    log("Fetching:", url);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include", // เผื่อ backend ใช้ cookie session
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

      // fallback: ใช้ mock + อ่าน role จาก localStorage (รองรับ 2 role)
      const role = getRole();
      const roleLabel = role === "buyer" ? "ผู้รับซื้อ" : role === "farmer" ? "เกษตรกร" : "ผู้ใช้งาน";
      
      // ✅ โหลดข้อมูลจาก myprofile_data ถ้ามี
      let userData = { ...mockUser, role, roleLabel };
      
      try {
        const parsed = loadJsonByKeys(getProfileKeysByRole(role));
        if (parsed) {
          
          // sync ชื่อจาก myprofile
          if (parsed.name) {
            userData.fullName = parsed.name;
          }
          
          // sync ยอดผู้ติดตามจาก myprofile
          if (parsed.followers !== undefined) {
            userData.stats = {
              ...userData.stats,
              followers: parsed.followers
            };
          }
        }
      } catch (err) {
        log("Failed to load myprofile data:", err);
      }
      
      renderUser(userData);
    } catch (e) {
      log("fetch error:", e);
      renderUser(mockUser);
    }
  }

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

        // ✅ อนาคต: อัปโหลดขึ้น backend ได้ตรงนี้
        // await uploadAvatarToApi(file);
      } catch (_) {
        alert("อ่านไฟล์รูปไม่สำเร็จ");
      } finally {
        fileInput.value = "";
      }
    });
  } else {
    // ถึงไม่มี element ก็ยังพยายามโหลดรูปที่เคยเซฟไว้
    loadSavedAvatar(getRole());
  }

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
  window.location.href = base + "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // ✅ เรียก initUser เพื่อโหลดข้อมูลและแสดงปุ่มตาม role
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
      window.location.href = "../../index.html";
    });
  }
});

})();
