const fs = require('fs');

const mockJson = {
  "success": true,
  "message": "ผลการค้นหา",
  "data": {
    "products": [
      {
        "product_id": 42,
        "user_id": "c0bcb1bd-2596-4c67-a4cb-f805f7da8028",
        "name": "ทุเรียน",
        "variety": "กระดุม",
        "category": "ทุเรียน",
        "unit": "กก.",
        "image": null,
        "is_active": true,
        "profiles": {
          "avatar": "/assets/images/avatar-buyer.svg",
          "last_name": "",
          "first_name": "ล้งสุมาพร"
        },
        "product_grades": [
          { "grade": "A", "price": 140 }
        ]
      }
    ],
    "users": []
  }
};

window = {
  LocationHelper: {
    calculateDistance: () => 5,
    formatDistance: () => '5 กม.'
  },
  AgriPriceUI: {
    formatTimeAgo: () => '1 ชม. ที่แล้ว'
  }
};

const userLat = 13.0;
const userLng = 100.0;
const prefixRoot = "../../";
function resolveToRootUrl(p) {
  if (!p) return "";
  if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
  return prefixRoot + String(p).replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
}

try {
  const products = mockJson.data.products || [];
  const mappedProducts = products.map(p => {
    const gradesArr = Array.isArray(p.product_grades) ? p.product_grades : [];
    let priceA = null;
    if (gradesArr.length > 0) {
      const ga = gradesArr.find(g => (g.grade || '').toUpperCase() === 'A');
      priceA = ga ? ga.price : gradesArr[0].price;
    } else {
      priceA = p.price;
    }

    // Distance calculation
    const sLat = p.profiles?.lat ?? p.lat ?? null;
    const sLng = p.profiles?.lng ?? p.lng ?? null;
    const distKm = (userLat !== null && sLat !== null && sLng !== null)
      ? window.LocationHelper.calculateDistance(userLat, userLng, sLat, sLng)
      : null;

    return {
      type: 'product',
      sellerId: p.user_id,
      sellerName: p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}`.trim() : 'ไม่ทราบชื่อ',
      sellerSub: p.variety ? `${p.name} (${p.variety})` : p.name,
      avatar: p.profiles?.avatar
        ? (p.profiles.avatar.startsWith('http') ? p.profiles.avatar : resolveToRootUrl(`assets/images/${p.profiles.avatar}`))
        : resolveToRootUrl('assets/images/avatar-guest.svg'),
      priceA,
      variety: p.variety || '',
      productName: p.name || '',
      updateTime: window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(p.created_at) : p.created_at,
      updatedMinutesAgo: p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000) : 0,
      _productId: p.product_id,
      _distKm: distKm,
      distanceText: window.LocationHelper.formatDistance(distKm)
    };
  });
  console.log("SUCCESS:", mappedProducts);
} catch (e) {
  console.error("ERROR:", e);
}
