const fs = require('fs');
const path = require('path');

const HOME_GROUP_IDS = new Set(['R11000', 'R12000', 'W13000', 'W14000', 'W18000']);

function loadCatalog() {
  const filePath = path.join(__dirname, '..', 'exports', 'dit-catalog.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('[ditCatalog] Failed to read catalog:', error.message);
    return null;
  }
}

function buildHomeCommodityList() {
  const catalog = loadCatalog();
  if (!catalog || !Array.isArray(catalog.categories)) return [];

  const list = [];
  for (const category of catalog.categories) {
    if (!HOME_GROUP_IDS.has(category.groupId)) continue;
    for (const product of category.products || []) {
      if (!product?.value || !product?.text) continue;
      list.push({
        key: String(product.value).toLowerCase(),
        label: product.text,
        category: category.groupId === 'R11000' || category.groupId === 'R12000'
          ? 'rice'
          : category.groupId === 'W13000'
            ? 'vegetable'
            : category.groupId === 'W14000'
              ? 'fruit'
              : category.groupId === 'W18000'
                ? 'oil'
                : category.groupId === 'W15000'
                  ? 'seedlings'
                : 'all',
        ditGroupId: category.groupId,
        ditProductId: product.value,
        type: 2,
        homeGroupLabel: category.label,
      });
    }
  }

  return list;
}

function getCommodityLabelMap() {
  const map = new Map();
  for (const commodity of buildHomeCommodityList()) {
    if (!map.has(commodity.key)) map.set(commodity.key, commodity.label);
  }
  return map;
}

function getLabelForCommodity(key) {
  return getCommodityLabelMap().get(String(key || '').trim()) || '';
}

module.exports = {
  loadCatalog,
  buildHomeCommodityList,
  getCommodityLabelMap,
  getLabelForCommodity,
};