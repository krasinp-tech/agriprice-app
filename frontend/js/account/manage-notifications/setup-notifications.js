(function () {
  "use strict";

  // Notification types by role
  const notifyTypes = {
    buyer: [
      { key: "orderStatus", label: window.i18nT ? window.i18nT('order_status_label', 'สถานะการจอง') : 'สถานะการจอง', desc: window.i18nT ? window.i18nT('order_status_desc', 'แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจอง') : 'แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจอง' },
      { key: "newFollower", label: window.i18nT ? window.i18nT('new_followers', 'ผู้ติดตามใหม่') : 'ผู้ติดตามใหม่', desc: window.i18nT ? window.i18nT('new_follower_desc', 'แจ้งเตือนเมื่อมีผู้ติดตามใหม่') : 'แจ้งเตือนเมื่อมีผู้ติดตามใหม่' },
      { key: "promo", label: window.i18nT ? window.i18nT('promo_label', 'โปรโมชั่นใหม่') : 'โปรโมชั่นใหม่', desc: window.i18nT ? window.i18nT('promo_desc', 'แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ') : 'แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ' },
      { key: "chat", label: window.i18nT ? window.i18nT('chat_label', 'ข้อความแชทใหม่') : 'ข้อความแชทใหม่', desc: window.i18nT ? window.i18nT('chat_desc_buyer', 'แจ้งเตือนเมื่อมีข้อความใหม่จากเกษตรกร') : 'แจ้งเตือนเมื่อมีข้อความใหม่จากเกษตรกร' },
      { key: "system", label: window.i18nT ? window.i18nT('system_label', 'ข่าวสารระบบ') : 'ข่าวสารระบบ', desc: window.i18nT ? window.i18nT('system_desc', 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ') : 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ' },
    ],
    farmer: [
      { key: "bookingStatus", label: window.i18nT ? window.i18nT('order_status_label', 'สถานะการจอง') : 'สถานะการจอง', desc: window.i18nT ? window.i18nT('booking_status_desc', 'แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจองเข้ามา') : 'แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจองเข้ามา' },
      { key: "priceUpdate", label: window.i18nT ? window.i18nT('price_update_label', 'การแจ้งเตือนจากผู้รับซื้อ ') : 'การแจ้งเตือนจากผู้รับซื้อ ', desc: window.i18nT ? window.i18nT('price_update_desc', 'แจ้งเตือนเมื่อมีการอัพเดทราคาใหม่จากผู้รับซื้อทีถูกใจ') : 'แจ้งเตือนเมื่อมีการอัพเดทราคาใหม่จากผู้รับซื้อทีถูกใจ' },
      { key: "chat", label: window.i18nT ? window.i18nT('chat_label', 'ข้อความแชทใหม่') : 'ข้อความแชทใหม่', desc: window.i18nT ? window.i18nT('chat_desc_farmer', 'แจ้งเตือนเมื่อมีข้อความใหม่จากผู้ซื้อหรือเจ้าหน้าที่') : 'แจ้งเตือนเมื่อมีข้อความใหม่จากผู้ซื้อหรือเจ้าหน้าที่' },
      { key: "system", label: window.i18nT ? window.i18nT('system_label', 'ข่าวสารระบบ') : 'ข่าวสารระบบ', desc: window.i18nT ? window.i18nT('system_desc', 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ') : 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ' },
    ],
    guest: [
      { key: "system", label: window.i18nT ? window.i18nT('system_label', 'ข่าวสารระบบ') : 'ข่าวสารระบบ', desc: window.i18nT ? window.i18nT('system_desc', 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ') : 'แจ้งเตือนข่าวสารหรือประกาศจากระบบ' },
      { key: "promo", label: window.i18nT ? window.i18nT('promo_label', 'โปรโมชั่นใหม่') : 'โปรโมชั่นใหม่', desc: window.i18nT ? window.i18nT('promo_desc', 'แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ') : 'แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ' },
    ],
  };

  // Detect role
  function getRole() {
    try {
      return String(localStorage.getItem("role") || "guest").toLowerCase();
    } catch (_) {
      return "guest";
    }
  }

  function getApiBase() {
    const configured = String(window.API_BASE_URL || "").trim().replace(/\/$/, "");
    if (configured) return configured;
    const origin = String(window.location && window.location.origin || "");
    if (/localhost|127\.0\.0\.1/i.test(origin)) return "https://agriprice-app.onrender.com";
    if (/^https?:\/\//i.test(origin)) return origin.replace(/\/$/, "");
    return "https://agriprice.com";
  }

  function getToken() {
    try {
      const tokenKey = window.AUTH_TOKEN_KEY || "token";
      return String(localStorage.getItem(tokenKey) || "").trim();
    } catch (_) {
      return "";
    }
  }

  const role = getRole();
  const types = notifyTypes[role] || notifyTypes["guest"];

  // Storage
  const STORAGE_KEY = "notify_settings_v1";
  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  }
  function setSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  async function fetchServerSettings() {
    const token = getToken();
    if (!token) return null;

    const res = await fetch(getApiBase() + "/api/notification-settings", {
      method: "GET",
      headers: { Authorization: "Bearer " + token },
    });
    if (!res.ok) throw new Error(window.i18nT ? window.i18nT('load_settings_error', 'โหลดการตั้งค่าจากเซิร์ฟเวอร์ไม่สำเร็จ') : 'โหลดการตั้งค่าจากเซิร์ฟเวอร์ไม่สำเร็จ');

    const json = await res.json();
    const settings = (json && json.data && json.data.settings && typeof json.data.settings === "object") ? json.data.settings : {};
    setSettings(settings);
    return settings;
  }

  async function patchServerSettings(settings) {
    const token = getToken();
    if (!token) return;

    const res = await fetch(getApiBase() + "/api/notification-settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ role, settings }),
    });

    if (!res.ok) {
      let message = window.i18nT ? window.i18nT('save_settings_error', 'บันทึกการตั้งค่าไม่สำเร็จ') : 'บันทึกการตั้งค่าไม่สำเร็จ';
      try {
        const json = await res.json();
        if (json && json.message) message = json.message;
      } catch (_) {}
      throw new Error(message);
    }
  }

  // Render
  const notifyForm = document.getElementById("notifyForm");
  const notifyMessage = document.getElementById("notifyMessage");

  function showSavedMessage(text) {
    if (!notifyMessage) return;
    notifyMessage.textContent = text;
    setTimeout(() => {
      if (notifyMessage.textContent === text) notifyMessage.textContent = "";
    }, 1200);
  }

  function renderToggles() {
    if (!notifyForm) return;
    notifyForm.innerHTML = "";
    const settings = getSettings();
    types.forEach(type => {
      const checked = settings[type.key] === true;
      const row = document.createElement("div");
      row.className = "notify-toggle-row";

      const labelWrap = document.createElement("div");
      labelWrap.style.flex = "1";
      labelWrap.innerHTML = `<div class="notify-label">${type.label}</div><div class="notify-desc">${type.desc}</div>`;

      const switchWrap = document.createElement("label");
      switchWrap.className = "notify-switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = checked;
      input.setAttribute("data-key", type.key);
      const slider = document.createElement("span");
      slider.className = "notify-slider";
      switchWrap.appendChild(input);
      switchWrap.appendChild(slider);

      input.addEventListener("change", async function () {
        const settings = getSettings();
        settings[type.key] = input.checked;
        setSettings(settings);

        try {
          await patchServerSettings(settings);
          const successMsg = window.i18nT ? window.i18nT('save_settings_success', 'บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อย') : 'บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อย';
          showSavedMessage(successMsg);
        } catch (err) {
          showSavedMessage(err.message || (window.i18nT ? window.i18nT('save_settings_error', 'บันทึกการตั้งค่าไม่สำเร็จ') : 'บันทึกการตั้งค่าไม่สำเร็จ'));
        }
      });

      row.appendChild(labelWrap);
      row.appendChild(switchWrap);
      notifyForm.appendChild(row);
    });
  }

  async function init() {
    renderToggles();
    try {
      await fetchServerSettings();
      renderToggles();
    } catch (_) {
      // Keep local settings if API is unavailable.
    }
  }

  init();
})();