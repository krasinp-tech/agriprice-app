(function () {
  const newsList = document.getElementById("newsList");
  const DEBUG_NEWS = !!window.AGRIPRICE_DEBUG;
  
  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function currentLocale() {
    const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
    if (lang === 'en') return 'en-US';
    if (lang === 'zh') return 'zh-CN';
    return 'th-TH';
  }

  async function loadAnnouncements() {
    if (!newsList) return;

    try {
      if (!window.api) {
          // If api-client not yet loaded/initialized, wait a bit
          await new Promise(r => setTimeout(r, 100));
      }

      // Use window.api.call if a specific method doesn't exist
      // In our case, announcements might not have a helper in window.api yet
      // but we can use window.api.call('GET', '/api/announcements')
      // Let's check if we should add it to window.api or just call it directly.
      
      let data;
      if (window.api && typeof window.api.call === 'function') {
          const res = await window.api.call('GET', '/api/announcements?limit=50');
          data = res.data || res || [];
      } else {
          // Fallback if window.api is totally missing
          const base = (window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : '').replace(/\/$/, '');
          const res = await fetch(base + '/api/announcements?limit=50');
          const json = await res.json();
          data = json.data || json || [];
      }

      renderNews(data);
    } catch (err) {
      if (DEBUG_NEWS) console.error("[Announcements] Load error:", err);
      renderEmpty();
    }
  }

  function renderNews(list) {
    if (!newsList) return;
    if (!list || !list.length) {
      renderEmpty();
      return;
    }

    newsList.innerHTML = list.map(item => {
      const date = item.published_at ? new Date(item.published_at).toLocaleDateString(currentLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }) : t('no_date', 'ไม่ระบุวันที่');

      const source = item.source ? t(item.source, item.source) : t('news', 'ข่าวประชาสัมพันธ์');
      const link = (item.link || '#').replace(/^http:/, 'https:');

      return `
        <a href="${link}" class="news-card" target="_blank" rel="noopener noreferrer">
          <div class="news-header">
            <span class="news-tag">${source}</span>
            <span class="material-icons-outlined news-icon">open_in_new</span>
          </div>
          <div class="news-content">
            <h3>${item.title || t('no_title', 'ไม่มีหัวข้อ')}</h3>
            <p>${item.description || item.desc || ''}</p>
          </div>
          <div class="news-footer">
            <span>${date}</span>
            <span class="read-more">
              ${t('read_details', 'อ่านรายละเอียด')}
              <span class="material-icons-outlined" style="font-size: 14px">chevron_right</span>
            </span>
          </div>
        </a>
      `;
    }).join("");
  }

  function renderEmpty() {
    if (!newsList) return;
    newsList.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-outlined">newspaper</span>
        <p>${t('no_announcements', 'ไม่มีข่าวสารประชาสัมพันธ์ในขณะนี้')}</p>
      </div>
    `;
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", loadAnnouncements);
  // Also call it immediately in case DOMContentLoaded already fired
  if (document.readyState === "complete" || document.readyState === "interactive") {
    loadAnnouncements();
  }
})();
