(function () {
  'use strict';
  const api = window.api || {};
  let currentPeriod = 'today';
  const $ = id => document.getElementById(id);
  const count = value => Number(value || 0).toLocaleString('th-TH');
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const routes = { bookings: '../setbooking/booking.html', products: '../myprofile.html', followers: '../../account/account.html' };

  async function getTier() {
    try {
      const profile = await api.getProfile();
      const expires = profile?.pro_expires_at ? new Date(profile.pro_expires_at) : null;
      return String(profile?.tier || 'free').toLowerCase() === 'pro' && (!expires || expires > new Date()) ? 'pro' : 'free';
    } catch (_) {
      try { return String(JSON.parse(localStorage.getItem('user_data') || '{}').tier || 'free').toLowerCase(); } catch { return 'free'; }
    }
  }

  async function fetchStats(period) {
    return api.call('GET', `/api/dashboard/pro-stats?period=${encodeURIComponent(period)}`);
  }

  function trendLabel(value, suffix = '%') {
    const number = Number(value || 0);
    if (!number) return 'เท่ากับช่วงก่อน';
    return `${number > 0 ? '↑' : '↓'} ${Math.abs(number)}${suffix} จากช่วงก่อน`;
  }

  function renderChart(chart = {}) {
    const mount = $('trendChart'); if (!mount) return;
    const labels = chart.labels || [], bookings = chart.bookings || [], views = chart.impressions || [];
    if (!labels.length || (!bookings.some(Boolean) && !views.some(Boolean))) { mount.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">show_chart</span><p>ยังไม่มีข้อมูลแนวโน้มในช่วงนี้</p></div>'; return; }
    const width = 640, height = 190, padX = 24, padY = 22;
    const max = Math.max(1, ...bookings, ...views);
    const points = values => values.map((value, index) => `${padX + (labels.length === 1 ? (width - padX * 2) / 2 : index * (width - padX * 2) / (labels.length - 1))},${height - padY - (value / max) * (height - padY * 2)}`).join(' ');
    const labelEvery = labels.length > 10 ? Math.ceil(labels.length / 6) : 1;
    mount.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="กราฟแนวโน้ม"><defs><linearGradient id="viewFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b" stop-opacity=".22"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></linearGradient></defs><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" class="axis"/><polyline points="${points(views)}" class="line views"/><polyline points="${points(bookings)}" class="line bookings"/>${labels.map((label,i)=>i%labelEvery===0?`<text x="${padX+(labels.length===1?(width-padX*2)/2:i*(width-padX*2)/(labels.length-1))}" y="${height-4}" text-anchor="middle">${label}</text>`:'').join('')}</svg>`;
  }

  function renderRecommendations(items = []) {
    const mount = $('recommendationList'); if (!mount) return;
    mount.innerHTML = items.map(item => `<button class="recommendation ${item.tone || ''}" ${item.action ? `data-go="${item.action}"` : ''}><span class="material-icons-outlined">${item.icon || 'tips_and_updates'}</span><span><b>${item.title}</b><small>${item.detail}</small></span>${item.action ? '<span class="material-icons-outlined arrow">chevron_right</span>' : ''}</button>`).join('');
  }

  function renderList(id, items, renderer, emptyText) {
    const mount = $(id); if (!mount) return;
    mount.innerHTML = items?.length ? items.map(renderer).join('') : `<div class="empty-inline">${emptyText}</div>`;
  }

  function render(stats) {
    const summary = stats.bookingSummary || {}, total = Number(summary.total || 0), success = Number(summary.success || 0), waiting = Number(summary.waiting || 0), cancel = Number(summary.cancel || 0);
    const pct = value => total ? Math.round(value / total * 100) : 0;
    text('bookingsVal', count(stats.totalBookings)); text('successRateVal', `${Number(stats.successRate || 0)}%`); text('viewsVal', count(stats.totalViews)); text('followersVal', count(stats.totalFollowers));
    text('bookingsTrend', trendLabel(stats.trends?.totalBookings)); text('successRateTrend', trendLabel(stats.trends?.successRate, ' จุด')); text('viewsTrend', trendLabel(stats.trends?.totalViews)); text('followersTrend', trendLabel(stats.trends?.newFollowers));
    text('centerValue', count(total)); text('completedVal', count(success)); text('waitingVal', count(waiting)); text('cancelVal', count(cancel));
    [['completed',success],['waiting',waiting],['cancel',cancel]].forEach(([key,value])=>{ text(`${key}PercentVal`, `${pct(value)}%`); $(`${key}Fill`).style.width=`${pct(value)}%`; });
    text('peakTimeVal', stats.peakBookingTime || '—'); text('mostBookedVal', stats.mostBooked ? `${stats.mostBooked.name} (${count(stats.mostBooked.count)})` : '—'); text('dailyAvgVal', `${Number(stats.dailyAverage || 0).toLocaleString('th-TH')} รายการ`); text('newFollowersVal', `${count(stats.newFollowers)} คน`);
    text('conversionRate', `${Number(stats.funnel?.conversionRate || 0)}%`); text('funnelViews', count(stats.funnel?.impressions)); text('funnelBookings', count(stats.funnel?.bookings)); text('funnelSuccess', count(stats.funnel?.success));
    text('competitorsHeaderTitle', `คู่แข่งใน${stats.province && stats.province !== '-' ? stats.province : 'พื้นที่'}`); text('competitorTotalVal', `${count(stats.competitorsCount)} ราย`);
    text('updatedAt', `อัปเดต ${new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit'}).format(new Date(stats.updatedAt || Date.now()))} น.`);
    renderChart(stats.trendChart); renderRecommendations(stats.recommendations);
    renderList('competitorList', stats.categoryCompetitors, item => `<div><span>รับซื้อ${item.category || 'สินค้า'}</span><b>${count(item.count)} ราย</b></div>`, 'ยังไม่มีข้อมูลคู่แข่งในพื้นที่');
    renderList('priceCompareList', stats.priceComparison, item => `<div class="price-item"><span><b>${item.name || 'สินค้า'} ${item.variety ? `(${item.variety})` : ''}</b><small>ราคาเรา ฿${Number(item.myPrice || 0)} • ตลาด ฿${Number(item.marketPrice || 0)}</small></span><em class="${Number(item.diffPercent)>=0?'up':'down'}">${item.diffText || 'เท่าตลาด'}</em></div>`, 'ยังไม่มีราคาที่เปรียบเทียบได้');
    document.querySelector('main').setAttribute('aria-busy','false');
  }

  async function load(period) {
    currentPeriod = period; document.querySelector('main').setAttribute('aria-busy','true');
    text('periodLabel', period === 'today' ? 'ภาพรวมวันนี้' : period === 'week' ? 'ภาพรวม 7 วันล่าสุด' : 'ภาพรวม 30 วันล่าสุด');
    if (await getTier() !== 'pro') { $('proLockedOverlay').hidden = false; return; }
    try { const response = await fetchStats(period); render(response?.data || response || {}); }
    catch (error) { window.appNotify?.(error.message || 'โหลดแดชบอร์ดไม่สำเร็จ','error'); document.querySelector('main').setAttribute('aria-busy','false'); }
  }

  document.addEventListener('click', event => { const target = event.target.closest('[data-go]'); if (target && routes[target.dataset.go]) location.href = routes[target.dataset.go]; });
  document.addEventListener('DOMContentLoaded', () => {
    $('backBtn').onclick = () => location.href='../../account/account.html';
    $('goUpgradeBtn').onclick = () => location.href='../../account/subscription.html'; $('lockBackBtn').onclick = () => history.back();
    document.querySelectorAll('.period-tab').forEach(tab => tab.onclick=()=>{document.querySelectorAll('.period-tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');load(tab.dataset.period);});
    try { const user=JSON.parse(localStorage.getItem('user_data')||'{}'); if(user.first_name) text('welcomeMsg',`สวัสดี ${user.first_name} • ภาพรวมกิจการของคุณ`); } catch {}
    load(currentPeriod);
  });
})();
