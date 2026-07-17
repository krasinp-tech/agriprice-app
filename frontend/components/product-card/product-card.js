/* components/product-card/product-card.js
 * Product Card Component (Shared)
 * - Render cards from template + data
 * - Role-based UI:
 *    buyer  -> hide booking/contact/favorite
 *    farmer -> show all
 *    owner  -> show status/edit
 */

(function () {
  // ---------------------------------------------------------------------------
  // Role configuration
  // ---------------------------------------------------------------------------
  const ROLE_CONFIG = {
    buyer: {
      hideBook: true,
      hideContact: true,
      hideFavorite: true,
      canViewProfile: true,
      canMessage: true,
      clickable: true,
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
      canViewProfile: true,
      canMessage: false,
      clickable: true,
    },
  };

  const TEMPLATE_PATH = "../../components/product-card/product-card.html";
  const STYLE_SELECTOR = 'link[data-component="product-card"]';
  let cachedTemplate = null;

  function getRole() {
    const r = (localStorage.getItem("role") || "guest").toLowerCase();
    return ROLE_CONFIG[r] ? r : "guest";
  }

  async function loadTemplate(path) {
    if (cachedTemplate) return cachedTemplate;
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load product-card template: " + path);
    cachedTemplate = await res.text();
    return cachedTemplate;
  }

  function ensureStylesheet(href) {
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

  function safeHtml(el, value) {
    if (!el) return;
    el.innerHTML = value ?? "";
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

  function applyRoleSettings(card, isOwner = false) {
    if (isOwner) {
      // Owner view: Hide standard actions, show owner actions
      card.querySelectorAll("[data-action='book'], [data-action='contact'], [data-action='toggle-favorite']").forEach(x => x.remove());
      card.querySelectorAll("[data-action='toggle-status'], [data-action='edit-purchase']").forEach(x => x.style.display = "");
      card.querySelectorAll(".pc-options-menu").forEach(x => x.style.display = "block");
      
      // Hide distance for the owner
      const distWrap = card.querySelector(".distance");
      if (distWrap) distWrap.style.display = "none";
      return;
    }

    const role = getRole();
    const cfg = ROLE_CONFIG[role];
    if (!cfg) return;

    if (cfg.hideBook) card.querySelectorAll("[data-action='book']").forEach((x) => x.remove());
    if (cfg.hideContact) card.querySelectorAll("[data-action='contact']").forEach((x) => x.remove());
    if (cfg.hideFavorite) card.querySelectorAll("[data-action='toggle-favorite']").forEach((x) => x.remove());

    if (cfg.hideBook && cfg.hideContact) {
       // If both actions are hidden, maybe hide the whole row? 
       // But wait, the row might have status/edit buttons if owner. 
       // Already handled by if(isOwner) above.
    }

    if (!cfg.clickable) {
      // card.style.pointerEvents = "none"; // Might block profile clicks
    }
  }

  function bindActions(card, data, handlers) {
    function stopClick(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const bind = (selector, event, actionKey, handler) => {
      const el = card.querySelector(selector);
      if (el && handler) {
        el.addEventListener(event, (e) => {
          stopClick(e);
          handler(data, card);
        });
      }
    };

    bind("[data-action='book']", "click", "book", handlers?.onBook);
    bind("[data-action='contact']", "click", "contact", handlers?.onContact);
    bind("[data-action='toggle-favorite']", "click", "favorite", handlers?.onFavorite);
    bind("[data-action='open-profile']", "click", "profile", handlers?.onProfile);
    bind("[data-action='toggle-status']", "click", "toggle-status", handlers?.onToggleStatus);
    bind("[data-action='edit-purchase']", "click", "edit", handlers?.onEdit);

    // Toggle Options Dropdown Menu
    const toggleBtn = card.querySelector("[data-action='toggle-options']");
    const dropdown = card.querySelector(".pc-dropdown-menu");
    if (toggleBtn && dropdown) {
      toggleBtn.addEventListener("click", (e) => {
        stopClick(e);
        // Close all other dropdown menus first
        document.querySelectorAll(".pc-dropdown-menu").forEach(d => {
          if (d !== dropdown) d.style.display = "none";
        });
        const isHidden = dropdown.style.display === "none";
        dropdown.style.display = isHidden ? "block" : "none";
      });
    }

    // Handle clicking anywhere on document to close all dropdowns
    if (!window.__AGRIPRICE_DROPDOWN_CLOSE_WIRED) {
      window.__AGRIPRICE_DROPDOWN_CLOSE_WIRED = true;
      document.addEventListener("click", () => {
        document.querySelectorAll(".pc-dropdown-menu").forEach(d => d.style.display = "none");
      });
    }

    bind("[data-action='delete-purchase']", "click", "delete", (d, c) => {
      if (dropdown) dropdown.style.display = "none";
      if (handlers?.onDelete) {
        handlers.onDelete(d, c);
      }
    });
  }

  /**
   * Render a product card element from data.
   */
  function createCardEl(data, handlers, templateHtml) {
    const wrap = document.createElement("div");
    wrap.innerHTML = templateHtml.trim();
    
    // Handle both raw HTML and <template> tags
    let target = wrap.querySelector('template');
    if (target) {
        target = target.content.firstElementChild;
    } else {
        target = wrap.firstElementChild;
    }
    
    if (!target) return document.createElement('div');
    const card = target.cloneNode(true);

    const title = data.title || data.name || data.fruit_name || "";
    const subtitle = data.subtitle || data.location || data.province || "";
    const updated = data.updated || data.updated_at || data.timeText || "";
    const imageUrl = data.avatar || data.sellerAvatar || data.profileAvatar || data.image || data.imageUrl || data.cover || "";
    const isActive = data.is_active !== undefined ? !!data.is_active : true;
    const isOwner = !!data.isOwner;
    
    // Fix hardcoded relative paths in the template if any
    const fallbackImage = resolveAssetPath("assets/images/avatar-guest.svg");
    card.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('../../assets/')) {
            img.setAttribute('src', src.replace(/.*?assets\//, resolveAssetPath('assets/')));
        }
    });

    // Fill Basic Info
    const defaultTitle = window.i18nT ? window.i18nT('unspecified_shop', 'ชื่อร้าน') : 'ชื่อร้าน';
    const defaultSubtitle = window.i18nT ? window.i18nT('unspecified_product', 'สินค้า') : 'สินค้า';
    safeText(card.querySelector("[data-bind='sellerName']"), title || defaultTitle);
    safeText(card.querySelector("[data-bind='sellerSub']"), subtitle || defaultSubtitle);
    
    const img = card.querySelector("img[data-bind='avatar']");
    if (img) {
      safeAttr(img, "src", normalizeAvatarUrl(imageUrl) || fallbackImage);
      safeAttr(img, "onerror", `this.onerror=null;this.src='${fallbackImage}';`);
    }

    // Status Badge
    const statusBadge = card.querySelector("[data-bind='statusBadge']");
    if (statusBadge) {
        statusBadge.style.display = (isOwner || !isActive) ? "" : "none";
        statusBadge.textContent = isActive ? (window.i18nT ? window.i18nT('status_open', 'เปิดรับซื้อ') : 'เปิดรับซื้อ') : (window.i18nT ? window.i18nT('status_closed', 'ปิดรับซื้อ') : 'ปิดรับซื้อ');
        statusBadge.className = `status-badge ${isActive ? 'open' : 'closed'}`;
    }

    // Grades Row (Use ProductGrade if available)
    const gradesContainer = card.querySelector("[data-bind='gradesContainer']");
    if (gradesContainer && window.ProductGrade) {
        const gradesHtml = window.ProductGrade.render(data, window.i18nT ? window.i18nT('baht_per_kg', 'บาท/กก.') : 'บาท/กก.');
        safeHtml(gradesContainer, gradesHtml || '');
    } else {
        // Fallback to manual binding if ProductGrade not available
        safeText(card.querySelector("[data-bind='priceA']"), data.priceA || "-");
        safeText(card.querySelector("[data-bind='priceB']"), data.priceB || "-");
        safeText(card.querySelector("[data-bind='priceC']"), data.priceC || "-");
    }

    // Meta Info
    const distValEl = card.querySelector("[data-bind='distance']");
    if (distValEl) {
        const dist = String(data.distance || "").trim();
        const distWrap = distValEl.closest(".distance");
        if (distWrap) distWrap.style.display = ""; // Always visible
        
        const kmUnit = window.i18nT ? window.i18nT('km', 'กม.') : 'กม.';
        const distanceLabel = window.i18nT ? window.i18nT('distance', 'ระยะทาง') : 'ระยะทาง';

        if (!dist || dist === "-" || dist === "0" || dist.includes("-")) {
            safeText(distValEl, `${distanceLabel} - ${kmUnit}`);
        } else {
            const isFormatted = dist.startsWith(distanceLabel) || 
                                dist.includes(kmUnit) || 
                                dist.includes('ม.') || 
                                dist.includes('km') || 
                                dist.includes(' m') || 
                                dist.toLowerCase().includes('distance') || 
                                dist.includes('距离');
            safeText(distValEl, isFormatted ? dist : `${distanceLabel} ${dist} ${kmUnit}`);
        }
    }

    const updatedLabel = window.i18nT ? window.i18nT('updated', 'อัปเดต') : 'อัปเดต';
    safeText(card.querySelector("[data-bind='updateTime']"), updated.includes(updatedLabel) ? updated : `${updatedLabel} ${updated || (window.i18nT ? window.i18nT('just_now', 'เมื่อสักครู่') : 'เมื่อสักครู่')}`);

    // Owner Status Text Update
    const statusText = card.querySelector(".status-text");
    if (statusText) {
        statusText.textContent = isActive ? 
            (window.i18nT ? window.i18nT('close_buying', 'ปิด การรับซื้อ') : 'ปิด การรับซื้อ') : 
            (window.i18nT ? window.i18nT('open_buying', 'เปิด การรับซื้อ') : 'เปิด การรับซื้อ');
    }

    // IDs
    const offerId = data.offer_id ?? data.offerId ?? data.id ?? data.productId ?? data.product_id;
    const productId = data.product_id ?? data.productId ?? offerId;
    const sellerId = data.user_id ?? data.sellerId ?? data.seller_id ?? data.profile_id ?? data.profileId;
    if (offerId !== undefined && offerId !== null) card.dataset.offerId = offerId;
    if (productId !== undefined && productId !== null) card.dataset.productId = productId;
    if (sellerId !== undefined && sellerId !== null) card.dataset.sellerId = sellerId;

    // Stale Handling
    if (data.isStale) {
        const bookBtn = card.querySelector("[data-action='book']");
        if (bookBtn) {
            bookBtn.disabled = true;
            bookBtn.classList.add('btn-disabled');
            if (data.staleTooltip) bookBtn.title = data.staleTooltip;
            if (data.staleText) bookBtn.textContent = data.staleText;
        }
    }

    // Roles & Handlers
    applyRoleSettings(card, isOwner);
    bindActions(card, data, handlers);

    // Translation
    if (window.i18nT) {
      card.querySelectorAll('[data-i18n]:not([data-bind])').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = window.i18nT(key, el.textContent);
      });
    }

    return card;
  }

  async function mount(container, items = [], options = {}) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;

    const templatePath = options.templatePath || TEMPLATE_PATH;
    const cssPath = options.cssPath || "../../components/product-card/product-card.css";
    const handlers = options.handlers || {};

    ensureStylesheet(cssPath);
    const templateHtml = await loadTemplate(templatePath);

    el.innerHTML = "";
    items.forEach((it) => {
      const card = createCardEl(it, handlers, templateHtml);
      el.appendChild(card);
    });
  }

  window.ProductCard = { mount, createCardEl, loadTemplate };
})();
