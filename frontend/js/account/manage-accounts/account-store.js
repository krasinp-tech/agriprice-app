(function (window) {
  "use strict";

  const STORAGE_KEY = "account_manage_data_v1";
  const DEFAULT_DATA = {
    phone: "+66*******361",
    email: "",
    birthDate: "2004-01-01",
    accountStatus: "active",
    passwordUpdatedAt: "",
  };

  function getApiBase() {
    const API_BASE = (window.API_BASE_URL || 'https://agriprice-app.onrender.com').replace(/\/$/, '');
    if (API_BASE) return API_BASE;

    const origin = asText(window.location && window.location.origin);
    if (/localhost|127\.0\.0\.1/i.test(origin)) return "https://agriprice-app.onrender.com";
    if (/^https?:\/\//i.test(origin)) return origin.replace(/\/$/, "");
    return "https://agriprice.com";
  }

  function getToken() {
    try {
      const tokenKey = window.AUTH_TOKEN_KEY || "token";
      return asText(localStorage.getItem(tokenKey));
    } catch (_) {
      return "";
    }
  }

  async function apiFetch(path, options) {
    const token = getToken();
    const t = (k, f) => (window.i18nT ? window.i18nT(k, f) : f);
    if (!token) throw new Error(t('please_login_again', "กรุณาเข้าสู่ระบบใหม่"));

    const init = options || {};
    const headers = {
      ...(init.headers || {}),
      Authorization: "Bearer " + token,
    };

    const res = await fetch(getApiBase() + path, { ...init, headers });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) {}

    if (!res.ok) {
      const message = (body && (body.message || body.error || body.detail)) || `Request failed (${res.status})`;
      throw new Error(message);
    }

    return body;
  }

  function mapProfileToStore(profile) {
    if (!profile || typeof profile !== "object") return null;
    return normalize({
      phone: profile.phone,
      email: profile.email,
      birthDate: profile.birth_date,
      accountStatus: profile.account_status === "disabled" ? "disabled" : "active",
    });
  }

  function saveLocal(data) {
    const next = normalize(data);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    return next;
  }

  function cloneDefaults() {
    return { ...DEFAULT_DATA };
  }

  function asText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalize(data) {
    const base = cloneDefaults();
    if (!data || typeof data !== "object") return base;

    const merged = { ...base, ...data };
    merged.phone = asText(merged.phone) || base.phone;
    merged.email = asText(merged.email);
    merged.birthDate = asText(merged.birthDate) || base.birthDate;
    merged.accountStatus = merged.accountStatus === "disabled" ? "disabled" : "active";
    merged.passwordUpdatedAt = asText(merged.passwordUpdatedAt);

    return merged;
  }

  function getData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaults();
      return normalize(JSON.parse(raw));
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
    // [FIX] GET /api/profile ส่ง object ตรงๆ ไม่มี wrapper {data:...}
    // แต่เผื่อ API เปลี่ยนในอนาคต ให้รองรับทั้งสองรูปแบบ
    const profile = (res && typeof res === 'object' && res.data) ? res.data : res;
    const mapped = mapProfileToStore(profile);
    if (!mapped) return getData();
    return saveLocal({ ...getData(), ...mapped });
  }

  async function updateProfileOnServer(payload) {
    const body = { ...(payload || {}) };
    // [FIX] server PATCH /api/profile ส่ง {message: "อัปเดตโปรไฟล์สำเร็จ"} กลับมา
    // ไม่ใช่ {data: {...}} — ดังนั้น response ใช้แค่ confirm success เท่านั้น
    const response = await apiFetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const localPatch = {};
    if (body.phone !== undefined) localPatch.phone = body.phone;
    if (body.email !== undefined) localPatch.email = body.email;
    if (body.birth_date !== undefined) localPatch.birthDate = body.birth_date;
    if (body.account_status !== undefined) localPatch.accountStatus = body.account_status;

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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: asText(reason) }),
    });
  }

  function formatThaiDate(dateValue) {
    const value = asText(dateValue);
    if (!value) return "-";
 
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
 
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
    getApiBase,
    getToken,
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
