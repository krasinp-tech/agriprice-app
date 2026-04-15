(function initFavoritesHelpers() {
  function getCurrentUserId() {
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
      const user = raw ? JSON.parse(raw) : null;
      return String(user?.id || user?.profile_id || "");
    } catch (_) {
      return "";
    }
  }

  function getRole() {
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user");
      const user = raw ? JSON.parse(raw) : null;
      if (user?.role) return String(user.role).toLowerCase();
    } catch (_) {}
    return (localStorage.getItem("role") || "guest").toLowerCase();
  }

  function getRelativePrefixToPages() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "pages/";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../".repeat(depth);
  }

  async function fetchFavoritesFromApi() {
    const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    if (!API_BASE || !token) return null;

    try {
      const res = await fetch(API_BASE + "/api/favorites", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.data || [];
      return arr
        .map((item) => ({
          id: String(item?.user_id || item?.id || ""),
          kind: "seller",
          title: `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "ไม่ทราบชื่อ",
          subtitle: item?.tagline || "",
          avatar: item?.avatar || "",
          source: "favorite",
          profileId: String(item?.user_id || item?.id || ""),
        }))
        .filter((x) => x.id);
    } catch (_) {
      return null;
    }
  }

  async function fetchFollowingFromApi() {
    const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    const userId = getCurrentUserId();
    if (!API_BASE || !token || !userId) return null;

    try {
      const res = await fetch(API_BASE + "/api/follow/" + encodeURIComponent(userId) + "/following", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.data || [];
      return arr
        .map((item) => ({
          id: String(item?.profile_id || item?.id || ""),
          kind: "seller",
          title: `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "ไม่ทราบชื่อ",
          subtitle: item?.tagline || "",
          avatar: item?.avatar || "",
          source: "follow",
          profileId: String(item?.profile_id || item?.id || ""),
        }))
        .filter((x) => x.id);
    } catch (_) {
      return null;
    }
  }

  function loadFavoritesFromStore() {
    const store = window.FavoritesStore;
    const arr = store?.read?.() || [];
    return Array.isArray(arr)
      ? arr
          .map((item) => ({
            id: String(item?.id || ""),
            kind: String(item?.kind || "seller"),
            title: item?.name || item?.sellerName || item?.title || "ไม่ทราบชื่อ",
            subtitle: item?.sub || item?.sellerSub || item?.subtitle || "",
            sellerName: item?.name || item?.sellerName || item?.title || "",
            productName: item?.productName || item?.sub || item?.sellerSub || item?.subtitle || "",
            avatar: item?.avatar || "",
            source: item?.source || (String(item?.kind || "seller") === "product" ? "product-favorite" : "favorite"),
            profileId: String(item?.sellerId || item?.profileId || ""),
            productId: String(item?.productId || ""),
            priceA: item?.priceA || "",
            priceB: item?.priceB || "",
            priceC: item?.priceC || "",
            distance: item?.distance || "",
            updateTime: item?.updateTime || "",
            updatedAt: Number(item?.updatedAt || 0),
          }))
          .filter((x) => x.id)
          .sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  }

  window.FavoritesHelpers = {
    getCurrentUserId,
    getRole,
    getRelativePrefixToPages,
    fetchFavoritesFromApi,
    fetchFollowingFromApi,
    loadFavoritesFromStore,
  };
})();
