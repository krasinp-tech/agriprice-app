(function initHeroSlider() {
  const carousel = document.getElementById("heroCarousel");
  const indicator = document.getElementById("heroIndicator");
  if (!carousel || !indicator) return;

  const slides = Array.from(carousel.querySelectorAll(".hero-slide"));
  if (!slides.length) return;

  // ---- dots ----
  indicator.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => goTo(i, true));
    indicator.appendChild(dot);
  });
  const dots = Array.from(indicator.querySelectorAll(".dot"));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function slideWidth() {
    return carousel.getBoundingClientRect().width || 1;
  }

  function getIndex() {
    return clamp(Math.round(carousel.scrollLeft / slideWidth()), 0, slides.length - 1);
  }

  function syncDots() {
    const idx = getIndex();
    dots.forEach((d, i) => d.classList.toggle("active", i === idx));
    return idx;
  }

  function goTo(index, smooth) {
    const idx = clamp(index, 0, slides.length - 1);
    carousel.scrollTo({
      left: idx * slideWidth(),
      behavior: smooth ? "smooth" : "auto"
    });
  }

  // ---- drag-to-scroll (เมาส์ + นิ้ว) ----
  let isDown = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  carousel.addEventListener("pointerdown", (e) => {
    carousel.setPointerCapture?.(e.pointerId);
    isDown = true;
    moved = false;
    startX = e.clientX;
    startLeft = carousel.scrollLeft;
    carousel.classList.add("dragging");
    stopAuto();
  });

  carousel.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    carousel.scrollLeft = startLeft - dx;
  });

  function endDrag() {
    if (!isDown) return;
    isDown = false;
    carousel.classList.remove("dragging");
    goTo(getIndex(), true);
    startAuto();
  }

  carousel.addEventListener("pointerup", endDrag);
  carousel.addEventListener("pointercancel", endDrag);
  carousel.addEventListener("pointerleave", endDrag);

  // กันคลิกพลาดตอนลาก
  carousel.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  // ---- sync dot ตอนผู้ใช้เลื่อนเอง ----
  let raf = null;
  carousel.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncDots);
  });
  window.addEventListener("resize", () => goTo(getIndex(), false));

  // ---- auto-slide (วนกลับ) ----
  const intervalMs = 3500;
  let timer = null;

  function startAuto() {
    stopAuto();
    timer = setInterval(() => {
      const idx = syncDots();
      const next = (idx + 1) % slides.length;
      goTo(next, true);
    }, intervalMs);
  }

  function stopAuto() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // init
  syncDots();
  startAuto();
})();



(async function initProductCards() {
  const mount = document.getElementById("productCardsMount");
  if (!mount) return;

  // ตรวจ role ที่ใช้งานอยู่ (เหมือนใน search/profile)
  let role = "farmer";
  try {
    const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.role) role = String(u.role).toLowerCase();
  } catch (_) {}
  const isBuyer = role === "buyer";
  const FAVORITES_KEY = "agri.favoriteProducts.v1";

  function loadFavoriteItems() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveFavoriteItems(items) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
  }

  function itemToFavoritePayload(item) {
    return {
      sellerId: String(item.sellerId || ""),
      sellerName: item.sellerName || "",
      sellerSub: item.sellerSub || "",
      avatar: item.avatar || "",
      priceA: item.priceA || "-",
      priceB: item.priceB || "-",
      priceC: item.priceC || "-",
      distance: item.distance || "",
      updateTime: item.updateTime || "",
      favoritedAt: Date.now(),
    };
  }

  function cardToFavoritePayload(card) {
    return {
      sellerId: String(card.dataset.sellerId || ""),
      sellerName: card.dataset.sellerName || card.querySelector('[data-bind="sellerName"]')?.textContent?.trim() || "",
      sellerSub: card.dataset.sellerSub || card.querySelector('[data-bind="sellerSub"]')?.textContent?.trim() || "",
      avatar: card.dataset.avatar || card.querySelector('[data-bind="avatar"]')?.getAttribute("src") || "",
      priceA: card.dataset.priceA || card.querySelector('[data-bind="priceA"]')?.textContent?.trim() || "-",
      priceB: card.dataset.priceB || card.querySelector('[data-bind="priceB"]')?.textContent?.trim() || "-",
      priceC: card.dataset.priceC || card.querySelector('[data-bind="priceC"]')?.textContent?.trim() || "-",
      distance: card.dataset.distance || card.querySelector('[data-bind="distance"]')?.textContent?.trim() || "",
      updateTime: card.dataset.updateTime || card.querySelector('[data-bind="updateTime"]')?.textContent?.trim() || "",
      cardId: card.id || card.dataset.cardId || "",
      favoritedAt: Date.now(),
    };
  }

  function upsertFavorite(payload) {
    const sellerId = String(payload?.sellerId || "");
    if (!sellerId) return;
    const items = loadFavoriteItems();
    const withoutCurrent = items.filter((it) => String(it.sellerId || "") !== sellerId);
    saveFavoriteItems([{ ...payload }, ...withoutCurrent]);
    window.dispatchEvent(new CustomEvent("favoritesChanged", { detail: { action: "add", sellerId } }));
  }

  function removeFavorite(sellerId) {
    const key = String(sellerId || "");
    if (!key) return;
    const items = loadFavoriteItems().filter((it) => String(it.sellerId || "") !== key);
    saveFavoriteItems(items);
    window.dispatchEvent(new CustomEvent("favoritesChanged", { detail: { action: "remove", sellerId: key } }));
  }


  try {
    // 1) โหลด template
    const res = await fetch("components/product-card/product-card.html");
    if (!res.ok) {
      console.error("Load product-card.html failed:", res.status);
      return;
    }

    const holder = document.createElement("div");
    holder.style.display = "none";
    holder.innerHTML = await res.text();
    document.body.appendChild(holder);

    // Use holder.querySelector to ensure template is found immediately after append
    const tpl = holder.querySelector("#productCardTpl");
    if (!tpl) {
      console.error("productCardTpl not found");
      return;
    }

    // 2) ดึงข้อมูลจาก mockup API (dynamic)
    let products = [];
    try {
      // ลอง fetch แบบ module (ถ้าไม่สำเร็จ fallback เป็น script)
      if (window.getMockupProducts) {
        products = window.getMockupProducts();
      } else {
        // fallback: dynamic import (ถ้า browser รองรับ)
        const mod = await import("js/mockup/mockup.js");
        products = mod.getMockupProducts();
      }
    } catch (e) {
      // fallback: fetch script แล้ว eval
      try {
        const resp = await fetch("js/mockup/mockup.js");
        if (resp.ok) {
          const code = await resp.text();
          eval(code); // จะได้ window.getMockupProducts
          if (window.getMockupProducts) {
            products = window.getMockupProducts();
          }
        }
      } catch (e2) {
        console.error("Cannot load mockup products", e2);
      }
    }

    // 3) sync favorite state
    const savedFavorites = loadFavoriteItems();
    const savedMap = new Map(savedFavorites.map((it) => [String(it.sellerId || ""), it]));
    products.forEach((item) => {
      const sellerId = String(item.sellerId || "");
      const saved = savedMap.get(sellerId);
      if (saved) {
        item.favorite = true;
      } else if (item.favorite) {
        savedMap.set(sellerId, itemToFavoritePayload(item));
      }
    });
    saveFavoriteItems(Array.from(savedMap.values()));

    // เรียง product_slots ตามระยะทาง (ใกล้ -> ไกล)
    function getSortedProducts(limit) {
      // แปลง distance เป็นตัวเลข (km) ถ้าไม่มีให้เป็น Infinity (ไปท้าย)
      const sorted = products.slice().sort((a, b) => {
        const da = parseFloat((a.distance||'').replace(' km',''));
        const db = parseFloat((b.distance||'').replace(' km',''));
        return (isNaN(da) ? Infinity : da) - (isNaN(db) ? Infinity : db);
      });
      return sorted.slice(0, limit);
    }

    // ฟังก์ชันแปลง updateTime
    function formatUpdateTime(updateTime) {
      if (!updateTime) return "";
      let dt = updateTime;
      if (typeof dt !== "string") return "";
      // ถ้าเป็นช่วงวันที่ (start ~ end) ให้ใช้ start
      if (dt.includes("~")) dt = dt.split("~")[0].trim();
      // ถ้าเป็นวันที่อย่างเดียว
      if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) dt += "T00:00:00";
      // dt: 2026-03-18T08:00:00
      const updated = new Date(dt);
      if (isNaN(updated)) return dt;
      const now = new Date();
      const diffMs = now - updated;
      const diffH = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffH < 24 && diffH >= 0) {
        return `อัพเดทเมื่อ ${diffH === 0 ? "ไม่กี่นาที" : diffH + " ชั่วโมง"}ที่แล้ว`;
      } else {
        // แสดงวันที่แบบ 18 มี.ค. 2026
        const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        const d = updated.getDate();
        const m = thMonths[updated.getMonth()];
        const y = updated.getFullYear() + 543 - 543; // ค.ศ.
        return `อัพเดทล่าสุด ${d} ${m} ${y}`;
      }
    }

    let shownCount = 5;
    function renderProducts(initial = false) {
      if (initial) {
        mount.innerHTML = "";
      }
      // เรียงตามระยะทางใกล้สุด
      const showList = getSortedProducts(shownCount);
      for (let i = 0; i < showList.length; i++) {
        const item = showList[i];
        const node = tpl.content.firstElementChild.cloneNode(true);
        node.dataset.sellerId = item.sellerId;
        node.dataset.sellerName = item.sellerName;
        node.dataset.sellerSub = item.sellerSub || "";
        node.dataset.avatar = item.avatar || "";
        node.dataset.priceA = item.priceA || "-";
        node.dataset.priceB = item.priceB || "-";
        node.dataset.priceC = item.priceC || "-";
        node.dataset.distance = item.distance || "";
        node.dataset.updateTime = item.updateTime || "";
        const img = node.querySelector('[data-bind="avatar"]');
        img.src = item.avatar || "";
        img.alt = item.sellerName || "";
        node.querySelector('[data-bind="sellerName"]').textContent = item.sellerName || "";
        node.querySelector('[data-bind="sellerSub"]').textContent = item.sellerSub || "";
        node.querySelector('[data-bind="priceA"]').textContent = item.priceA || "-";
        node.querySelector('[data-bind="priceB"]').textContent = item.priceB || "-";
        node.querySelector('[data-bind="priceC"]').textContent = item.priceC || "-";
        node.querySelector('[data-bind="distance"]').textContent = item.distance || "";
        node.querySelector('[data-bind="updateTime"]').textContent = formatUpdateTime(item.updateTime || "");
        const fav = node.querySelector('[data-action="toggle-favorite"]');
        if (item.favorite) fav.classList.add("active");
        if (isBuyer) {
          node.querySelectorAll('[data-action="toggle-favorite"]').forEach(el => el.remove());
          node.querySelectorAll('[data-action="book"]').forEach(el => el.remove());
          node.querySelectorAll('[data-action="contact"]').forEach(el => el.remove());
          node.querySelector(".action-row")?.remove();
          node.querySelector(".card-actions")?.remove();
          node.querySelector("[data-actions]")?.remove();
        }
        mount.appendChild(node);
      }
      // toggle btn-load-more visibility (force always visible for debug)
      const btn = document.querySelector('.btn-load-more');
      if (btn) btn.style.display = '';
    }
    renderProducts(true);
    // btn-load-more click handler
    const btn = document.querySelector('.btn-load-more');
    if (btn) {
      btn.onclick = function() {
        shownCount += 5;
        renderProducts(false);
      };
    }

    // 4) event delegation (ให้ทำงานทุกใบ)
    function goProfile(card) {
      const name =
        card.dataset.sellerName ||
        card.querySelector(".seller-name")?.textContent?.trim() ||
        "";
      // ✅ profile อยู่ที่ pages/shared/profile.html (จากไฟล์ที่คุณส่ง)
      window.location.href = `pages/shared/profile.html?name=${encodeURIComponent(name)}`;
    }

    mount.addEventListener("click", (e) => {
      const card = e.target.closest(".product-card");
      if (!card) return;

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      if (action === "toggle-favorite") {
        if (isBuyer) return; // buyer can't favorite
        e.stopPropagation();

        const isActive = actionEl.classList.toggle("active");
        const sellerId = card.dataset.sellerId || "";

        if (isActive) {
          upsertFavorite(cardToFavoritePayload(card));
        } else {
          removeFavorite(sellerId);
        }
        return;
      }

      // ✅ buyer สามารถดูโปรไฟล์ได้
      if (action === "open-profile") {
        goProfile(card);
        return;
      }

      if (action === "book") {
        if (isBuyer) return; // buyer shouldn't see / click
        e.preventDefault();
        e.stopPropagation();
        
        // บันทึกหน้าปัจจุบันก่อนไป booking
        localStorage.setItem("bookingReferrer", window.location.href);
        
        // ไปหน้าจองตาม role
        let role = "farmer";
        try {
          const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
          const u = raw ? JSON.parse(raw) : null;
          if (u && u.role) role = String(u.role);
        } catch (_) {}

        window.location.href =
          role === "buyer"
            ? "pages/buyer/setbooking/booking.html"
            : "pages/farmer/booking/booking-step1.html";
        return;
      }


      if (action === "contact") {
        if (isBuyer) return;
        e.stopPropagation();
        console.log("contact sellerId:", card.dataset.sellerId);
        return;
      }
    });

    // รองรับกด Enter บน seller-info และ favorite (เพราะเป็น div)
    mount.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;

      const card = e.target.closest(".product-card");
      if (!card) return;

      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.dataset.action;

      if (action === "open-profile") {
        goProfile(card);
      }

      if (action === "toggle-favorite") {
        const isBuyer = (localStorage.getItem("role") || "").toLowerCase() === "buyer";
        if (!isBuyer) {
          const isActive = actionEl.classList.toggle("active");
          const sellerId = card.dataset.sellerId || "";

          if (isActive) {
            upsertFavorite(cardToFavoritePayload(card));
          } else {
            removeFavorite(sellerId);
          }
        }
      }
    });
  } catch (err) {
    console.error("Product cards init error:", err);
  }
})();



// Banner (dot + drag + snap


(function bannerInit() {
  const track = document.getElementById("bannerCarousel");
  const dotsWrap = document.getElementById("bannerDots");
  if (!track || !dotsWrap) return;

  const items = Array.from(track.querySelectorAll(".banner-item"));
  if (!items.length) return;

  const perPage = 2; // ✅ 2 ใบต่อหน้า

  function pagesCount() {
    return Math.max(1, Math.ceil(items.length / perPage));
  }

  function buildDots() {
    dotsWrap.innerHTML = "";
    const pages = pagesCount();

    for (let i = 0; i < pages; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => scrollToPage(i, true));
      dotsWrap.appendChild(dot);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getGapPx() {
    const style = getComputedStyle(track);
    return parseFloat(style.gap || 12);
  }

  function getPageWidth() {
    const itemW = items[0].getBoundingClientRect().width;
    return (itemW + getGapPx()) * perPage;
  }

  function scrollToPage(pageIndex, smooth) {
    const pages = pagesCount();
    const idx = clamp(pageIndex, 0, pages - 1);

    const targetItem = items[idx * perPage];
    if (!targetItem) return;

    targetItem.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      inline: "start",
      block: "nearest"
    });
  }

  function setActiveDot() {
    const dots = Array.from(dotsWrap.querySelectorAll(".dot"));
    if (!dots.length) return;

    const pageWidth = getPageWidth();
    const pageIndex = clamp(
      Math.round(track.scrollLeft / pageWidth),
      0,
      pagesCount() - 1
    );

    dots.forEach((d, i) => d.classList.toggle("active", i === pageIndex));
  }

  /* Drag */
  let isDown = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;

  track.addEventListener("pointerdown", (e) => {
    track.setPointerCapture?.(e.pointerId);
    isDown = true;
    moved = false;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    track.classList.add("dragging");
  });

  track.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    track.scrollLeft = startLeft - dx;
  });

  function endDrag() {
    if (!isDown) return;
    isDown = false;
    track.classList.remove("dragging");

    const pageWidth = getPageWidth();
    const targetPage = Math.round(track.scrollLeft / pageWidth);
    scrollToPage(targetPage, true);
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  track.addEventListener("pointerleave", endDrag);

  track.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );

  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(setActiveDot);
  });

  window.addEventListener("resize", () => {
    buildDots();
    setActiveDot();
  });

  buildDots();
  setActiveDot();
})();

/**
 * AGRIPRICE - Home Page JS
 */
document.addEventListener('DOMContentLoaded', function () {

  // ── Search ─────────────────────────
  var searchBtn = document.getElementById('searchBtn');
  var searchInput = document.getElementById('searchInput');

  function getRelativePrefixToPages() {
    // root -> "pages/"
    // pages/* -> ""
    // pages/<sub>/* -> "../"
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);

    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "pages/";

    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;

    return "../".repeat(depth);
  }

  const prefixPages = getRelativePrefixToPages();

  function goSearch() {
    var q = (searchInput && searchInput.value ? searchInput.value : '').trim();
    // Smooth scroll up before redirect
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () {
      window.location.href = q
        ? prefixPages + 'shared/search-results.html?q=' + encodeURIComponent(q)
        : prefixPages + 'shared/search-results.html';
    }, 350); // รอ scroll ประมาณ 0.35s
  }

  if (searchBtn) searchBtn.addEventListener('click', goSearch);
  if (searchInput) {
    searchInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') goSearch();
    });
  }

  // ── Sliders ─────────────────────────
  if (typeof initHomeSliders === 'function') {
    initHomeSliders();
  }
});
