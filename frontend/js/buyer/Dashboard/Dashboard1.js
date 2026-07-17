(function () {
  'use strict';
  const api = window.api || {};
  const t = (key, fallback, params) => window.i18nT ? window.i18nT(key, fallback, params) : fallback;
  const locale = () => ({ en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[localStorage.getItem('lang')] || 'th-TH');
  let currentPeriod = 'today';
  const $ = id => document.getElementById(id);
  const count = value => Number(value || 0).toLocaleString(locale());
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
    if (!number) return t('same_as_previous_period', 'เท่ากับช่วงก่อน');
    return `${number > 0 ? '↑' : '↓'} ${Math.abs(number)}${suffix} ${t('from_previous_period', 'จากช่วงก่อน')}`;
  }

  function renderChart(chart = {}) {
    const mount = $('trendChart'); if (!mount) return;
    const labels = chart.labels || [], bookings = chart.bookings || [], views = chart.impressions || [];
    if (!labels.length || (!bookings.some(Boolean) && !views.some(Boolean))) { mount.innerHTML = `<div class="empty-state"><span class="material-icons-outlined">show_chart</span><p>${t('no_trend_data', 'ยังไม่มีข้อมูลแนวโน้มในช่วงนี้')}</p></div>`; return; }
    const width = 640, height = 190, padX = 24, padY = 22;
    const max = Math.max(1, ...bookings, ...views);
    const points = values => values.map((value, index) => `${padX + (labels.length === 1 ? (width - padX * 2) / 2 : index * (width - padX * 2) / (labels.length - 1))},${height - padY - (value / max) * (height - padY * 2)}`).join(' ');
    const labelEvery = labels.length > 10 ? Math.ceil(labels.length / 6) : 1;
    mount.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${t('trend_chart', 'กราฟแนวโน้ม')}"><defs><linearGradient id="viewFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59e0b" stop-opacity=".22"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></linearGradient></defs><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" class="axis"/><polyline points="${points(views)}" class="line views"/><polyline points="${points(bookings)}" class="line bookings"/>${labels.map((label,i)=>i%labelEvery===0?`<text x="${padX+(labels.length===1?(width-padX*2)/2:i*(width-padX*2)/(labels.length-1))}" y="${height-4}" text-anchor="middle">${label}</text>`:'').join('')}</svg>`;
  }

  function renderRecommendations(items = []) {
    const mount = $('recommendationList'); if (!mount) return;
    mount.innerHTML = items.map(rawItem => {
      const item = { ...rawItem };
      const number = String(item.title || '').match(/\d+/)?.[0] || '0';
      if (item.icon === 'pending_actions') {
        item.title = t('rec_pending_title', `มี ${number} รายการรอดำเนินการ`, { count: number });
        item.detail = t('rec_pending_detail', 'ตรวจสอบและจัดการการจองเพื่อไม่ให้ลูกค้ารอนาน');
      } else if (item.icon === 'visibility') {
        item.title = t('rec_views_no_booking_title', 'มีคนเห็นประกาศแต่ยังไม่มีการจอง');
        item.detail = t('rec_views_no_booking_detail', 'ลองปรับรูป ราคา หรือรายละเอียดให้ชัดเจนขึ้น');
      } else if (item.icon === 'report_problem') {
        item.title = t('rec_high_cancel_title', 'ยอดยกเลิกสูงกว่ายอดสำเร็จ');
        item.detail = t('rec_high_cancel_detail', 'ตรวจเหตุผลการยกเลิกและปรับช่วงเวลารับสินค้า');
      } else if (item.icon === 'task_alt') {
        item.title = t('rec_all_good_title', 'สถานะโดยรวมเรียบร้อย');
        item.detail = t('rec_all_good_detail', 'ยังไม่มีรายการเร่งด่วนที่ต้องจัดการในช่วงนี้');
      } else if (item.icon === 'trending_up') {
        const product = String(item.title || '').replace(/\s*ทำผลงานดีที่สุด\s*$/, '') || t('product', 'สินค้า');
        const bookings = String(item.detail || '').match(/\d+/)?.[0] || '0';
        item.title = t('rec_best_product_title', `${product} ทำผลงานดีที่สุด`, { product, count: bookings });
        item.detail = t('rec_best_product_detail', `ได้รับการจอง ${bookings} ครั้งในช่วงที่เลือก`, { product, count: bookings });
      }
      return `<button class="recommendation ${item.tone || ''}" ${item.action ? `data-go="${item.action}"` : ''}><span class="material-icons-outlined">${item.icon || 'tips_and_updates'}</span><span><b>${item.title}</b><small>${item.detail}</small></span>${item.action ? '<span class="material-icons-outlined arrow">chevron_right</span>' : ''}</button>`;
    }).join('');
  }

  function renderList(id, items, renderer, emptyText) {
    const mount = $(id); if (!mount) return;
    mount.innerHTML = items?.length ? items.map(renderer).join('') : `<div class="empty-inline">${emptyText}</div>`;
  }

  function priceDifferenceText(item) {
    const value = Number(item.diffPercent || 0);
    if (value > 0) return t('above_market', `สูงกว่าตลาด +${value}%`, { percent: value });
    if (value < 0) return t('below_market', `ต่ำกว่าตลาด ${value}%`, { percent: value });
    return t('same_as_market', 'เท่าตลาด');
  }

  function render(stats) {
    const summary = stats.bookingSummary || {}, total = Number(summary.total || 0), success = Number(summary.success || 0), waiting = Number(summary.waiting || 0), cancel = Number(summary.cancel || 0);
    const pct = value => total ? Math.round(value / total * 100) : 0;
    text('bookingsVal', count(stats.totalBookings)); text('successRateVal', `${Number(stats.successRate || 0)}%`); text('viewsVal', count(stats.totalViews)); text('followersVal', count(stats.totalFollowers));
    text('bookingsTrend', trendLabel(stats.trends?.totalBookings)); text('successRateTrend', trendLabel(stats.trends?.successRate, ' จุด')); text('viewsTrend', trendLabel(stats.trends?.totalViews)); text('followersTrend', trendLabel(stats.trends?.newFollowers));
    text('centerValue', count(total)); text('completedVal', count(success)); text('waitingVal', count(waiting)); text('cancelVal', count(cancel));
    [['completed',success],['waiting',waiting],['cancel',cancel]].forEach(([key,value])=>{ text(`${key}PercentVal`, `${pct(value)}%`); $(`${key}Fill`).style.width=`${pct(value)}%`; });
    text('peakTimeVal', stats.peakBookingTime || '—'); text('mostBookedVal', stats.mostBooked ? `${stats.mostBooked.name} (${count(stats.mostBooked.count)})` : '—'); text('dailyAvgVal', `${Number(stats.dailyAverage || 0).toLocaleString(locale())} ${t('items_suffix', 'รายการ')}`); text('newFollowersVal', `${count(stats.newFollowers)} ${t('people_suffix', 'คน')}`);
    text('conversionRate', `${Number(stats.funnel?.conversionRate || 0)}%`); text('funnelViews', count(stats.funnel?.impressions)); text('funnelBookings', count(stats.funnel?.bookings)); text('funnelSuccess', count(stats.funnel?.success));
    text('competitorsHeaderTitle', `${t('competitors_in', 'คู่แข่งใน')}${stats.province && stats.province !== '-' ? stats.province : t('area', 'พื้นที่')}`); text('competitorTotalVal', `${count(stats.competitorsCount)} ${t('items_suffix', 'รายการ')}`);
    text('updatedAt', `${t('updated', 'อัปเดต')} ${new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit'}).format(new Date(stats.updatedAt || Date.now()))}`);
    renderChart(stats.trendChart); renderRecommendations(stats.recommendations);
    renderList('competitorList', stats.categoryCompetitors, item => `<div><span>${t('buying_label', 'รับซื้อ')}${t(item.category, item.category || t('product', 'สินค้า'))}</span><b>${count(item.count)} ${t('items_suffix', 'รายการ')}</b></div>`, t('no_competitor_data', 'ยังไม่มีข้อมูลคู่แข่งในพื้นที่'));
    renderList('priceCompareList', stats.priceComparison, item => `<div class="price-item"><span><b>${t(item.name, item.name || t('product', 'สินค้า'))} ${item.variety ? `(${t(item.variety, item.variety)})` : ''}</b><small>${t('my_price', 'ราคาเรา')} ฿${Number(item.myPrice || 0)} • ${t('market', 'ตลาด')} ฿${Number(item.marketPrice || 0)}</small></span><em class="${Number(item.diffPercent)>=0?'up':'down'}">${priceDifferenceText(item)}</em></div>`, t('no_price_comparison', 'ยังไม่มีราคาที่เปรียบเทียบได้'));
    document.querySelector('main').setAttribute('aria-busy','false');
  }

  async function load(period) {
    currentPeriod = period; document.querySelector('main').setAttribute('aria-busy','true');
    text('periodLabel', period === 'today' ? t('overview_today', 'ภาพรวมวันนี้') : period === 'week' ? t('overview_last_7_days', 'ภาพรวม 7 วันล่าสุด') : t('overview_last_30_days', 'ภาพรวม 30 วันล่าสุด'));
    if (await getTier() !== 'pro') { $('proLockedOverlay').hidden = false; return; }
    try { const response = await fetchStats(period); render(response?.data || response || {}); }
    catch (error) { window.appNotify?.(error.message || t('dashboard_load_failed', 'โหลดแดชบอร์ดไม่สำเร็จ'),'error'); document.querySelector('main').setAttribute('aria-busy','false'); }
  }

  document.addEventListener('click', event => { const target = event.target.closest('[data-go]'); if (target && routes[target.dataset.go]) location.href = routes[target.dataset.go]; });
  document.addEventListener('DOMContentLoaded', () => {
    $('backBtn').onclick = () => location.href='../../account/account.html';
    $('goUpgradeBtn').onclick = () => location.href='../../account/subscription.html'; $('lockBackBtn').onclick = () => history.back();
    document.querySelectorAll('.period-tab').forEach(tab => tab.onclick=()=>{document.querySelectorAll('.period-tab').forEach(x=>x.classList.remove('active'));tab.classList.add('active');load(tab.dataset.period);});
    try { const user=JSON.parse(localStorage.getItem('user_data')||'{}'); if(user.first_name) text('welcomeMsg',`${t('hello', 'สวัสดี')} ${user.first_name} • ${t('business_overview', 'ภาพรวมกิจการของคุณ')}`); } catch {}
    load(currentPeriod);
  });
})();
