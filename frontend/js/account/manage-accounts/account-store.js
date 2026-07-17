(function (window) {
  "use strict";

  const STORAGE_KEY = "account_manage_data_v1";
  const DEFAULT_DATA = {
    ownerId: "",
    phone: "",
    email: "",
    birthDate: "",
    accountStatus: "active",
    passwordUpdatedAt: "",
  };

  async function apiFetch(path, options = {}) {
    const api = window.api || {};
    if (api.call) {
      return await api.call(options.method || 'GET', path, options.body ? JSON.parse(options.body) : null);
    }
    // Fallback if window.api is not yet ready
    const token = localStorage.getItem('token');
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    if (!token) throw new Error(t('please_login_again', "กรุณาเข้าสู่ระบบใหม่"));
    const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
    const res = await fetch(currentBase + path, {
      method: options.method || 'GET',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: options.body
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
    return json;
  }

  function mapProfileToStore(profile) {
    if (!profile || typeof profile !== "object") return null;
    return normalize({
      ownerId: profile.profile_id || profile.id || getCurrentUserId(),
      phone: profile.phone,
      email: profile.email,
      birthDate: profile.birth_date,
      accountStatus: profile.account_status === "disabled" ? "disabled" : "active",
      fullName: (profile.first_name || profile.last_name) ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : "",
      avatar: profile.avatar || "",
      lat: profile.lat,
      lng: profile.lng
    });
  }

  function saveLocal(data) {
    const next = normalize(data);
    next.ownerId = getCurrentUserId();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    return next;
  }

  function cloneDefaults() {
    return { ...DEFAULT_DATA, ownerId: getCurrentUserId() };
  }

  function asText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getCurrentUserId() {
    try {
      const user = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || "user_data") || "null");
      return asText(user?.id || user?.profile_id);
    } catch (_) {
      return "";
    }
  }

  function normalize(data) {
    const base = cloneDefaults();
    if (!data || typeof data !== "object") return base;

    const merged = { ...base, ...data };
    merged.ownerId = asText(merged.ownerId);
    merged.phone = asText(merged.phone) || base.phone;
    merged.email = asText(merged.email);
    merged.birthDate = asText(merged.birthDate) || base.birthDate;
    merged.accountStatus = merged.accountStatus === "disabled" ? "disabled" : "active";
    merged.passwordUpdatedAt = asText(merged.passwordUpdatedAt);

    return merged;
  }

  function getData() {
    try {
      const currentUserId = getCurrentUserId();
      if (!currentUserId) return cloneDefaults();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaults();
      const cached = normalize(JSON.parse(raw));
      if (cached.ownerId !== currentUserId) return cloneDefaults();
      return cached;
    } catch (_) {
      return cloneDefaults();
    }
  }

  function setData(partial) {
    return saveLocal({ ...getData(), ...(partial || {}) });
  }

  function resetData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    return cloneDefaults();
  }

  async function syncFromServer() {
    const res = await apiFetch("/api/profile", { method: "GET" });
    const profile = (res && typeof res === 'object' && res.data) ? res.data : res;
    const mapped = mapProfileToStore(profile);
    if (!mapped) return getData();
    // The authenticated profile is authoritative. Never merge fields from a
    // previous account into the newly authenticated user's cache.
    return saveLocal(mapped);
  }

  async function updateProfileOnServer(payload) {
    const response = await apiFetch("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    const localPatch = {};
    if (payload.phone !== undefined) localPatch.phone = payload.phone;
    if (payload.email !== undefined) localPatch.email = payload.email;
    if (payload.birth_date !== undefined) localPatch.birthDate = payload.birth_date;
    if (payload.account_status !== undefined) localPatch.accountStatus = payload.account_status;

    if (Object.keys(localPatch).length) setData(localPatch);
    return { response, data: getData() };
  }

  async function updatePhone(phone, otpCode) {
    const payload = { phone: asText(phone) };
    const code = asText(otpCode);
    if (code) payload.otp_code = code;
    return updateProfileOnServer(payload);
  }

  async function updateEmail(email) {
    return updateProfileOnServer({ email: asText(email).toLowerCase() });
  }

  async function updateBirthDate(birthDate) {
    return updateProfileOnServer({ birth_date: asText(birthDate) });
  }

  async function setAccountStatus(accountStatus) {
    const normalizedStatus = accountStatus === "disabled" ? "disabled" : "active";
    return updateProfileOnServer({ account_status: normalizedStatus });
  }

  async function changePassword(currentPassword, newPassword) {
    const response = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        current_password: asText(currentPassword),
        new_password: asText(newPassword),
      }),
    });
    setData({ passwordUpdatedAt: new Date().toISOString() });
    return response;
  }

  async function deleteAccount(reason) {
    return apiFetch("/api/profile", {
      method: "DELETE",
      body: JSON.stringify({ reason: asText(reason) }),
    });
  }

  function formatThaiDate(dateValue) {
    const value = asText(dateValue);
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    if (!value) return t('unspecified', 'ไม่ได้ระบุ');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return t('unspecified', 'ไม่ได้ระบุ');
    const lang = localStorage.getItem('lang') || 'th';
    const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
  }

  function maskPhone(phone) {
    const value = asText(phone);
    if (!value) return "-";
    if (value.includes("*")) return value;
    const digits = value.replace(/\D/g, "");
    if (digits.length < 6) return value;
    const last3 = digits.slice(-3);
    const prefix = value.startsWith("+66") ? "+66" : value.slice(0, 3);
    return `${prefix}*******${last3}`;
  }

  function maskEmail(email) {
    const value = asText(email);
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    if (!value) return t('no_email', "ยังไม่ได้เพิ่มอีเมล");
    const parts = value.split("@");
    if (parts.length !== 2) return value;
    const name = parts[0];
    const domain = parts[1];
    if (!name) return value;
    const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***`;
    return `${maskedName}@${domain}`;
  }

  window.AccountManageStore = {
    getData,
    setData,
    resetData,
    syncFromServer,
    updatePhone,
    updateEmail,
    updateBirthDate,
    setAccountStatus,
    changePassword,
    deleteAccount,
    formatThaiDate,
    maskPhone,
    maskEmail,
  };
})(window);
