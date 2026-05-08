// Global i18n system for all pages
const LANGUAGES = ['th', 'en', 'zh'];
const TRANSLATIONS = {
    device_title: 'จัดการอุปกรณ์',
    device_list_title: 'อุปกรณ์ที่ล็อคอินอยู่',
    remove_device_title: 'ยืนยันการนำอุปกรณ์ออก',
    remove_device_desc: 'กรุณาใส่รหัสผ่านเพื่อยืนยัน',
    remove_device_btn: 'นำออก',
  },
  en: {
    language_title: 'Language',
    account_title: 'Account Management',
    under_dev: 'This page is under development',
    sorry: 'Sorry for the inconvenience',
    select_language: 'Select Language',
    thai: 'Thai',
    english: 'English',
    chinese: 'Chinese',
  },
  zh: {
    language_title: '语言',
    account_title: '账户管理',
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

function setupLanguageSelector(selectorId) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;
  selector.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'lang-selector-wrap';
  const current = getCurrentLang();
  LANGUAGES.forEach(lang => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn' + (current === lang ? ' active' : '');
    btn.textContent = TRANSLATIONS[lang][lang];
    btn.onclick = () => {
      setCurrentLang(lang);
      translatePage();
      setupLanguageSelector(selectorId); // update active state
    };
    wrap.appendChild(btn);
  });
  selector.appendChild(wrap);
}

window.i18nInit = function(selectorId = 'langSelector') {
  setupLanguageSelector(selectorId);
  translatePage();
};
