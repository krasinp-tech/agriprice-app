(function() {
  "use strict";

  const api = window.api || {};

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  async function loadAnnouncements() {
    const container = document.getElementById('newsList');
    if (!container) return;

    try {
      let res;
      if (api.call) {
        res = await api.call('GET', '/api/announcements?limit=50');
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const response = await fetch(currentBase + '/api/announcements?limit=50');
        res = await response.json();
      }

      if (res && res.success) {
        renderAnnouncements(res.data, container);
      } else {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);"><p>${t('no_announcements', 'ไม่พบข่าวสารประชาสัมพันธ์')}</p></div>`;
      }
    } catch (err) {
      console.error('[Announcements] Load failed:', err);
      container.innerHTML = `<div style="text-align:center;padding:40px;color:red;"><p>${t('error_loading', 'เกิดข้อผิดพลาดในการโหลดข้อมูล')}</p></div>`;
    }
  }

  function renderAnnouncements(items, container) {
    if (!items || items.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <span class="material-icons-outlined">campaign</span>
        <h3 data-i18n="no_announcements">${t('no_announcements', 'ไม่มีข่าวสารและประกาศ')}</h3>
      </div>`;
      return;
    }

    const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
    const locale = lang === 'en' ? 'en-US' : (lang === 'zh' ? 'zh-CN' : 'th-TH');

    container.innerHTML = items.map(item => {
      const source = t(item.source, item.source || 'news');
      let dateStr = '';
      if (item.published_at) {
        try {
          dateStr = new Date(item.published_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        } catch(e) {
          dateStr = item.published_at;
        }
      }
      return `
        <a class="news-card" href="${(item.link || '#').replace(/^http:/, 'https:')}" target="_blank" rel="noopener noreferrer">
          <div class="news-header">
            <span class="news-tag">${source}</span>
            <span class="material-icons-outlined news-icon">open_in_new</span>
          </div>
          <div class="news-content">
            <h3>${item.title || ''}</h3>
            <p>${item.content || ''}</p>
          </div>
          <div class="news-footer">
            <span>${dateStr}</span>
            <span class="read-more">${t('read_more', 'อ่านต่อ')}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();

    // Wire back button
    const backBtn = document.querySelector('.btn-back, [data-back]');
    if (backBtn) {
      backBtn.onclick = (e) => {
        e.preventDefault();
        if (document.referrer && document.referrer.includes(window.location.host)) {
          window.history.back();
        } else {
          window.location.href = '../../index.html';
        }
      };
    }
  });
})();
