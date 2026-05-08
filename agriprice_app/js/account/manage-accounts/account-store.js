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
    const next = normalize({ ...getData(), ...(partial || {}) });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    return next;
  }

  function resetData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    return cloneDefaults();
  }

  function formatThaiDate(dateValue) {
    const value = asText(dateValue);
    if (!value) return "-";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";

    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const day = parsed.getDate();
    const month = months[parsed.getMonth()];
    const year = parsed.getFullYear();

    return `${day} ${month} ค.ศ. ${year}`;
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
    if (!value) return "ยังไม่ได้เพิ่มอีเมล";

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
    formatThaiDate,
    maskPhone,
    maskEmail,
  };
})(window);
