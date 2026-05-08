const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });
  
  console.log("Navigating...");
  await page.goto('http://127.0.0.1:5500/frontend/pages/shared/search-results.html?q=%E0%B8%97%E0%B8%B8%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%99', { waitUntil: 'networkidle0' });
  
  console.log("Evaluating...");
  const results = await page.evaluate(() => {
    return document.getElementById('searchResultsMount')?.innerHTML;
  });
  console.log('Results HTML length:', results ? results.length : 'NULL');
  
  await browser.close();
})();
