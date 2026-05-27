const fs = require('fs');
const puppeteer = require('puppeteer-core');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const pages = [
  '/pages/shared/profile.html',
  '/pages/buyer/setbooking/booking.html',
  '/pages/shared/notifications.html'
];

async function checkPage(page, url) {
  const result = { url, ok: false, errors: [], bottomNav: false, profileShell: false };
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Check bottom nav mount
    try {
      await page.waitForSelector('#bottomNavMount', { timeout: 8000 });
      // If nav content is loaded, look for inner nav
      const hasNav = await page.$eval('#bottomNavMount', (el) => !!el.querySelector('#bottomNav'))
        .catch(() => false);
      result.bottomNav = Boolean(hasNav);
    } catch (e) {
      result.errors.push('bottomNavMount-missing');
    }

    // Check profile shell mount
    try {
      const hasProfileMount = await page.$('#profileShellMount');
      result.profileShell = Boolean(hasProfileMount);
    } catch (e) {
      // ignore
    }

    result.ok = true;
  } catch (err) {
    result.errors.push(String(err));
  }
  return result;
}

(async () => {
  // Try to find a local Chrome/Edge executable
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  let exe = null;
  for (const c of candidates) {
    if (c && fs.existsSync(c)) { exe = c; break; }
  }
  if (!exe) {
    console.error('No local Chrome/Edge found. Set CHROME_PATH env or install Chrome/Edge.');
    process.exit(3);
  }

  const browser = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  page.on('console', msg => {
    try { console.log('PAGE_CONSOLE:', msg.text()); } catch(e){}
  });
  page.on('pageerror', err => {
    try { console.log('PAGE_ERROR:', err.toString()); } catch(e){}
  });
  const reports = [];

  // Inject a fake logged-in user so protected bottom-nav/pages don't redirect to login
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('token', 'fake-token-123');
      localStorage.setItem('user_data', JSON.stringify({ role: 'buyer', fullName: 'Headless Tester' }));
      localStorage.setItem('role', 'buyer');
      // Stub AuthGuard early to avoid redirect and API checks
      window.AuthGuard = window.AuthGuard || {};
      window.AuthGuard.isLoggedIn = () => true;
      window.AuthGuard.requireLogin = () => {};
      // Mark page as headless so guarded inline calls skip redirect
      window.__HEADLESS = true;
      // Prevent client-side navigation during checks
      try {
        history.pushState = function(){};
        history.replaceState = function(){};
        window.location.assign = function(){};
        window.location.replace = function(){};
      } catch (e) {}
    } catch (e) {}
  });

  for (const p of pages) {
    const url = BASE.replace(/\/$/, '') + p;
    const r = await checkPage(page, url);
    // Additional debug: print innerHTML of bottomNavMount when present
    try {
      await page.waitForTimeout(1500);
      const mountHtml = await page.evaluate(() => {
        const m = document.getElementById('bottomNavMount');
        return m ? m.innerHTML.trim().slice(0, 200) : null;
      });
      if (mountHtml) console.log('MOUNT_PREVIEW:', mountHtml);
    } catch (e) {}
    console.log(JSON.stringify(r));
    reports.push(r);
  }

  await browser.close();
  const summary = { timestamp: new Date().toISOString(), base: BASE, reports };
  console.log('SUMMARY: ' + JSON.stringify(summary, null, 2));
  // exit with code 0 if every page had bottomNavMount (not necessarily profileShell)
  const okAll = reports.every(r => r.bottomNav);
  process.exit(okAll ? 0 : 2);
})();
