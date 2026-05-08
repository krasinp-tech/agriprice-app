// js/buyer/Dashboard/Dashboard1.js
(function () {
  "use strict";

  // ============================================================
  // CONFIG & GLOBALS
  // ============================================================
  const DEBUG = !!window.DASHBOARD_DEBUG;
  let currentPeriod = 7; // วัน
  let myChart = null;

  // ============================================================
  // MOCK DATA
  // ============================================================
  const MOCK_DASHBOARD_DATA = {
    totalOrders: 156,
    totalSpent: 284500,
    totalProducts: 42,
    avgPrice: 1824,
    
    purchaseTrend: {
      "7": {
        labels: ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."],
        data: [12, 19, 15, 25, 22, 30, 28]
      },
      "30": {
        labels: ["สัปดาห์ 1", "สัปดาห์ 2", "สัปดาห์ 3", "สัปดาห์ 4"],
        data: [85, 92, 78, 95]
      },
      "90": {
        labels: ["เดือน 1", "เดือน 2", "เดือน 3"],
        data: [245, 298, 312]
      },
      "365": {
        labels: ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
        data: [85, 92, 98, 105, 88, 95, 102, 110, 115, 108, 125, 132]
      }
    },

    topProducts: [
      { id: 1, name: "มะม่วงน้ำดอกไม้", qty: 45, spent: 48500, image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=100" },
      { id: 2, name: "ทุริยันหมอนทอง", qty: 38, spent: 42300, image: "https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?w=100" },
      { id: 3, name: "ส้มโชกุน", qty: 32, spent: 28900, image: "https://images.unsplash.com/photo-1547514701-42782101795e?w=100" },
      { id: 4, name: "กล้วยหอมทอง", qty: 28, spent: 18500, image: "https://images.unsplash.com/photo-1603833797131-3c0a4b0b2e6e?w=100" },
      { id: 5, name: "มังคุดสวนเจริญ", qty: 25, spent: 22500, image: "https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=100" }
    ],

    topSellers: [
      { id: 1, name: "สวนมะม่วงโชคชัย", orders: 28, avatar: "https://i.pravatar.cc/100?img=33" },
      { id: 2, name: "ทุเรียนไร่สมบัติ", orders: 22, avatar: "https://i.pravatar.cc/100?img=45" },
      { id: 3, name: "สวนผลไม้บ้านสวน", orders: 18, avatar: "https://i.pravatar.cc/100?img=52" },
      { id: 4, name: "ฟาร์มเกษตรอินทรีย์", orders: 15, avatar: "https://i.pravatar.cc/100?img=68" },
      { id: 5, name: "สวนผักปลอดสาร", orders: 12, avatar: "https://i.pravatar.cc/100?img=71" }
    ],

    bookingStats: {
      waiting: 15,
      success: 125,
      cancel: 16
    },

    recentActivities: [
      { icon: "shopping_cart", title: "ทำการสั่งซื้อมะม่วง", desc: "สวนมะม่วงโชคชัย • ฿2,450", time: "2 ชั่วโมงที่แล้ว" },
      { icon: "local_shipping", title: "สินค้าถูกจัดส่งแล้ว", desc: "ทุเรียนหมอนทอง 5 กก.", time: "5 ชั่วโมงที่แล้ว" },
      { icon: "check_circle", title: "การจองสำเร็จ", desc: "จองคิวรับสินค้าวันที่ 5 มี.ค.", time: "1 วันที่แล้ว" },
      { icon: "cancel", title: "ยกเลิกการจอง", desc: "ส้มโชกุน 10 กก. • คืนเงิน ฿850", time: "2 วันที่แล้ว" },
      { icon: "star", title: "ให้คะแนนผู้ขาย", desc: "สวนมะม่วงโชคชัย • 5 ดาว", time: "3 วันที่แล้ว" }
    ]
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
  const recentActivityEl = document.getElementById("recentActivity");

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
    const trendData = MOCK_DASHBOARD_DATA.purchaseTrend[String(period)];
    
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
  // RENDER RECENT ACTIVITY
  // ============================================================
  function renderRecentActivity(activities) {
    if (!recentActivityEl) return;

    const html = activities.map(a => `
      <div class="activity-item">
        <div class="activity-icon">
          <span class="material-icons-outlined">${a.icon}</span>
        </div>
        <div class="activity-content">
          <div class="activity-title">${a.title}</div>
          <div class="activity-desc">${a.desc}</div>
          <div class="activity-time">${a.time}</div>
        </div>
      </div>
    `).join("");

    recentActivityEl.innerHTML = html;
  }

  // ============================================================
  // LOAD DATA
  // ============================================================
  async function loadDashboardData() {
    // ในอนาคตสามารถเรียก API ได้
    // const response = await fetch("/api/buyer/dashboard");
    // return await response.json();
    
    return MOCK_DASHBOARD_DATA;
  }

  async function initDashboard() {
    try {
      const data = await loadDashboardData();
      
      renderKPI(data);
      renderChart(currentPeriod, "line");
      renderTopProducts(data.topProducts);
      renderTopSellers(data.topSellers);
      renderBookingStats(data.bookingStats);
      renderRecentActivity(data.recentActivities);
      
      log("Dashboard initialized");
    } catch (error) {
      log("Error loading dashboard:", error);
      alert("เกิดข้อผิดพลาดในการโหลดข้อมูล");
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
