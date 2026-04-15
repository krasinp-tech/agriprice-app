// Simple i18n system for HTML/JS
const LANGUAGES = ['th', 'en', 'zh'];
const LANGUAGE_LABELS = {
  th: 'ไทย',
  en: 'English',
  zh: '中文',
};
const TRANSLATIONS = {
  th: {
    language_title: 'ภาษา',
    under_dev: 'หน้านี้กำลังพัฒนา',
    sorry: 'ขออภัยในความไม่สะดวก',
    select_language: 'เลือกภาษา',
    thai: 'ไทย',
    english: 'อังกฤษ',
    chinese: 'จีน',
  },
  en: {
    language_title: 'Language',
    under_dev: 'This page is under development',
    sorry: 'Sorry for the inconvenience',
    select_language: 'Select Language',
    thai: 'Thai',
    english: 'English',
    chinese: 'Chinese',
  },
  zh: {
    language_title: '语言',
    under_dev: '此页面正在开发中',
    sorry: '抱歉给您带来不便',
    select_language: '选择语言',
    thai: '泰语',
    english: '英语',
    chinese: '中文',
  }
};

function getCurrentLang() {
  return localStorage.getItem('lang') || 'th';
}

function setCurrentLang(lang) {
  localStorage.setItem('lang', lang);
}

function translatePage() {
  const lang = getCurrentLang();
  const t = TRANSLATIONS[lang] || TRANSLATIONS.th;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });
}

function setupLanguageSelector() {
  const selector = document.getElementById('langSelector');
  if (!selector) return;
  selector.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'lang-selector-wrap';
  const current = getCurrentLang();
  LANGUAGES.forEach(lang => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn' + (current === lang ? ' active' : '');
    btn.textContent = LANGUAGE_LABELS[lang] || lang.toUpperCase();
    btn.onclick = () => {
      setCurrentLang(lang);
      translatePage();
      setupLanguageSelector(); // update active state
    };
    wrap.appendChild(btn);
  });
  selector.appendChild(wrap);
}

window.i18nInit = function() {
  setupLanguageSelector();
  translatePage();
};

// For other pages: call window.i18nInit() after DOM loaded
