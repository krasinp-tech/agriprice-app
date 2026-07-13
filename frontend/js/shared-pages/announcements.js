(function() {
  "use strict";

  const api = window.api || {};

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : (fallback || key);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeLink(value) {
    const raw = String(value || '').trim();
    if (!raw) return '#';
    try {
      const url = new URL(raw);
      return /^https?:$/i.test(url.protocol) ? url.href : '#';
    } catch (_) {
      return '#';
    }
  }

  async function loadAnnouncements() {
    const container = document.getElementById('newsList');
    if (!container) return;

    try {
      let res;
      if (api.call) {
        res = await api.call('GET', '/api/announcements?limit=50');
      } else {
        const currentBase = window.getAgriPriceApiUrl
          ? window.getAgriPriceApiUrl()
          : (window.API_BASE_URL || '').replace(/\/$/, '');
        const response = await fetch(currentBase + '/api/announcements?limit=50');
        res = await response.json();
      }

      if (res && res.success) {
        renderAnnouncements(res.data, container);
      } else {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);"><p>${escapeHtml(t('no_announcements', 'No announcements'))}</p></div>`;
      }
    } catch (err) {
      console.error('[Announcements] Load failed:', err);
      container.innerHTML = `<div style="text-align:center;padding:40px;color:red;"><p>${escapeHtml(t('error_loading', 'Error loading data'))}</p></div>`;
    }
  }

  function renderAnnouncements(items, container) {
    if (!items || items.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <span class="material-icons-outlined">campaign</span>
        <h3 data-i18n="no_announcements">${escapeHtml(t('no_announcements', 'No announcements'))}</h3>
      </div>`;
      return;
    }

    const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
    const locale = lang === 'en' ? 'en-US' : (lang === 'zh' ? 'zh-CN' : 'th-TH');

    container.innerHTML = items.map((item) => {
      const source = t(item.source, item.source || 'news');
      let dateStr = '';
      if (item.published_at) {
        try {
          dateStr = new Date(item.published_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (_) {
          dateStr = item.published_at;
        }
      }

      return `
        <a class="news-card" href="${escapeHtml(safeLink(item.link))}" target="_blank" rel="noopener noreferrer">
          <div class="news-header">
            <span class="news-tag">${escapeHtml(source)}</span>
            <span class="material-icons-outlined news-icon">open_in_new</span>
          </div>
          <div class="news-content">
            <h3>${escapeHtml(item.title || '')}</h3>
            <p>${escapeHtml(item.content || '')}</p>
          </div>
          <div class="news-footer">
            <span>${escapeHtml(dateStr)}</span>
            <span class="read-more">${escapeHtml(t('read_more', 'Read more'))}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadAnnouncements();

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
