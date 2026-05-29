const { JSDOM } = require("jsdom");
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'frontend/pages/shared/search-results.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const dom = new JSDOM(html, {
  url: "http://127.0.0.1:5500/frontend/pages/shared/search-results.html?q=%E0%B8%97%E0%B8%B8%E0%B9%80%E0%B8%A3%E0%B8%B5%E0%B8%A2%E0%B8%99",
  runScripts: "dangerously",
  resources: "usable",
  beforeParse(window) {
    window.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
    window.sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  }
});

dom.window.console.log = (...args) => console.log('PAGE LOG:', ...args);
dom.window.console.error = (...args) => console.error('PAGE ERROR:', ...args);
dom.window.addEventListener('error', (event) => {
  console.error('JS ERROR:', event.error);
});

setTimeout(() => {
  const mount = dom.window.document.getElementById('searchResultsMount');
  console.log("HTML:", mount ? mount.innerHTML : "NULL");
  process.exit(0);
}, 3000);
