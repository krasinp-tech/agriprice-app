// AGRIPRICE - Search Page (ใหม่)
document.addEventListener("DOMContentLoaded", () => {
    // --- Radius filter ---
    let radiusKm = 100; // Default radius
    const radiusInput = document.getElementById("radiusInput");
    if (radiusInput) {
      radiusInput.value = radiusKm;
      radiusInput.addEventListener("input", () => {
        radiusKm = parseInt(radiusInput.value) || 50;
        refresh();
      });
    }
  // --- Elements ---
  const input = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const backBtn = document.getElementById("backBtn");
  const countEl = document.getElementById("resultCount");
  const mount = document.getElementById("searchResultsMount");
  if (!mount) {
    console.error("[search.js] #searchResultsMount not found");
    return;
  }

  // --- Path helpers ---
  function getPrefixRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../" + "../".repeat(depth);
  }
  function getPrefixPages() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "pages/";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../".repeat(depth);
  }
  const prefixRoot = getPrefixRoot();
  const prefixPages = getPrefixPages();
  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    const normalized = String(p).replace(/^\.?\/?/, "").replace(/^\.?\/?/, "");
    return prefixRoot + normalized;
  }

  // --- Data: ดึง product_slots ---
  function getAllProducts() {
    if (window.getMockupProducts) return window.getMockupProducts();
    console.error("[search.js] window.getMockupProducts not found");
    return [];
  }

  // ดึง variety map (id => {product_name, variety})
  function getVarietyMap() {
    if (!window.mockVarieties) return {};
    const map = {};
    window.mockVarieties.forEach(v => { map[v.variety_id] = v; });
    return map;
  }

  // --- Autocomplete ---
  let autocompleteBox = null;
  function showAutocomplete(suggestions) {
    if (!input) return;
    if (!autocompleteBox) {
      autocompleteBox = document.createElement("div");
      autocompleteBox.className = "autocomplete-box";
      input.parentNode.appendChild(autocompleteBox);
    }
    autocompleteBox.innerHTML = "";
    suggestions.forEach(s => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.textContent = s;
      item.addEventListener("mousedown", () => {
        input.value = s;
        refresh();
        hideAutocomplete();
      });
      autocompleteBox.appendChild(item);
    });
    autocompleteBox.style.display = suggestions.length ? "block" : "none";
  }
  function hideAutocomplete() {
    if (autocompleteBox) autocompleteBox.style.display = "none";
  }

  // --- Template loader ---
  let tpl = null;
  async function loadTemplateOnce() {
    if (tpl) return tpl;
    const templateUrl = resolveToRootUrl("components/product-card/product-card.html");
    let res;
    try {
      res = await fetch(templateUrl);
    } catch (e) {
      console.error("[search.js] fetch error", e);
      throw new Error("fetch error: " + e);
    }
    if (!res.ok) {
      console.error("[search.js] Load product-card.html failed", {url: templateUrl, status: res.status});
      throw new Error("Load product-card.html failed: " + res.status + " (" + templateUrl + ")");
    }
    const holder = document.createElement("div");
    holder.style.display = "none";
    holder.innerHTML = await res.text();
    document.body.appendChild(holder);
    tpl = holder.querySelector("template#productCardTpl");
    if (!tpl) {
      console.error("[search.js] productCardTpl not found in loaded HTML", {url: templateUrl, html: holder.innerHTML.slice(0, 200)});
      throw new Error("productCardTpl not found");
    }
    return tpl;
  }

  // --- Utils ---
  function getRole() {
    return (localStorage.getItem("role") || "").toLowerCase() || "guest";
  }
  function getUserLocation() {
    const lat = parseFloat(localStorage.getItem("userLat"));
    const lng = parseFloat(localStorage.getItem("userLng"));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    return null;
  }
  function calcDistanceKm(a, b) {
    if (!a || !b) return null;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = dLat / 2;
    const y = dLng / 2;
    const aVal = Math.sin(x) * Math.sin(x) + Math.sin(y) * Math.sin(y) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return Math.round(R * c);
  }
  function parseUpdateTime(val) {
    if (!val) return 0;
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const updated = new Date(val);
      if (!isNaN(updated)) {
        const now = new Date();
        return Math.floor((now - updated) / (1000 * 60));
      }
    }
    return 0;
  }
  function formatUpdate(minAgo) {
    if (typeof minAgo !== "number") return "-";
    if (minAgo < 60) return `อัปเดท ${minAgo} นาที`;
    const h = Math.floor(minAgo / 60);
    return `อัปเดท ${h} ชั่วโมง`;
  }
  function formatDistance(km) {
    if (typeof km !== "number" || isNaN(km)) return "○ ระยะทาง - กม.";
    return `○ ระยะทาง ${km} กม.`;
  }
  function formatPrice(n) {
    if (typeof n !== "number") return "-";
    return `${n} บ.กก.`;
  }

  // --- Render ---
  // ฟังก์ชัน formatUpdateTime (เหมือนหน้า index)
  function formatUpdateTime(updateTime) {
    if (!updateTime) return "";
    let dt = updateTime;
    if (typeof dt !== "string") return "";
    if (dt.includes("~")) dt = dt.split("~")[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) dt += "T00:00:00";
    const updated = new Date(dt);
    if (isNaN(updated)) return dt;
    const now = new Date();
    const diffMs = now - updated;
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 24 && diffH >= 0) {
      return `อัพเดทเมื่อ ${diffH === 0 ? "ไม่กี่นาที" : diffH + " ชั่วโมง"}ที่แล้ว`;
    } else {
      const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
      const d = updated.getDate();
      const m = thMonths[updated.getMonth()];
      const y = updated.getFullYear();
      return `อัพเดทล่าสุด ${d} ${m} ${y}`;
    }
  }

  // ฟังก์ชันสุ่มรายการแนะนำ seller ไม่ซ้ำ (เหมือนหน้า index)
  function getShuffledProducts(items, limit) {
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    const bySeller = {};
    items.forEach(p => {
      if (!bySeller[p.sellerId]) bySeller[p.sellerId] = [];
      bySeller[p.sellerId].push(p);
    });
    let result = [];
    let round = 0;
    while (result.length < limit) {
      let added = false;
      for (const sellerId of shuffle(Object.keys(bySeller))) {
        const arr = bySeller[sellerId];
        if (arr[round]) {
          result.push(arr[round]);
          if (result.length >= limit) break;
          added = true;
        }
      }
      if (!added) break;
      round++;
    }
    return shuffle(result).slice(0, limit);
  }

  function render(list) {
    mount.innerHTML = "";
    if (!tpl) {
      mount.innerHTML = '<div style="padding:16px;color:#c00;background:#fff3f3;border-radius:8px;">[search.js] ไม่พบ template product card</div>';
      console.error("[search.js] tpl is null");
      return;
    }
    if (!list || !list.length) {
      mount.innerHTML = '<div style="padding:16px;color:#888;background:#fff;border-radius:8px;">ไม่พบข้อมูล</div>';
      return;
    }
    const role = getRole();
    const isBuyer = role === "buyer";
    list.forEach(item => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.sellerId = item.sellerId || "";
      node.dataset.sellerName = item.sellerName || "";
      const img = node.querySelector('[data-bind="avatar"]');
      if (img) {
        img.src = resolveToRootUrl(item.avatar || "");
        img.alt = item.sellerName || "";
      }
      const setText = (key, val) => {
        const el = node.querySelector(`[data-bind="${key}"]`);
        if (el) el.textContent = val;
      };
      setText("sellerName", item.sellerName || "");
      setText("sellerSub", item.sellerSub || "");
      setText("priceA", formatPrice(item.priceA));
      setText("priceB", formatPrice(item.priceB));
      setText("priceC", formatPrice(item.priceC));
      setText("distance", formatDistance(item.distanceKm));
      setText("updateTime", formatUpdateTime(item.updateTime));
      const fav = node.querySelector('[data-action="toggle-favorite"]');
      if (fav && item.favorite) fav.classList.add("active");
      if (isBuyer) {
        node.querySelectorAll('[data-action="toggle-favorite"]').forEach(el => el.remove());
        node.querySelectorAll('[data-action="book"]').forEach(el => el.remove());
        node.querySelectorAll('[data-action="contact"]').forEach(el => el.remove());
        const actionRow = node.querySelector(".action-row");
        if (actionRow) {
          const keepProfile = actionRow.querySelector('[data-action="open-profile"]');
          actionRow.innerHTML = "";
          if (keepProfile) actionRow.appendChild(keepProfile);
          const keepMsg = node.querySelector('[data-action="message"]');
          if (keepMsg && actionRow) actionRow.appendChild(keepMsg.cloneNode(true));
        }
      }
      mount.appendChild(node);
    });
    if (countEl) countEl.textContent = String(list.length);
  }

  // --- Search/filter logic ---
  let allItems = [];
  function buildAllItems() {
    const products = getAllProducts();
    let userLoc = null;
    try {
      userLoc = getUserLocation();
    } catch (e) { userLoc = null; }
    return products.map(item => {
      let distanceKm = null;
      if (userLoc && item.sellerId) {
        const seller = (window.mockProfiles || []).find(u => u.uuid === item.sellerId);
        if (seller && seller.deviceAddress) {
          distanceKm = calcDistanceKm(userLoc, seller.deviceAddress);
        }
      }
      return {
        ...item,
        priceA: typeof item.priceA === "number" ? item.priceA : (item.grades?.find(g => g.grade === "A")?.price ?? null),
        priceB: typeof item.priceB === "number" ? item.priceB : (item.grades?.find(g => g.grade === "B")?.price ?? null),
        priceC: typeof item.priceC === "number" ? item.priceC : (item.grades?.find(g => g.grade === "C")?.price ?? null),
        updatedMinutesAgo: parseUpdateTime(item.updateTime),
        distanceKm,
      };
    }).filter(item => {
      // Filter by radius
      if (typeof item.distanceKm === "number" && !isNaN(item.distanceKm)) {
        return item.distanceKm <= radiusKm;
      }
      return true; // If no user location, show all
    });
  }

  function getAutocompleteList(items, q) {
    const ql = (q || "").toLowerCase();
    const varietyMap = getVarietyMap();
    const names = items.map(x => x.sellerName).filter(Boolean);
    const types = items.map(x => x.sellerSub).filter(Boolean);
    const varieties = items.map(x => {
      const v = varietyMap[x.slotId ? (window.mockProductSlots?.find(s => s.id === x.slotId)?.variety_id) : null];
      return v ? v.variety : null;
    }).filter(Boolean);
    const all = [...names, ...types, ...varieties];
    return all.filter((v, i, arr) => v && v.toLowerCase().includes(ql) && arr.indexOf(v) === i).slice(0, 8);
  }

  function filterItems(items, q, filter) {
    let list = items;
    const ql = (q || "").trim().toLowerCase();
    const varietyMap = getVarietyMap();
    if (ql) {
      list = list.filter(x => {
        const variety = varietyMap[x.slotId ? (window.mockProductSlots?.find(s => s.id === x.slotId)?.variety_id) : null];
        return (
          (x.sellerName || "").toLowerCase().includes(ql) ||
          (x.sellerSub || "").toLowerCase().includes(ql) ||
          (variety?.variety || "").toLowerCase().includes(ql)
        );
      });
    }
    if (filter === "recent") {
      list = list.slice().sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    } else if (filter === "price-high") {
      list = list.slice().sort((a, b) => (b.priceA ?? 0) - (a.priceA ?? 0));
    } else if (filter === "price-low") {
      list = list.slice().sort((a, b) => (a.priceA ?? 0) - (b.priceA ?? 0));
    }
    return list;
  }

  // --- Main refresh ---
  let activeFilter = "all";
  function refresh() {
    const q = input?.value || "";
    allItems = buildAllItems();
    let showList;
    if (!q) {
      showList = getShuffledProducts(allItems, 10);
    } else {
      showList = filterItems(allItems, q, activeFilter);
    }
    // --- Price summary ---
    const priceArr = [];
    showList.forEach(item => {
      [item.priceA, item.priceB, item.priceC].forEach(p => {
        if (typeof p === "number" && !isNaN(p)) priceArr.push(p);
      });
    });
    let min = priceArr.length ? Math.min(...priceArr) : null;
    let max = priceArr.length ? Math.max(...priceArr) : null;
    let avg = priceArr.length ? Math.round(priceArr.reduce((a,b) => a+b,0)/priceArr.length) : null;
    const summaryEl = document.getElementById("priceSummary");
    if (summaryEl) {
      summaryEl.innerHTML = priceArr.length
        ? `<b>ราคาต่ำสุด:</b> ${min} บ.กก. <b>สูงสุด:</b> ${max} บ.กก. <b>เฉลี่ย:</b> ${avg} บ.กก.`
        : "<b>ไม่พบข้อมูลราคา</b>";
    }
    render(showList);
    if (q.length > 0) {
      showAutocomplete(getAutocompleteList(allItems, q));
    } else {
      hideAutocomplete();
    }
  }

  // --- Events ---
  backBtn?.addEventListener("click", () => {
    window.location.href = prefixRoot ? prefixRoot + "index.html" : "/index.html";
  });
  backBtn?.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") backBtn.click(); });
  searchBtn?.addEventListener("click", refresh);
  input?.addEventListener("input", refresh);
  input?.addEventListener("keydown", (e) => { if (e.key === "Escape") hideAutocomplete(); if (e.key === "Enter") { refresh(); hideAutocomplete(); } });
  document.addEventListener("click", (e) => { if (autocompleteBox && !autocompleteBox.contains(e.target) && e.target !== input) hideAutocomplete(); });
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter || "all";
      refresh();
    });
  });
  mount.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const role = getRole();
    const isBuyer = role === "buyer";
    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (isBuyer && (action === "toggle-favorite" || action === "book" || action === "contact")) { e.preventDefault(); e.stopPropagation(); return; }
    if (action === "open-profile") {
      const name = card.dataset.sellerName || "";
      window.location.href = prefixPages + `shared/profile.html?name=${encodeURIComponent(name)}`;
      return;
    }
    if (action === "toggle-favorite") {
      e.preventDefault(); e.stopPropagation();
      actionEl.classList.toggle("active");
      const sellerId = card.dataset.sellerId;
      const item = allItems.find((x) => x.sellerId === sellerId);
      if (item) item.favorite = actionEl.classList.contains("active");
      return;
    }
    if (action === "book") {
      e.preventDefault(); e.stopPropagation();
      localStorage.setItem("bookingReferrer", window.location.href);
      window.location.href = role === "buyer" ? prefixPages + "buyer/setbooking/booking.html" : prefixPages + "farmer/booking/booking-step1.html";
      return;
    }
    if (action === "contact") {
      e.preventDefault(); e.stopPropagation();
      console.log("contact sellerId:", card.dataset.sellerId);
      return;
    }
  });

  // --- Init ---
  (async () => {
    try {
      await loadTemplateOnce();
      refresh();
    } catch (err) {
      console.error("[search.js] init error", err);
      mount.innerHTML = `<div style="padding:12px;border-radius:12px;background:#fff;"><b>เกิดข้อผิดพลาดในการโหลดการค้นหา</b><div style="margin-top:6px;">${String(err?.message || err)}</div></div>`;
    }
  })();
});