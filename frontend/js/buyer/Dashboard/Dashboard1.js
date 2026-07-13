(function () {
  "use strict";

  const api = window.api || {};

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : fallback;
  }

  async function getUserTier() {
    try {
      const raw = localStorage.getItem("user_data");
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.tier) return String(user.tier).toLowerCase();
      }
    } catch (_) {}

    try {
      if (api.getProfile) {
        const profile = await api.getProfile();
        const tier = String(profile?.tier || profile?.data?.tier || "free").toLowerCase();
        const raw = localStorage.getItem("user_data");
        if (raw) {
          const user = JSON.parse(raw);
          user.tier = tier;
          localStorage.setItem("user_data", JSON.stringify(user));
        }
        return tier;
      }
    } catch (_) {}

    return "free";
  }

  function getEmptyStats() {
    return {
      totalBookings: 0,
      successBookings: 0,
      waitingBookings: 0,
      cancelBookings: 0,
      successRate: 0,
      peakBookingTime: "-",
      mostBooked: null,
      leastBooked: null,
      dailyAverage: 0,
      monthlyAverage: 0,
      totalFollowers: 0,
      newFollowers: 0,
      followerGrowthRate: 0,
      totalViews: 0,
      province: "-",
      competitorsCount: 0,
      categoryCompetitors: [],
      priceComparison: [],
      bookingSummary: { total: 0, success: 0, waiting: 0, cancel: 0 },
    };
  }

  function normalizeFreeStats(data) {
    const summary = data.booking_stats || { waiting: 0, success: 0, cancel: 0 };
    const total = Number(data.bookings_total || 0);
    return {
      totalBookings: total,
      successRate: total > 0 ? Math.round((Number(summary.success || 0) / total) * 100) : 0,
      totalViews: Number(data.totalViews || 0),
      totalFollowers: Number(data.totalFollowers || 0),
      bookingSummary: {
        total,
        success: Number(summary.success || 0),
        waiting: Number(summary.waiting || 0),
        cancel: Number(summary.cancel || 0),
      },
    };
  }

  async function fetchDashboardStats(period, isPro) {
    const endpoint = isPro ? `/api/dashboard/pro-stats?period=${encodeURIComponent(period)}` : "/api/dashboard";
    if (api.call) return api.call("GET", endpoint);

    const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, "");
    const token = localStorage.getItem("token") || "";
    const res = await fetch(`${currentBase}${endpoint}`, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    return res.json();
  }

  async function loadStats(period) {
    try {
      const tier = await getUserTier();
      const isPro = tier === "pro";
      let response = null;

      try {
        response = await fetchDashboardStats(period, isPro);
      } catch (err) {
        console.warn("[Dashboard] Load from API failed:", err.message);
      }

      if (response && !response.success && response.tier_required) {
        showLockedOverlay();
        renderDashboard(getEmptyStats(), false);
        return;
      }

      const rawStats = response?.success && response?.data ? response.data : getEmptyStats();
      const stats = isPro ? rawStats : normalizeFreeStats(rawStats);
      renderDashboard(stats, isPro);
    } catch (err) {
      console.error("[Dashboard] Load failed:", err);
      renderDashboard(getEmptyStats(), false);
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString();
  }

  function renderDashboard(stats, isPro) {
    const summary = stats.bookingSummary || {};
    const total = Number(summary.total || stats.totalBookings || 0);
    const success = Number(summary.success || stats.successBookings || 0);
    const waiting = Number(summary.waiting || stats.waitingBookings || 0);
    const cancel = Number(summary.cancel || stats.cancelBookings || 0);
    const completedPct = total > 0 ? Math.round((success / total) * 100) : 0;
    const waitingPct = total > 0 ? Math.round((waiting / total) * 100) : 0;
    const cancelPct = total > 0 ? Math.round((cancel / total) * 100) : 0;

    toggleCardLocks(isPro);

    setText("bookingsVal", formatCount(stats.totalBookings || total));
    setText("successRateVal", `${Number(stats.successRate || 0)}%`);
    setText("viewsVal", formatCount(stats.totalViews));
    setText("followersVal", formatCount(stats.totalFollowers));
    setText("centerValue", formatCount(total));
    setText("completedVal", formatCount(success));
    setText("waitingVal", formatCount(waiting));
    setText("cancelVal", formatCount(cancel));
    setText("completedPercentVal", `(${completedPct}%)`);
    setText("waitingPercentVal", `(${waitingPct}%)`);
    setText("cancelPercentVal", `(${cancelPct}%)`);

    const completedFill = document.getElementById("completedFill");
    const waitingFill = document.getElementById("waitingFill");
    const cancelFill = document.getElementById("cancelFill");
    if (completedFill) completedFill.style.width = `${completedPct}%`;
    if (waitingFill) waitingFill.style.width = `${waitingPct}%`;
    if (cancelFill) cancelFill.style.width = `${cancelPct}%`;

    setText("peakTimeVal", stats.peakBookingTime || "-");
    setText("mostBookedVal", stats.mostBooked ? `${stats.mostBooked.name} (${formatCount(stats.mostBooked.count)} ครั้ง)` : "-");
    setText("leastBookedVal", stats.leastBooked ? `${stats.leastBooked.name} (${formatCount(stats.leastBooked.count)} ครั้ง)` : "-");
    setText("dailyAvgVal", stats.dailyAverage !== undefined ? `${formatCount(stats.dailyAverage)} รายการ` : "-");
    setText("monthlyAvgVal", stats.monthlyAverage !== undefined ? `${formatCount(stats.monthlyAverage)} รายการ` : "-");
    setText("totalFollowersVal", formatCount(stats.totalFollowers));
    setText("newFollowers30dVal", `${formatCount(stats.newFollowers)} คน`);
    setText("growthRateVal", `${Number(stats.followerGrowthRate || 0) >= 0 ? "+" : ""}${Number(stats.followerGrowthRate || 0)}%`);

    const compHeader = document.getElementById("competitorsHeaderTitle");
    if (compHeader) {
      compHeader.textContent = t("competitors_in_area", "ล้งคู่แข่งในพื้นที่เดียวกัน ({province})").replace("{province}", stats.province || "-");
    }
    setText("competitorTotalVal", t("buyer_count", "{count} ราย").replace("{count}", formatCount(stats.competitorsCount)));
    renderCompetitors(stats.categoryCompetitors || []);
    renderPriceComparison(stats.priceComparison || []);
    renderWelcome();
  }

  function renderWelcome() {
    const welcomeEl = document.getElementById("welcomeMsg");
    if (!welcomeEl) return;
    try {
      const raw = localStorage.getItem("user_data");
      const user = raw ? JSON.parse(raw) : null;
      const name = user?.first_name || user?.name || "";
      if (name) welcomeEl.textContent = t("welcome_back_name", "ยินดีต้อนรับกลับมา, ") + name;
    } catch (_) {}
  }

  function renderCompetitors(items) {
    const list = document.getElementById("competitorList");
    if (!list) return;
    list.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "competitor-list-item";
      empty.style.justifyContent = "center";
      empty.textContent = t("no_competitor_data", "ไม่พบข้อมูลคู่แข่งในพื้นที่นี้");
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "competitor-list-item";

      const cat = document.createElement("span");
      cat.className = "competitor-cat";
      cat.textContent = `${t("buyer_prefix", "ล้งที่รับซื้อ")}${item.category || "-"}`;

      const count = document.createElement("span");
      count.className = "competitor-count-val";
      count.textContent = t("buyer_count", "{count} ราย").replace("{count}", formatCount(item.count));

      row.appendChild(cat);
      row.appendChild(count);
      list.appendChild(row);
    });
  }

  function renderPriceComparison(items) {
    const list = document.getElementById("priceCompareList");
    if (!list) return;
    list.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "price-compare-item";
      empty.style.textAlign = "center";
      empty.textContent = t("no_price_compare_data", "ไม่มีราคาสมบูรณ์สำหรับเปรียบเทียบในขณะนี้");
      list.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "price-compare-item";
      const isHigher = Number(item.diffPercent || 0) >= 0;
      row.innerHTML = `
        <div class="price-comp-header">
          <span class="price-comp-title">${item.name || t("product", "สินค้า")} ${item.variety ? "(" + item.variety + ")" : ""}</span>
          <span class="price-comp-badge ${isHigher ? "higher" : "lower"}">${item.diffText || "-"}</span>
        </div>
        <div class="price-comp-details">
          <div class="price-val-row">
            <span class="price-val-label">${t("my_price", "ราคาที่ประกาศ")}</span>
            <span class="price-val-num">฿${Number(item.myPrice || 0)} / กก.</span>
          </div>
          <div class="price-val-row">
            <span class="price-val-label">${t("market_average", "ค่าเฉลี่ยตลาด")}</span>
            <span class="price-val-num">฿${Number(item.marketPrice || 0)} / กก.</span>
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  }

  function showLockedOverlay() {
    const overlay = document.getElementById("proLockedOverlay");
    if (overlay) {
      overlay.hidden = false;
      if (window.i18nInit) window.i18nInit();
    }

    const goUpgradeBtn = document.getElementById("goUpgradeBtn");
    if (goUpgradeBtn) goUpgradeBtn.onclick = () => { window.location.href = "../../../pages/account/subscription.html"; };

    const lockBackBtn = document.getElementById("lockBackBtn");
    if (lockBackBtn) lockBackBtn.onclick = () => { window.location.href = "../../../pages/account/account.html"; };
  }

  function toggleCardLocks(isPro) {
    const cardIds = [
      { id: "bookingAnalyticsCard", desc: t("booking_analytics_desc", "ดูสถิติเวลาที่จองมากที่สุด และแนวโน้มวัน/เวลาสำหรับล้งของท่าน") },
      { id: "followerGrowthCard", desc: t("follower_growth_desc", "วิเคราะห์แนวโน้มและอัตราการเติบโตของเกษตรกรที่ติดตามล้งของท่าน") },
      { id: "competitorAnalyticsCard", desc: t("competitor_analytics_desc", "ตรวจสอบจำนวนล้งและประเภทสินค้าที่ทับซ้อนในจังหวัดเดียวกัน") },
      { id: "priceRankingsCard", desc: t("price_rankings_desc", "เปรียบเทียบราคาเสนอซื้อของท่านกับราคาเฉลี่ยในตลาดแบบเรียลไทม์") },
    ];

    cardIds.forEach((card) => {
      const el = document.getElementById(card.id);
      if (!el) return;
      const existing = el.querySelector(".card-locked-overlay");
      if (existing) existing.remove();
      if (isPro) return;

      const overlay = document.createElement("div");
      overlay.className = "card-locked-overlay";
      overlay.innerHTML = `
        <div class="card-locked-icon"><span class="material-icons-outlined">lock</span></div>
        <div class="card-locked-title">${t("pro_feature_locked", "ฟีเจอร์สำหรับ PRO")}</div>
        <div class="card-locked-desc">${card.desc}</div>
        <button class="card-locked-btn" onclick="window.location.href='../../../pages/account/subscription.html'">${t("upgrade_pro_btn", "อัปเกรดเป็น PRO")}</button>
      `;
      el.appendChild(overlay);
    });
  }

  function initPeriodTabs() {
    const tabs = document.querySelectorAll(".period-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((tEl) => tEl.classList.remove("active"));
        tab.classList.add("active");
        loadStats(tab.dataset.period || "today");
      });
    });
  }

  function initBackBtn() {
    const backBtn = document.getElementById("backBtn");
    if (backBtn) backBtn.onclick = () => { window.location.href = "../../../pages/account/account.html"; };
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPeriodTabs();
    initBackBtn();
    loadStats("today");
  });
})();
