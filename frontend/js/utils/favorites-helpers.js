(function initFavoritesHelpers() {
  // uses global resolveUserId / resolveProfileId from utils/id-resolver.js
  function resolveId(...ids) {
    if (typeof window.resolveUserId === "function") return window.resolveUserId(...ids);
    for (const id of ids) {
      if (id !== undefined && id !== null && String(id).trim() !== "") return String(id);
    }
    return "";
  }

  function getCurrentUserId() {
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
      const user = raw ? JSON.parse(raw) : null;
      return resolveId(user?.profile_id, user?.id);
    } catch (_) {
      return "";
    }
  }

  function getRole() {
    try {
      const raw = localStorage.getItem(window.AUTH_USER_KEY || "user_data");
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
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    if (!currentBase || !token) return null;

    try {
      const res = await fetch(currentBase + "/api/favorites", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.data || [];
      return arr
        .map((item) => ({
          id: resolveId(item?.user_id, item?.profile_id, item?.id),
          kind: "seller",
          title: `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "ไม่ทราบชื่อ",
          subtitle: item?.tagline || "",
          avatar: item?.avatar || "",
          source: "favorite",
          sellerId: resolveId(item?.user_id, item?.profile_id, item?.id),
          profileId: resolveId(item?.user_id, item?.profile_id, item?.id),
        }))
        .filter((x) => x.id);
    } catch (_) {
      return null;
    }
  }

  async function fetchFollowingFromApi() {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    const userId = getCurrentUserId();
    if (!currentBase || !token || !userId) return null;

    try {
      const res = await fetch(currentBase + "/api/follow/" + encodeURIComponent(userId) + "/following", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.data || [];
      return arr
        .map((item) => ({
          id: resolveId(item?.profile_id, item?.id),
          kind: "seller",
          title: `${item?.first_name || ""} ${item?.last_name || ""}`.trim() || "ไม่ทราบชื่อ",
          subtitle: item?.tagline || "",
          avatar: item?.avatar || "",
          source: "follow",
          sellerId: resolveId(item?.profile_id, item?.id),
          profileId: resolveId(item?.profile_id, item?.id),
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
          .map((item) => {
            const kind = String(item?.kind || "seller");
            const offerId = String(item?.offerId || item?.offer_id || item?.productId || (kind === "product" ? item?.id : "") || "");
            const productId = offerId;
            const sellerId = resolveId(item?.sellerId, item?.profileId, item?.user_id, item?.seller_id);
            const id = kind === "product"
              ? (productId || String(item?.id || ""))
              : (sellerId || String(item?.id || ""));

            return {
              id,
              kind,
              title: item?.name || item?.sellerName || item?.title || "ไม่ทราบชื่อ",
              subtitle: item?.sub || item?.sellerSub || item?.subtitle || "",
              sellerName: item?.name || item?.sellerName || item?.title || "",
              productName: item?.productName || item?.sub || item?.sellerSub || item?.subtitle || "",
              avatar: item?.avatar || "",
              source: item?.source || (kind === "product" ? "product-favorite" : "favorite"),
              sellerId,
              profileId: sellerId,
              offerId,
              productId,
              priceA: item?.priceA || "",
              priceB: item?.priceB || "",
              priceC: item?.priceC || "",
              distance: item?.distance || "",
              updateTime: item?.updateTime || "",
              updatedAt: Number(item?.updatedAt || 0),
            };
          })
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
