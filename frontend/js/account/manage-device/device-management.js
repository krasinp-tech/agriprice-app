(function() {
  "use strict";

  const api = window.api || {};
  let pendingSessionId = null;

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getApiBase() {
    return window.getAgriPriceApiUrl
      ? window.getAgriPriceApiUrl()
      : (window.API_BASE_URL || "").replace(/\/$/, "");
  }

  function authHeaders(extra = {}) {
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    return token ? { Authorization: "Bearer " + token, ...extra } : extra;
  }

  function normalizeSessions(payload) {
    const rows = Array.isArray(payload) ? payload : (payload?.data || []);
    const sessions = rows.map((s) => ({
      id: String(s.id || s.session_id || ""),
      name: s.deviceName || s.device_name || s.name || t("unknown_device", "Unknown device"),
      icon: s.icon || s.device_icon || s.device_type || "devices",
      location: s.location || s.ip_address || t("unknown_location", "Unknown location"),
      lastActiveText: s.last_active_text || s.lastActive || s.last_active || s.created_at || "",
      isCurrent: s.isCurrent === true || s.current === true,
    })).filter((s) => s.id);

    if (sessions.length > 0 && !sessions.some((s) => s.isCurrent)) {
      sessions[0].isCurrent = true;
    }
    return sessions;
  }

  async function fetchSessions() {
    if (api.getDeviceSessions) {
      return normalizeSessions(await api.getDeviceSessions());
    }

    const res = await fetch(getApiBase() + "/api/device-sessions", {
      headers: authHeaders()
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || "Failed to load device sessions");
    return normalizeSessions(json);
  }

  function renderDevice(session) {
    const badge = session.isCurrent
      ? `<span class="current-badge">${escapeHtml(t("current_device", "This device"))}</span>`
      : "";

    return `
      <div class="device-item fade-slide">
        <div class="device-icon"><span class="material-icons-outlined">${escapeHtml(session.icon)}</span></div>
        <div class="device-info">
          <div class="device-name">${escapeHtml(session.name)} ${badge}</div>
          <div class="device-meta">${escapeHtml(session.location)} &bull; ${escapeHtml(session.lastActiveText || "-")}</div>
        </div>
        ${session.isCurrent ? "" : `<button class="device-logout-btn" type="button" data-logout-device="${escapeHtml(session.id)}">${escapeHtml(t("logout_device", "Log out"))}</button>`}
      </div>
    `;
  }

  function setModalError(message) {
    const errorEl = document.getElementById("modalError");
    if (errorEl) errorEl.textContent = message || "";
  }

  function openLogoutModal(sessionId) {
    pendingSessionId = sessionId;
    const modal = document.getElementById("logoutModal");
    const password = document.getElementById("modalPassword");

    setModalError("");
    if (password) password.value = "";
    if (modal) modal.classList.add("show");
    setTimeout(() => password?.focus(), 50);
  }

  function closeLogoutModal() {
    const modal = document.getElementById("logoutModal");
    const password = document.getElementById("modalPassword");

    pendingSessionId = null;
    setModalError("");
    if (password) password.value = "";
    if (modal) modal.classList.remove("show");
  }

  async function logoutDevice(sessionId, password) {
    if (api.logoutDevice) {
      return api.logoutDevice(sessionId, password);
    }

    const res = await fetch(getApiBase() + "/api/device-sessions/" + encodeURIComponent(sessionId) + "/logout", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ password })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || "Failed to log out device");
    return json;
  }

  async function confirmLogout() {
    const password = document.getElementById("modalPassword")?.value || "";
    const button = document.getElementById("modalLogoutBtn");

    if (!pendingSessionId) return;
    if (!password) {
      setModalError(t("password_required", "Password is required"));
      return;
    }

    try {
      if (button) button.disabled = true;
      await logoutDevice(pendingSessionId, password);
      closeLogoutModal();
      await loadSessions();
    } catch (err) {
      setModalError(err.message || t("logout_device_failed", "Failed to log out device"));
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadSessions() {
    const currentEl = document.getElementById("deviceCurrent");
    const otherEl = document.getElementById("deviceOther");
    if (!currentEl && !otherEl) return;

    if (currentEl) {
      currentEl.innerHTML = `<div class="device-state">${escapeHtml(t("loading_devices", "กำลังโหลดข้อมูลอุปกรณ์..."))}</div>`;
    }
    if (otherEl) otherEl.innerHTML = "";

    try {
      const sessions = await fetchSessions();
      const current = sessions.find((s) => s.isCurrent);
      const others = sessions.filter((s) => !s.isCurrent);

      if (currentEl) {
        currentEl.innerHTML = current
          ? renderDevice(current)
          : `<div class="device-state">${escapeHtml(t("no_device_sessions", "ยังไม่พบข้อมูลอุปกรณ์ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่หนึ่งครั้ง"))}</div>`;
      }
      if (otherEl) {
        otherEl.innerHTML = others.length
          ? others.map(renderDevice).join("")
          : `<div class="device-meta">${escapeHtml(t("no_other_devices", "No other active sessions"))}</div>`;
      }
    } catch (err) {
      console.error("[DeviceMgmt] Load failed:", err);
      if (currentEl) {
        currentEl.innerHTML = `<div class="modal-error device-state">${escapeHtml(err.message || t("load_devices_failed", "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้"))}</div>`;
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const logoutBtn = event.target.closest("[data-logout-device]");
      if (logoutBtn) {
        openLogoutModal(logoutBtn.dataset.logoutDevice);
        return;
      }

      if (event.target.id === "modalCloseBtn" || event.target.id === "logoutModal") {
        closeLogoutModal();
      }
    });

    document.getElementById("modalLogoutBtn")?.addEventListener("click", confirmLogout);
    document.getElementById("modalPassword")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") confirmLogout();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadSessions();
  });
  window.addEventListener("agriprice:realtime:session", loadSessions);
})();
