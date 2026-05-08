(function () {
  "use strict";

  // Notification types by role
  const notifyTypes = {
    buyer: [
      { key: "orderStatus", label: "สถานะการจอง", desc: "แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจอง" },
      { key: "newFollower", label: "ผู้ติดตามใหม่", desc: "แจ้งเตือนเมื่อมีผู้ติดตามใหม่" },
      { key: "promo", label: "โปรโมชั่นใหม่", desc: "แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ" },
      { key: "chat", label: "ข้อความแชทใหม่", desc: "แจ้งเตือนเมื่อมีข้อความใหม่จากเกษตรกร" },
      { key: "system", label: "ข่าวสารระบบ", desc: "แจ้งเตือนข่าวสารหรือประกาศจากระบบ" },
    ],
    farmer: [
      { key: "bookingStatus", label: "สถานะการจอง", desc: "แจ้งเตือนเมื่อมีการเปลี่ยนแปลงสถานะการจองเข้ามา" },
      { key: "priceUpdate", label: "การแจ้งเตือนจากผู้รับซื้อ ", desc: "แจ้งเตือนเมื่อมีการอัพเดทราคาใหม่จากผู้รับซื้อทีถูกใจ" },
      { key: "chat", label: "ข้อความแชทใหม่", desc: "แจ้งเตือนเมื่อมีข้อความใหม่จากผู้ซื้อหรือเจ้าหน้าที่" },
      { key: "system", label: "ข่าวสารระบบ", desc: "แจ้งเตือนข่าวสารหรือประกาศจากระบบ" },
    ],
    guest: [
      { key: "system", label: "ข่าวสารระบบ", desc: "แจ้งเตือนข่าวสารหรือประกาศจากระบบ" },
      { key: "promo", label: "โปรโมชั่นใหม่", desc: "แจ้งเตือนเมื่อมีโปรโมชั่นหรือข้อเสนอพิเศษ" },
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

  // Render
  const notifyForm = document.getElementById("notifyForm");
  const notifyMessage = document.getElementById("notifyMessage");

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

      input.addEventListener("change", function () {
        const settings = getSettings();
        settings[type.key] = input.checked;
        setSettings(settings);
        if (notifyMessage) {
          notifyMessage.textContent = "บันทึกการตั้งค่าการแจ้งเตือนเรียบร้อย";
          setTimeout(() => { notifyMessage.textContent = ""; }, 1200);
        }
      });

      row.appendChild(labelWrap);
      row.appendChild(switchWrap);
      notifyForm.appendChild(row);
    });
  }

  renderToggles();
})();