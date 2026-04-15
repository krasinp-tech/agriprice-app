// js/buyer/Dashboard/Dashboard1.js
(function () {
  "use strict";

  // ============================================================
  // CONFIG & GLOBALS
  // ============================================================
  const DEBUG = !!window.DASHBOARD_DEBUG;
  let currentPeriod = 7; // วัน
  let myChart = null;
  let currentDashboardData = null;

  // ============================================================
  // EMPTY DATA
  // ============================================================
  const EMPTY_DASHBOARD_DATA = {
    totalOrders: 0,
    totalSpent: 0,
    totalProducts: 0,
    avgPrice: 0,

    purchaseTrend: {
      "7": {
        labels: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."],
        data: [0, 0, 0, 0, 0, 0, 0]
      },
      "30": {
        labels: ["สัปดาห์ 1", "สัปดาห์ 2", "สัปดาห์ 3", "สัปดาห์ 4"],
        data: [0, 0, 0, 0]
      },
      "90": {
        labels: ["เดือน 1", "เดือน 2", "เดือน 3"],
        data: [0, 0, 0]
      },
      "365": {
        labels: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    },

    topProducts: [],

    topSellers: [],

    bookingStats: {
      waiting: 0,
      success: 0,
      cancel: 0
    }
  };

  // ============================================================
  // DOM ELEMENTS
  // ============================================================
  const backBtn = document.getElementById("backBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const periodTabs = document.querySelectorAll(".period-tab");
  const chartTypeSelect = document.getElementById("chartType");

  const totalOrdersEl = document.getElementById("totalOrders");
  const totalSpentEl = document.getElementById("totalSpent");
  const totalProductsEl = document.getElementById("totalProducts");
  const avgPriceEl = document.getElementById("avgPrice");

  const chartCanvas = document.getElementById("purchaseChart");
  const topProductsEl = document.getElementById("topProducts");
  const topSellersEl = document.getElementById("topSellers");

  const waitingCountEl = document.getElementById("waitingCount");
  const waitingPercentEl = document.getElementById("waitingPercent");
  const successCountEl = document.getElementById("successCount");
  const successPercentEl = document.getElementById("successPercent");
  const cancelCountEl = document.getElementById("cancelCount");
  const cancelPercentEl = document.getElementById("cancelPercent");

  // ============================================================
  // HELPERS
  // ============================================================
  function log(...args) {
    if (DEBUG) console.log("[Dashboard]", ...args);
  }

  function formatNumber(num) {
    return new Intl.NumberFormat("th-TH").format(num);
  }

  function formatCurrency(num) {
    return "฿" + formatNumber(num);
  }

  function renderConnectionUnavailable() {
    if (topProductsEl) {
      topProductsEl.innerHTML = `<div class="empty-state"><span class="material-icons-outlined empty-state-icon">cloud_off</span><div class="empty-state-title">เชื่อมต่อข้อมูลไม่ได้</div><div class="empty-state-text">กรุณาตรวจสอบเซิร์ฟเวอร์หรืออินเทอร์เน็ต แล้วกดรีเฟรชอีกครั้ง</div></div>`;
    }
    if (topSellersEl) {
      topSellersEl.innerHTML = `<div class="empty-state"><span class="material-icons-outlined empty-state-icon">cloud_off</span><div class="empty-state-title">เชื่อมต่อข้อมูลไม่ได้</div><div class="empty-state-text">ไม่สามารถโหลดข้อมูลผู้ขายได้ในขณะนี้</div></div>`;
    }
  }

  async function fetchBookingStatsLive(defaultStats) {
    const base = defaultStats || { waiting: 0, success: 0, cancel: 0 };
    if (!window.api || typeof window.api.getBookings !== "function") return base;

    try {
      const resp = await window.api.getBookings();
      const rows = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      const stats = rows.reduce((acc, row) => {
        const status = String(row?.status || "").toLowerCase();
        if (status === "waiting") acc.waiting += 1;
        else if (status === "success") acc.success += 1;
        else if (status === "cancel") acc.cancel += 1;
        return acc;
      }, { waiting: 0, success: 0, cancel: 0 });
      return stats;
    } catch (err) {
      log("fetchBookingStatsLive failed:", err?.message || err);
      return base;
    }
  }

  // ============================================================
  // RENDER KPI
  // ============================================================
  function renderKPI(data) {
    if (totalOrdersEl) totalOrdersEl.textContent = formatNumber(data.totalOrders);
    if (totalSpentEl) totalSpentEl.textContent = formatCurrency(data.totalSpent);
    if (totalProductsEl) totalProductsEl.textContent = formatNumber(data.totalProducts);
    if (avgPriceEl) avgPriceEl.textContent = formatCurrency(data.avgPrice);
  }

  // ============================================================
  // RENDER CHART
  // ============================================================
  function renderChart(period, type = "line") {
    if (!chartCanvas) return;
    
    const ctx = chartCanvas.getContext("2d");
    const source = currentDashboardData || EMPTY_DASHBOARD_DATA;
    const trendData = source.purchaseTrend?.[String(period)] || { labels: [], data: [] };
    
    if (!trendData) {
      log("No trend data for period:", period);
      return;
    }

    // ทำลาย chart เก่า
    if (myChart) {
      myChart.destroy();
    }

    myChart = new Chart(ctx, {
      type: type,
      data: {
        labels: trendData.labels,
        datasets: [{
          label: "ยอดสั่งซื้อ",
          data: trendData.data,
          backgroundColor: type === "bar" 
            ? "rgba(20, 174, 96, 0.8)" 
            : "rgba(20, 174, 96, 0.1)",
          borderColor: "#14AE60",
          borderWidth: 3,
          fill: type === "line",
          tension: 0.4,
          pointBackgroundColor: "#14AE60",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: "rgba(0,0,0,0.8)",
            titleFont: { size: 14, weight: "bold", family: "Sarabun" },
            bodyFont: { size: 13, family: "Sarabun" },
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0,0,0,0.05)"
            },
            ticks: {
              font: { family: "Sarabun", size: 12 }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { family: "Sarabun", size: 12 }
            }
          }
        }
      }
    });
  }

  // ============================================================
  // RENDER TOP PRODUCTS
  // ============================================================
  function renderTopProducts(products) {
    if (!topProductsEl) return;

    if (!Array.isArray(products) || products.length === 0) {
      topProductsEl.innerHTML = `<div class="empty-state"><span class="material-icons-outlined empty-state-icon">inventory_2</span><div class="empty-state-title">ยังไม่มีข้อมูลสินค้า</div><div class="empty-state-text">ยังไม่มีรายการจองสำเร็จสำหรับการจัดอันดับสินค้า</div></div>`;
      return;
    }

    const html = products.map((p, idx) => {
      let rankClass = "";
      if (idx === 1) rankClass = "second";
      if (idx === 2) rankClass = "third";

      return `
        <div class="top-item" data-id="${p.id}">
          <div class="top-rank ${rankClass}">${idx + 1}</div>
          <img src="${p.image}" alt="${p.name}" class="top-img" />
          <div class="top-info">
            <div class="top-name">${p.name}</div>
            <div class="top-meta">สั่งซื้อ ${p.qty} ครั้ง</div>
          </div>
          <div class="top-value">${formatCurrency(p.spent)}</div>
        </div>
      `;
    }).join("");

    topProductsEl.innerHTML = html;
  }

  // ============================================================
  // RENDER TOP SELLERS
  // ============================================================
  function renderTopSellers(sellers) {
    if (!topSellersEl) return;

    if (!Array.isArray(sellers) || sellers.length === 0) {
      topSellersEl.innerHTML = `<div class="empty-state"><span class="material-icons-outlined empty-state-icon">groups</span><div class="empty-state-title">ยังไม่มีข้อมูลผู้ขาย</div><div class="empty-state-text">ยังไม่มีประวัติการติดต่อผู้ขายในรายการสำเร็จ</div></div>`;
      return;
    }

    const html = sellers.map(s => `
      <div class="seller-item" data-id="${s.id}">
        <img src="${s.avatar}" alt="${s.name}" class="seller-avatar" />
        <div class="seller-info">
          <div class="seller-name">${s.name}</div>
          <div class="seller-stats">ติดต่อ ${s.orders} ครั้ง</div>
        </div>
        <div class="seller-badge">${s.orders} คำสั่งซื้อ</div>
      </div>
    `).join("");

    topSellersEl.innerHTML = html;
  }

  // ============================================================
  // RENDER BOOKING STATS
  // ============================================================
  function renderBookingStats(stats) {
    const total = stats.waiting + stats.success + stats.cancel;
    
    if (total === 0) {
      if (waitingCountEl) waitingCountEl.textContent = "0";
      if (waitingPercentEl) waitingPercentEl.textContent = "0%";
      if (successCountEl) successCountEl.textContent = "0";
      if (successPercentEl) successPercentEl.textContent = "0%";
      if (cancelCountEl) cancelCountEl.textContent = "0";
      if (cancelPercentEl) cancelPercentEl.textContent = "0%";
      return;
    }

    const waitingPercent = Math.round((stats.waiting / total) * 100);
    const successPercent = Math.round((stats.success / total) * 100);
    const cancelPercent = Math.round((stats.cancel / total) * 100);

    if (waitingCountEl) waitingCountEl.textContent = formatNumber(stats.waiting);
    if (waitingPercentEl) waitingPercentEl.textContent = waitingPercent + "%";
    
    if (successCountEl) successCountEl.textContent = formatNumber(stats.success);
    if (successPercentEl) successPercentEl.textContent = successPercent + "%";
    
    if (cancelCountEl) cancelCountEl.textContent = formatNumber(stats.cancel);
    if (cancelPercentEl) cancelPercentEl.textContent = cancelPercent + "%";

    // อัพเดท conic-gradient
    const waitingCircle = document.querySelector(".stat-circle.waiting");
    const successCircle = document.querySelector(".stat-circle.success");
    const cancelCircle = document.querySelector(".stat-circle.cancel");

    if (waitingCircle) {
      waitingCircle.style.background = `conic-gradient(#F59E0B 0% ${waitingPercent}%, #F5F6F8 ${waitingPercent}% 100%)`;
    }
    if (successCircle) {
      successCircle.style.background = `conic-gradient(#10B981 0% ${successPercent}%, #F5F6F8 ${successPercent}% 100%)`;
    }
    if (cancelCircle) {
      cancelCircle.style.background = `conic-gradient(#EF4444 0% ${cancelPercent}%, #F5F6F8 ${cancelPercent}% 100%)`;
    }
  }

  // ============================================================
  // LOAD DATA
  // ============================================================
  function normalizeDashboardResponse(payload) {
    const src = payload || {};
    return {
      totalOrders: Number(src.bookings_total || 0),
      totalSpent: Number(src.total_spent ?? src.totalSpent ?? 0),
      totalProducts: Number(src.products_total || 0),
      avgPrice: Number(src.avg_price ?? src.avgPrice ?? 0),
      purchaseTrend: src.purchaseTrend || EMPTY_DASHBOARD_DATA.purchaseTrend,
      topProducts: Array.isArray(src.top_products)
        ? src.top_products.map((p) => ({
            id: p.id,
            name: p.name || "ไม่ทราบ",
            qty: Number(p.qty || 0),
            spent: Number(p.spent || 0),
            image: p.image || "../../../assets/images/default-product.png",
          }))
        : [],
      topSellers: Array.isArray(src.top_sellers)
        ? src.top_sellers.map((s) => ({
            id: s.id,
            name: s.name || "ไม่ทราบ",
            orders: Number(s.orders ?? s.qty ?? 0),
            avatar: s.avatar || "https://ui-avatars.com/api/?background=E8F7EF&color=14AE60&name=Seller",
          }))
        : [],
      bookingStats: {
        waiting: Number(src.booking_stats?.waiting || 0),
        success: Number(src.booking_stats?.success || 0),
        cancel: Number(src.booking_stats?.cancel || 0),
      }
    };
  }

  async function loadDashboardData() {
    if (!window.api || typeof window.api.getDashboard !== "function") {
      throw new Error("API client ไม่พร้อมใช้งาน");
    }

    const payload = await window.api.getDashboard();
    if (!payload) {
      throw new Error("ไม่ได้รับข้อมูล dashboard จาก server");
    }
    const normalized = normalizeDashboardResponse(payload);
    normalized.bookingStats = await fetchBookingStatsLive(normalized.bookingStats);
    return normalized;
  }

  async function initDashboard() {
    try {
      const data = await loadDashboardData();
      currentDashboardData = data;
      
      renderKPI(data);
      renderChart(currentPeriod, "line");
      renderTopProducts(data.topProducts);
      renderTopSellers(data.topSellers);
      renderBookingStats(data.bookingStats);
      
      log("Dashboard initialized");
    } catch (error) {
      log("Error loading dashboard:", error);
      if (window.appNotify) {
        window.appNotify("เชื่อมต่อข้อมูลไม่ได้ แสดงข้อมูลว่างแทน", "warning");
      }
      const fallbackData = { ...EMPTY_DASHBOARD_DATA, purchaseTrend: { ...EMPTY_DASHBOARD_DATA.purchaseTrend } };
      currentDashboardData = fallbackData;
      renderKPI(fallbackData);
      renderChart(currentPeriod, "line");
      renderConnectionUnavailable();
      fallbackData.bookingStats = await fetchBookingStatsLive(fallbackData.bookingStats);
      renderBookingStats(fallbackData.bookingStats);
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================
  
  // Back button
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.history.back();
    });
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.style.transform = "rotate(360deg)";
      refreshBtn.style.transition = "transform 0.6s ease";
      
      await initDashboard();
      
      setTimeout(() => {
        refreshBtn.style.transform = "";
      }, 600);
    });
  }

  // Period tabs
  periodTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      periodTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      currentPeriod = parseInt(tab.dataset.period);
      const chartType = chartTypeSelect ? chartTypeSelect.value : "line";
      renderChart(currentPeriod, chartType);
      
      log("Period changed to:", currentPeriod);
    });
  });

  // Chart type selector
  if (chartTypeSelect) {
    chartTypeSelect.addEventListener("change", (e) => {
      const chartType = e.target.value;
      renderChart(currentPeriod, chartType);
      log("Chart type changed to:", chartType);
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    log("Dashboard page loaded");
    initDashboard();
  });

})();
