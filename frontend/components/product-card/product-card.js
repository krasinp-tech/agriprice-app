/* components/product-card/product-card.js
 * Product Card Component (Shared)
 * - Render cards from template + data
 * - Role-based UI:
 *    buyer  -> hide booking/contact/favorite
 *    farmer -> show all
 */

(function () {
  // ---------------------------------------------------------------------------
  // Role configuration
  // ---------------------------------------------------------------------------
  // กำหนดชื่อ role ที่ใช้ใน localStorage และพฤติกรรมของการ์ดแต่ละบทบาท
  // - buyer  : ไม่แสดงปุ่มจอง/ติดต่อ/รายการโปรด, การ์ดไม่คลิกได้บนหน้าร้าน
  // - farmer : แสดงปุ่มทั้งหมด, การ์ดคลิกได้ตามปกติ
  // - guest  : ปฏิเสธการกระทำทั้งหมด (สามารถปรับได้ตามต้องการ)
  //
  // ใช้โดย getRole() เพื่อเลือกการตั้งค่าปัจจุบัน
  const ROLE_CONFIG = {
    buyer: {
      hideBook: true,        // ห้ามจองคิว
      hideContact: true,     // ห้ามติดต่อทั้งหมด
      hideFavorite: true,    // ห้ามเพิ่มรายการโปรด
      canViewProfile: true,  // ✅ สามารถเข้าดูโปรไฟล์ได้
      canMessage: true,      // ✅ สามารถส่งข้อความได้
      clickable: true,       // ✅ การ์ดคลิกได้ (เฉพาะ open-profile อนุญาต)
    },
    farmer: {
      hideBook: false,
      hideContact: false,
      hideFavorite: false,
      canViewProfile: true,
      canMessage: true,
      clickable: true,
    },
    guest: {
      hideBook: true,
      hideContact: true,
      hideFavorite: true,
      canViewProfile: true,   // ✅ guest ก็ดูโปรไฟล์ได้
      canMessage: false,      // ❌ guest ไม่ส่งข้อความ
      clickable: true,
    },
  };

  const TEMPLATE_PATH = "../../components/product-card/product-card.html"; // ปรับ path ตอนเรียกใช้ได้
  const STYLE_SELECTOR = 'link[data-component="product-card"]';

  function getRole() {
    // อ่านจาก localStorage - ถ้าไม่มี default เป็น "guest"
    const r = (localStorage.getItem("role") || "guest").toLowerCase();
    return ROLE_CONFIG[r] ? r : "guest";
  }

  async function loadTemplate(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load product-card template: " + path);
    return await res.text();
  }

  function ensureStylesheet(href) {
    // ถ้าใส่ css แล้วในหน้า ก็ไม่ต้องทำอะไร
    if (document.querySelector(STYLE_SELECTOR)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-component", "product-card");
    document.head.appendChild(link);
  }

  function safeText(el, value) {
    if (!el) return;
    el.textContent = value ?? "";
  }

  function safeAttr(el, name, value) {
    if (!el) return;
    if (value === undefined || value === null || value === "") el.removeAttribute(name);
    else el.setAttribute(name, value);
  }

  function resolveAssetPath(p) {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return String(p || "").replace(/^\/+/, "");
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../" + "../".repeat(depth) + String(p || "").replace(/^\/+/, "");
  }

  function normalizeAvatarUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;

    const apiBase = (window.API_BASE_URL || "").replace(/\/$/, "");
    if (value.startsWith('/uploads/')) return apiBase ? (apiBase + value) : value;
    if (value.startsWith('uploads/')) return apiBase ? (apiBase + '/' + value) : ('/' + value);

    if (value.startsWith('/assets/')) return resolveAssetPath(value.replace(/^\//, ''));
    if (value.startsWith('assets/')) return resolveAssetPath(value);

    return value;
  }

  function applyRoleSettings(card) {
    const role = getRole();
    const cfg = ROLE_CONFIG[role];
    if (!cfg) return;

    if (cfg.hideBook) card.querySelectorAll("[data-action='book']").forEach((x) => x.remove());
    if (cfg.hideContact) card.querySelectorAll("[data-action='contact']").forEach((x) => x.remove());
    if (cfg.hideFavorite) card.querySelectorAll("[data-action='favorite']").forEach((x) => x.remove());

    if (cfg.hideBook && cfg.hideContact && cfg.hideFavorite) {
      const actionsRow =
        card.querySelector(".card-actions") ||
        card.querySelector(".action-row") ||
        card.querySelector("[data-actions]");
      if (actionsRow) actionsRow.remove();
    }

    if (!cfg.clickable) {
      // ป้องกันการคลิกใดๆ บนการ์ด (เช่นในหน้าร้าน) โดยเพิ่มสไตล์
      card.style.pointerEvents = "none";
    }
  }

  function bindActions(card, data, handlers) {
    const role = getRole();
    const cfg = ROLE_CONFIG[role] || {};

    function stopClick(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // ให้แน่ใจว่า buyer/guest จะไม่ทำอะไรแม้ DOM ยังมีปุ่มอยู่
    const guard = (actionKey, fn) => (e) => {
      stopClick(e);
      // ตรวจสอบว่าจำได้ block action นี้ไหม
      if (cfg[`hide${actionKey.charAt(0).toUpperCase() + actionKey.slice(1)}`]) return;
      // ตรวจสอบ special permission (canMessage, canViewProfile)
      if (actionKey === "message" && !cfg.canMessage) return;
      if (actionKey === "profile" && !cfg.canViewProfile) return;
      fn && fn(e);
    };

    const btnBook = card.querySelector("[data-action='book']");
    const btnContact = card.querySelector("[data-action='contact']");
    const btnFav = card.querySelector("[data-action='favorite']");
    const btnProfile = card.querySelector("[data-action='open-profile']");
    const btnMessage = card.querySelector("[data-action='message']");

    if (btnBook) btnBook.addEventListener("click", guard('book', () => handlers?.onBook?.(data, card)));
    if (btnContact) btnContact.addEventListener("click", guard('contact', () => handlers?.onContact?.(data, card)));
    if (btnFav) btnFav.addEventListener("click", guard('favorite', () => handlers?.onFavorite?.(data, card)));
    if (btnProfile) btnProfile.addEventListener("click", guard('profile', () => handlers?.onProfile?.(data, card)));
    if (btnMessage) btnMessage.addEventListener("click", guard('message', () => handlers?.onMessage?.(data, card)));
  }

  /**
   * Render a product card element from data.
   * @param {object} data
   * @param {object} handlers { onBook, onContact, onFavorite }
   * @param {string} templateHtml
   * @returns {HTMLElement}
   */
  function createCardEl(data, handlers, templateHtml) {
    const wrap = document.createElement("div");
    wrap.innerHTML = templateHtml.trim();

    // คาดว่า template root เป็น element แรก
    const card = wrap.firstElementChild || wrap;

    // ===== mapping แบบยืดหยุ่น (รองรับชื่อฟิลด์ที่คุณอาจใช้)
    const title = data.title || data.name || data.fruit_name || "";
    const subtitle = data.subtitle || data.location || data.province || "";
    const priceA = data.priceA ?? data.gradeA ?? data.a ?? "";
    const priceB = data.priceB ?? data.gradeB ?? data.b ?? "";
    const priceC = data.priceC ?? data.gradeC ?? data.c ?? "";
    const distance = data.distance || data.km || "";
    const updated = data.updated || data.updated_at || data.timeText || "";
    const imageUrl =
      data.avatar ||
      data.sellerAvatar ||
      data.profileAvatar ||
      data.image ||
      data.imageUrl ||
      data.cover ||
      "";
    const fallbackImage = resolveAssetPath("assets/images/avatar-guest.svg");

    // ===== fill text (รองรับ selector หลายแบบ)
    safeText(card.querySelector("[data-field='title'], .card-title, .title"), title);
    safeText(card.querySelector("[data-field='subtitle'], .card-subtitle, .subtitle"), subtitle);

    safeText(card.querySelector("[data-field='priceA'], .price-a, .grade-a"), priceA);
    safeText(card.querySelector("[data-field='priceB'], .price-b, .grade-b"), priceB);
    safeText(card.querySelector("[data-field='priceC'], .price-c, .grade-c"), priceC);

    safeText(card.querySelector("[data-field='distance'], .distance"), distance);
    safeText(card.querySelector("[data-field='updated'], .updated"), updated);

    const img = card.querySelector("img[data-field='image'], .card-img img, img.card-img, img");
    if (img) {
      safeAttr(img, "src", normalizeAvatarUrl(imageUrl) || fallbackImage);
      safeAttr(img, "onerror", `this.onerror=null;this.src='${fallbackImage}';`);
      safeAttr(img, "alt", title || "รายการ");
    }

    // เก็บ id ไว้กับ element เผื่อใช้งานต่อ
    if (data.id !== undefined) card.dataset.id = data.id;

    // ===== apply role-specific UI/behavior
    applyRoleSettings(card);

    // ===== bind handlers
    bindActions(card, data, handlers);

    return card;
  }

  /**
   * Public API: ProductCard.mount(container, items, options)
   * - container: DOM element / selector
   * - items: array of data objects
   * - options:
   *    templatePath, cssPath, handlers
   */
  async function mount(container, items = [], options = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) throw new Error("ProductCard.mount: container not found");

    const templatePath = options.templatePath || TEMPLATE_PATH;
    const cssPath = options.cssPath || "../../components/product-card/product-card.css";
    const handlers = options.handlers || {};

    // ensure css
    ensureStylesheet(cssPath);

    // load template
    const templateHtml = await loadTemplate(templatePath);

    // clear container
    el.innerHTML = "";

    // render
    items.forEach((it) => {
      const card = createCardEl(it, handlers, templateHtml);
      el.appendChild(card);
    });
  }

  // Expose global
  window.ProductCard = {
    mount,
    createCardEl, // เผื่อหน้าบางหน้าจะสร้างทีละใบเอง
  };
})();