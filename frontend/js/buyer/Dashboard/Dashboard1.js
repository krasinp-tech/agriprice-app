(function() {
  "use strict";

  const api = window.api || {};

  // ── Tier Guard ───────────────────────────────────────────────
  async function getUserTier() {
    // 1. Try localStorage first (instant)
    try {
      const raw = localStorage.getItem('user_data');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.tier) return u.tier.toLowerCase();
      }
    } catch (_) {}

    // 2. Fallback: fetch from API
    try {
      if (api.getProfile) {
        const profile = await api.getProfile();
        if (profile && profile.tier) {
          // Sync back to localStorage
          try {
            const raw2 = localStorage.getItem('user_data');
            if (raw2) {
              const u2 = JSON.parse(raw2);
              u2.tier = profile.tier.toLowerCase();
              localStorage.setItem('user_data', JSON.stringify(u2));
            }
          } catch (_) {}
          return profile.tier.toLowerCase();
        }
      }
    } catch (_) {}

    return 'free'; // default to free if unknown
  }

  function showLockedOverlay() {
    const overlay = document.getElementById('proLockedOverlay');
    if (overlay) {
      overlay.hidden = false;
      // i18n refresh
      if (window.i18nInit) window.i18nInit();
    }

    const goUpgradeBtn = document.getElementById('goUpgradeBtn');
    if (goUpgradeBtn) {
      goUpgradeBtn.addEventListener('click', () => {
        window.location.href = '../../../pages/account/subscription.html';
      });
    }

    const lockBackBtn = document.getElementById('lockBackBtn');
    if (lockBackBtn) {
      lockBackBtn.addEventListener('click', () => {
        window.location.href = '../../../pages/account/account.html';
      });
    }
  }

  // ── Dashboard Data ────────────────────────────────────────────
  async function loadStats(period) {
    try {
      const tier = await getUserTier();
      const isPro = tier === 'pro';
      const endpoint = isPro 
        ? `/api/dashboard/pro-stats?period=${period}` 
        : `/api/dashboard`;

      let data;
      if (api.call) {
        data = await api.call('GET', endpoint);
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem('token');
        const res = await fetch(`${currentBase}${endpoint}`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        data = await res.json();
      }

      if (data && data.success && data.data) {
        let stats = data.data;
        if (!isPro) {
          const summary = stats.booking_stats || { waiting: 0, success: 0, cancel: 0 };
          const total = stats.bookings_total || 0;
          const successRate = total > 0 ? Math.round((summary.success / total) * 100) : 0;
          stats = {
            totalBookings: total,
            successRate: successRate,
            totalViews: 0,
            totalFollowers: 0,
            bookingSummary: {
              total: total,
              success: summary.success || 0,
              waiting: summary.waiting || 0,
              cancel: summary.cancel || 0
            }
          };
        }
        renderDashboard(stats, isPro);
      } else if (data && !data.success && data.tier_required) {
        showLockedOverlay();
      }
    } catch (err) {
      console.error('[Dashboard] Load failed:', err);
    }
  }

  function renderDashboard(stats, isPro) {
    if (!stats) return;

    toggleCardLocks(isPro);

    // KPI Cards
    const bookingsEl = document.getElementById('bookingsVal');
    const successRateEl = document.getElementById('successRateVal');
    const viewsEl = document.getElementById('viewsVal');
    const followersEl = document.getElementById('followersVal');
    
    const centerValueEl = document.getElementById('centerValue');
    const completedEl = document.getElementById('completedVal');
    const waitingEl = document.getElementById('waitingVal');
    const cancelEl = document.getElementById('cancelVal');
    const welcomeEl = document.getElementById('welcomeMsg');

    if (bookingsEl) bookingsEl.textContent = (stats.totalBookings || 0).toLocaleString();
    if (successRateEl) successRateEl.textContent = (stats.successRate || 0) + '%';
    if (viewsEl) viewsEl.textContent = (stats.totalViews || 0).toLocaleString();
    if (followersEl) followersEl.textContent = (stats.totalFollowers || 0).toLocaleString();

    // Welcome message
    if (welcomeEl) {
      try {
        const raw = localStorage.getItem('user_data');
        if (raw) {
          const u = JSON.parse(raw);
          const name = u.first_name || u.name || '';
          if (name) {
            const greeting = window.i18nT ? window.i18nT('welcome_back_name', 'ยินดีต้อนรับกลับมา, ') : 'ยินดีต้อนรับกลับมา, ';
            welcomeEl.textContent = greeting + name;
          }
        }
      } catch (_) {}
    }

    // Booking Summary Donut
    const summary = stats.bookingSummary || {};
    const total = summary.total || 0;
    const success = summary.success || 0;
    const waiting = summary.waiting || 0;
    const cancel = summary.cancel || 0;

    if (centerValueEl) centerValueEl.textContent = total;
    if (completedEl) completedEl.textContent = success;
    if (waitingEl) waitingEl.textContent = waiting;
    if (cancelEl) cancelEl.textContent = cancel;

    // Render donut chart
    const canvas = document.getElementById('bookingSummaryChart');
    if (canvas && window.Chart) {
      if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
      }
      canvas._chartInstance = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['สำเร็จ', 'รอดำเนินการ', 'ยกเลิก'],
          datasets: [{
            data: [success || 0, waiting || 0, cancel || 0],
            backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          cutout: '72%',
          plugins: { legend: { display: false } },
          animation: { animateRotate: true, duration: 700 }
        }
      });
    }

    // Booking Deep Details
    const peakTimeEl = document.getElementById('peakTimeVal');
    const mostBookedEl = document.getElementById('mostBookedVal');
    const leastBookedEl = document.getElementById('leastBookedVal');
    const dailyAvgEl = document.getElementById('dailyAvgVal');
    const monthlyAvgEl = document.getElementById('monthlyAvgVal');

    if (peakTimeEl) peakTimeEl.textContent = stats.peakBookingTime || '-';
    if (mostBookedEl) {
      mostBookedEl.textContent = stats.mostBooked 
        ? `${stats.mostBooked.name} (${stats.mostBooked.count} ครั้ง)`
        : '-';
    }
    if (leastBookedEl) {
      leastBookedEl.textContent = stats.leastBooked 
        ? `${stats.leastBooked.name} (${stats.leastBooked.count} ครั้ง)`
        : '-';
    }
    if (dailyAvgEl) {
      dailyAvgEl.textContent = stats.dailyAverage !== undefined
        ? `${stats.dailyAverage.toLocaleString()} รายการ`
        : '-';
    }
    if (monthlyAvgEl) {
      monthlyAvgEl.textContent = stats.monthlyAverage !== undefined
        ? `${stats.monthlyAverage.toLocaleString()} รายการ`
        : '-';
    }

    // Follower Growth Details
    const totalFollowersEl = document.getElementById('totalFollowersVal');
    const newFollowers30dEl = document.getElementById('newFollowers30dVal');
    const growthRateEl = document.getElementById('growthRateVal');

    if (totalFollowersEl) totalFollowersEl.textContent = (stats.totalFollowers || 0).toLocaleString();
    if (newFollowers30dEl) newFollowers30dEl.textContent = `${stats.newFollowers || 0} คน`;
    if (growthRateEl) {
      const growthSign = (stats.followerGrowthRate || 0) >= 0 ? '+' : '';
      growthRateEl.textContent = `${growthSign}${stats.followerGrowthRate || 0}%`;
    }

    // Competitors Header & List
    const compHeader = document.getElementById('competitorsHeaderTitle');
    if (compHeader) {
      const rawTitle = window.i18nT ? window.i18nT('competitors_in_area', 'ล้งคู่แข่งในพื้นที่เดียวกัน ({province})') : 'ล้งคู่แข่งในพื้นที่เดียวกัน ({province})';
      compHeader.textContent = rawTitle.replace('{province}', stats.province || '-');
    }
    const compTotalEl = document.getElementById('competitorTotalVal');
    if (compTotalEl) {
      const countWord = window.i18nT ? window.i18nT('buyer_count', '{count} ราย') : '{count} ราย';
      compTotalEl.textContent = countWord.replace('{count}', stats.competitorsCount || 0);
    }

    const competitorList = document.getElementById('competitorList');
    if (competitorList) {
      competitorList.innerHTML = '';
      if (stats.categoryCompetitors && stats.categoryCompetitors.length > 0) {
        stats.categoryCompetitors.forEach(item => {
          const div = document.createElement('div');
          div.className = 'competitor-list-item';
          
          const catName = document.createElement('span');
          catName.className = 'competitor-cat';
          catName.textContent = `ล้งที่รับซื้อ${item.category}`;
          
          const countVal = document.createElement('span');
          countVal.className = 'competitor-count-val';
          const countText = window.i18nT ? window.i18nT('buyer_count', '{count} ราย') : '{count} ราย';
          countVal.textContent = countText.replace('{count}', item.count);
          
          div.appendChild(catName);
          div.appendChild(countVal);
          competitorList.appendChild(div);
        });
      } else {
        const noData = document.createElement('div');
        noData.className = 'competitor-list-item';
        noData.style.justifyContent = 'center';
        noData.textContent = 'ไม่พบข้อมูลคู่แข่งในพื้นที่นี้';
        competitorList.appendChild(noData);
      }
    }

    // Price Rankings Card
    const priceList = document.getElementById('priceCompareList');
    if (priceList) {
      priceList.innerHTML = '';
      if (stats.priceComparison && stats.priceComparison.length > 0) {
        stats.priceComparison.forEach(item => {
          const div = document.createElement('div');
          div.className = 'price-compare-item';
          
          const isHigher = item.diffPercent >= 0;
          const badgeClass = isHigher ? 'higher' : 'lower';
          
          div.innerHTML = `
            <div class="price-comp-header">
              <span class="price-comp-title">${item.name || 'สินค้า'} ${item.variety ? '(' + item.variety + ')' : ''}</span>
              <span class="price-comp-badge ${badgeClass}">${item.diffText}</span>
            </div>
            <div class="price-comp-details">
              <div class="price-val-row">
                <span class="price-val-label" data-i18n="my_price">ราคาที่ประกาศ</span>
                <span class="price-val-num">฿${item.myPrice} / กก.</span>
              </div>
              <div class="price-val-row">
                <span class="price-val-label" data-i18n="market_average">ค่าเฉลี่ยตลาด</span>
                <span class="price-val-num">฿${item.marketPrice} / กก.</span>
              </div>
            </div>
          `;
          priceList.appendChild(div);
        });
        
        // Translate child elements of dynamically rendered list
        if (window.i18nT) {
          priceList.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = window.i18nT(key, el.textContent);
          });
        }
      } else {
        const noData = document.createElement('div');
        noData.className = 'price-compare-item';
        noData.style.textAlign = 'center';
        noData.textContent = 'ไม่มีราคาสมบูรณ์สำหรับเปรียบเทียบในขณะนี้';
        priceList.appendChild(noData);
      }
    }
  }

  function toggleCardLocks(isPro) {
    const cardIds = [
      { id: 'bookingAnalyticsCard', desc: 'ดูสถิติเวลาที่จองมากที่สุด และแนวโน้มวัน/เวลาสำหรับล้งของท่าน' },
      { id: 'followerGrowthCard', desc: 'วิเคราะห์แนวโน้มและอัตราการเติบโตของเกษตรกรที่ติดตามล้งของท่าน' },
      { id: 'competitorAnalyticsCard', desc: 'ตรวจสอบจำนวนล้งและประเภทสินค้าที่ทับซ้อนในจังหวัดเดียวกัน' },
      { id: 'priceRankingsCard', desc: 'เปรียบเทียบราคาเสนอซื้อของท่านกับราคาเฉลี่ยในตลาดแบบเรียลไทม์' }
    ];

    cardIds.forEach(card => {
      const el = document.getElementById(card.id);
      if (!el) return;

      const existing = el.querySelector('.card-locked-overlay');
      if (existing) existing.remove();

      if (!isPro) {
        const overlay = document.createElement('div');
        overlay.className = 'card-locked-overlay';
        
        const upgradeText = window.i18nT ? window.i18nT('upgrade_pro_btn', 'อัปเกรดเป็น PRO') : 'อัปเกรดเป็น PRO';
        const proFeatureText = window.i18nT ? window.i18nT('pro_feature_locked', 'ฟีเจอร์สำหรับ PRO') : 'ฟีเจอร์สำหรับ PRO';
        
        overlay.innerHTML = `
          <div class="card-locked-icon">
            <span class="material-icons-outlined">lock</span>
          </div>
          <div class="card-locked-title">${proFeatureText}</div>
          <div class="card-locked-desc">${card.desc}</div>
          <button class="card-locked-btn" onclick="window.location.href='../../../pages/account/subscription.html'">${upgradeText}</button>
        `;
        el.appendChild(overlay);
      }
    });
  }

  // ── Period Tabs ───────────────────────────────────────────────
  function initPeriodTabs() {
    const tabs = document.querySelectorAll('.period-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadStats(tab.dataset.period || 'today');
      });
    });
  }

  // ── Back button ───────────────────────────────────────────────
  function initBackBtn() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = '../../../pages/account/account.html';
      });
    }
  }

  // ── Init ─────────────────────────────────────────────────────
  async function init() {
    initPeriodTabs();
    initBackBtn();

    loadStats('today');
  }

  document.addEventListener('DOMContentLoaded', init);
})();

