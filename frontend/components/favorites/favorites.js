(function favoritesInit() {
  const helpers = window.FavoritesHelpers;
  const section = document.querySelector(".favorites-section");
  const favoritesTrack = document.getElementById("favoritesTrack");
  const favoritesDots = document.getElementById("favoritesDots");
  const viewAllBtn = document.getElementById("favoritesViewAll");
  if (!helpers || !section || !favoritesTrack || !favoritesDots) return;

  const role = helpers.getRole();
  if (role !== "farmer") {
    section.remove();
    return;
  }
  section.hidden = false;

  function getPerView() {
    return (window.innerWidth || document.documentElement.clientWidth || 375) >= 768 ? 4 : 3;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadFavoriteItems() {
    const fromApi = await helpers.fetchFavoritesFromApi();
    const fromStore = helpers.loadFavoritesFromStore();
    const merged = [
      ...(Array.isArray(fromApi) ? fromApi : []),
      ...(Array.isArray(fromStore) ? fromStore : []),
    ];
    return dedupeFavoriteItems(merged).slice(0, 6);
  }

  function dedupeFavoriteItems(list) {
    const seen = new Set();
    return (Array.isArray(list) ? list : [])
      .filter((item) => {
        const key = `${String(item?.kind || "seller")}:${String(item?.id || "")}`;
        if (!String(item?.id || "") || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  let items = [];
  let cards = [];
  let perView = getPerView();
  const pagesPrefix = helpers.getRelativePrefixToPages();

  function renderFavoriteCards() {
    favoritesTrack.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.className = "fav-card";
      button.type = "button";
      button.setAttribute("role", "listitem");
      button.dataset.sellerId = item.id;
      button.dataset.profileId = item.profileId || item.id;
      button.innerHTML = `
        <span class="fav-title">${escapeHtml(item.title)}</span>
        <span class="fav-subtitle">${escapeHtml(item.subtitle)}</span>
      `;
      favoritesTrack.appendChild(button);
    });
    cards = Array.from(favoritesTrack.querySelectorAll(".fav-card"));
  }

  function pagesCount() {
    perView = getPerView();
    return Math.max(1, Math.ceil(cards.length / perView));
  }

  function getPageWidth() {
    if (!cards.length) return favoritesTrack.clientWidth || 1;
    const gap = parseFloat(getComputedStyle(favoritesTrack).gap || "12") || 12;
    const cardWidth = cards[0].getBoundingClientRect().width || 1;
    return (cardWidth + gap) * perView;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function scrollToPage(pageIndex, smooth) {
    const pages = pagesCount();
    const idx = clamp(pageIndex, 0, pages - 1);
    const target = cards[idx * perView];
    if (!target) return;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "start", block: "nearest" });
  }

  function renderDots() {
    const pages = pagesCount();
    favoritesDots.innerHTML = "";
    if (pages <= 1) return;
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => scrollToPage(i, true));
      favoritesDots.appendChild(dot);
    }
  }

  function syncActiveDot() {
    const dots = Array.from(favoritesDots.querySelectorAll(".dot"));
    if (!dots.length) return;
    const pageWidth = getPageWidth();
    const pageIndex = clamp(Math.round(favoritesTrack.scrollLeft / pageWidth), 0, pagesCount() - 1);
    dots.forEach((dot, index) => dot.classList.toggle("active", index === pageIndex));
  }

  favoritesTrack.addEventListener("click", (event) => {
    const card = event.target.closest(".fav-card");
    if (!card) return;
    const sellerId = card.dataset.profileId || card.dataset.sellerId || "";
    const q = new URLSearchParams();
    if (sellerId) q.set("uid", sellerId);
    window.location.href = pagesPrefix + "shared/profile.html" + (q.toString() ? `?${q.toString()}` : "");
  });

  let raf = null;
  favoritesTrack.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(syncActiveDot);
  });

  window.addEventListener("resize", () => {
    renderDots();
    syncActiveDot();
  });

  viewAllBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = pagesPrefix + "../components/favorites/allfavorites.html";
  });

  async function refreshFavorites() {
    items = await loadFavoriteItems();
    renderFavoriteCards();
    renderDots();
    syncActiveDot();
  }

  function refreshFromStoreNow() {
    const fromStore = helpers.loadFavoritesFromStore();
    items = dedupeFavoriteItems(fromStore).slice(0, 6);
    renderFavoriteCards();
    renderDots();
    syncActiveDot();
  }

  window.addEventListener("favorites:changed", () => {
    // Local-first update so user sees the change instantly.
    refreshFromStoreNow();
    refreshFavorites().catch(() => {});
  });

  window.addEventListener("storage", (e) => {
    if (e.key === (window.FavoritesStore?.KEY || "agriprice_favorites_v1")) {
      refreshFromStoreNow();
    }
  });

  window.addEventListener("focus", () => {
    refreshFromStoreNow();
    refreshFavorites().catch(() => {});
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshFromStoreNow();
      refreshFavorites().catch(() => {});
    }
  });

  refreshFavorites().catch((err) => {
    console.error("Favorites init error:", err);
  });
})();