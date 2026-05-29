#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

async function main() {
  const executablePath = await findChromeExecutable();
  if (!executablePath) {
    throw new Error('ไม่พบ Chrome/Edge ในเครื่องนี้ ตั้งค่า CHROME_PATH หรือ ติดตั้งเบราว์เซอร์ก่อน');
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  const output = {
    source: 'https://pricelist.dit.go.th/main_price.php',
    scanned_at: new Date().toISOString(),
    categories: [],
  };

  try {
    await page.goto('https://pricelist.dit.go.th/main_price.php', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.select('#protype', '2');
    await sleep(800);

    const categories = await page.evaluate(() => {
      return [...document.querySelectorAll('#progroup option')]
        .map((option) => ({ text: option.textContent.trim(), value: option.value }))
        .filter((option) => option.value && option.value !== '0');
    });

    for (const category of categories) {
      await page.select('#progroup', category.value);
      await sleep(900);

      const products = await page.evaluate(() => {
        return [...document.querySelectorAll('#proname option')]
          .map((option) => ({ text: option.textContent.trim(), value: option.value }))
          .filter((option) => option.value && option.value !== '0');
      });

      output.categories.push({
        groupId: category.value,
        label: category.text,
        productCount: products.length,
        products,
      });
    }
  } finally {
    await browser.close();
  }

  const exportsDir = path.join(__dirname, '..', 'exports');
  fs.mkdirSync(exportsDir, { recursive: true });

  const filePath = path.join(exportsDir, 'dit-catalog.json');
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Saved DIT catalog to ${filePath}`);
  console.log(`Scanned ${output.categories.length} categories`);
}

main().catch((error) => {
  console.error('[scanDitCatalog] Failed:', error.message);
  process.exit(1);
});