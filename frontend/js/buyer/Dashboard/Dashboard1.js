/**
 * AGRIPRICE Dashboard Pro Logic (Real Data & Thai)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const backBtn = document.getElementById('backBtn');
  const welcomeMsg = document.getElementById('welcomeMsg');
  
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const dest = '../../account/account.html';
      if (window.navigateWithTransition) window.navigateWithTransition(dest);
      else window.location.href = dest;
    });
  }

  // Load User Info
  try {
    const userStr = localStorage.getItem(window.AUTH_USER_KEY || 'user_data');
    if (userStr) {
      const user = JSON.parse(userStr);
      const defaultUserLabel = window.i18nT ? window.i18nT('user_label', 'ผู้ใช้งาน') : 'ผู้ใช้งาน';
      const welcomePrefix = window.i18nT ? window.i18nT('welcome_back', 'ยินดีต้อนรับกลับมา') : 'ยินดีต้อนรับกลับมา';
      const name = user.fullName || user.name || user.username || defaultUserLabel;
      if (welcomeMsg) welcomeMsg.innerText = `${welcomePrefix}, ${name}`;
    }
  } catch(e) {}

  // Fetch Real Data
  await fetchDashboardData();

  // Handle Period Tabs
  const periodTabs = document.querySelectorAll('.period-tab');
  periodTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      periodTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // In a full implementation, we would fetch data for specific periods
      fetchDashboardData(tab.dataset.period);
    });
  });
});

async function fetchDashboardData(period = 'month') {
  try {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token');
    
    if (!token) return;

    const res = await fetch(`${currentBase}/api/dashboard/pro-stats?period=${period}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await res.json();
    if (result.success && result.data) {
      updateUI(result.data, period);
    }
  } catch (err) {
    console.error('[Dashboard] Error fetching real data:', err);
  }
}

function updateUI(data, period) {
  // Update Cards
  const fmt = (num) => new Intl.NumberFormat('th-TH').format(num);
  
  document.getElementById('revenueVal').innerText = `฿${fmt(data.monthlyRevenue || 0)}`;
  document.getElementById('bookingsVal').innerText = fmt(data.totalBookings || 0);
  document.getElementById('viewsVal').innerText = fmt(data.totalViews || 0);
  document.getElementById('followersVal').innerText = fmt(data.newFollowers || 0);

  // Trends (Translate and map)
  const trends = data.trends || {};
  const tMap = { 
    'today': window.i18nT ? window.i18nT('vs_yesterday', 'เทียบกับเมื่อวาน') : 'เทียบกับเมื่อวาน', 
    'week': window.i18nT ? window.i18nT('this_week', 'ในสัปดาห์นี้') : 'ในสัปดาห์นี้', 
    'month': window.i18nT ? window.i18nT('from_last_month', 'จากเดือนที่แล้ว') : 'จากเดือนที่แล้ว' 
  };
  const suffix = tMap[period] || tMap['month'];

  document.getElementById('revenueTrend').innerText = `${trends.monthlyRevenue || '0%'} ${suffix}`;
  document.getElementById('bookingsTrend').innerText = `${trends.totalBookings || '0%'} ${suffix}`;
  document.getElementById('viewsTrend').innerText = `${trends.totalViews || '0%'} ${suffix}`;
  document.getElementById('followersTrend').innerText = `${trends.newFollowers || '0%'} ${suffix}`;

  // Center Value
  document.getElementById('centerValue').innerText = fmt(data.totalBookings || 0);
  document.getElementById('completedVal').innerText = fmt(data.bookingSummary?.success || 0);

  // Render Chart with real data
  renderDonutChart(data.bookingSummary);
}

let dashboardChart = null;

function renderDonutChart(stats) {
  const ctx = document.getElementById('bookingSummaryChart');
  if (!ctx) return;

  const success = stats?.success || 0;
  const waiting = stats?.waiting || 0;
  const cancel = stats?.cancel || 0;
  const other = (stats?.total || 0) - (success + waiting + cancel);

  if (dashboardChart) {
    dashboardChart.destroy();
  }

  dashboardChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        window.i18nT ? window.i18nT('completed', 'สำเร็จแล้ว') : 'สำเร็จแล้ว', 
        window.i18nT ? window.i18nT('pending', 'รอดำเนินการ') : 'รอดำเนินการ', 
        window.i18nT ? window.i18nT('cancelled', 'ยกเลิก') : 'ยกเลิก', 
        window.i18nT ? window.i18nT('others', 'อื่นๆ') : 'อื่นๆ'
      ],
      datasets: [{
        data: [success || 1, waiting || 1, cancel || 1, Math.max(0, other) || 1], 
        backgroundColor: [
          '#ef4444', // Red
          'rgba(239, 68, 68, 0.6)', 
          'rgba(239, 68, 68, 0.3)', 
          'rgba(239, 68, 68, 0.1)'
        ],
        borderWidth: 6,
        borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#ffffff',
        hoverOffset: 4,
        borderRadius: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '80%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      layout: { padding: 4 }
    }
  });
}
