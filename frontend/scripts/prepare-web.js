const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'www');

const includeList = [
  '.htaccess',
  'index.html',
  'gov-price-lookup.html',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'assets',
  'components',
  'css',
  'js',
  'pages',
];

function cleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    return;
  }
  for (const name of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, name);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  cleanDir(outDir);

  for (const rel of includeList) {
    const src = path.join(root, rel);
    const dest = path.join(outDir, rel);
    if (!fs.existsSync(src)) {
      continue;
    }
    copyRecursive(src, dest);
  }

  console.log('[prepare-web] Built web assets in', outDir);
}

main();
