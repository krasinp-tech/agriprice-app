# ความเข้าใจการทำงานของ Component PriceGovernment

## ไฟล์ที่เกี่ยวข้อง

```
components/pricegovernment/
├── government-price.html          ← แสดง Carousel ของไอค่อนผลไม้
├── government-price.js            ← จัดการ Drag/Scroll + Click handlers
├── government-price.css           ← Styling สำหรับ Carousel
│
├── government-price-card.html     ← หน้าแสดงรายละเอียดราคา (separate page)
├── government-price-card.js       ← โหลด query parameter และแสดงข้อมูล
├── government-price-card.css      ← Styling สำหรับหน้าการ์ด
│
├── mock-prices.js                 ← ข้อมูลราคาจำลอง (แทน API/Database)
└── demo.html                      ← ไฟล์ demo สำหรับทดสอบ
```

---

## ขั้นตอนการทำงาน

### 1️⃣ **หน้าแรก: Carousel Fruits** (government-price.html)

```html
<!-- แสดงรูปผลไม้ เรียงกันในแถว -->
<div class="government-item">
  <img src="assets/images/ทุเรียน.png">
  <span>ทุเรียน</span>
</div>
```

### 2️⃣ **จัดการ Carousel + Click** (government-price.js)

```javascript
// ทำให้ drag/scroll ได้
track.addEventListener("pointermove", (e) => {
  track.scrollLeft = startLeft - dx;
});

// ✅ เมื่อคลิกที่ไอค่อน ผลไม้
items.forEach((item) => {
  item.addEventListener("click", function(e) {
    if (moved) return; // ข้าม ถ้าเป็นการลาก
    
    const name = getCommodityName(item); // ได้ "ทุเรียน"
    setActiveItem(item);
    
    // 🔗 Navigate ไปยังหน้าการ์ด
    openGovCard(name);
  });
});

function openGovCard(commodityName) {
  const url = `government-price-card.html?commodity=${encodeURIComponent(commodityName)}`;
  window.location.href = url; // ← นำไปหน้าใหม่
}
```

### 3️⃣ **หน้าการ์ด: แสดงราคา** (government-price-card.html)

```html
<!-- หน้าแยกสำหรับแสดงรายละเอียด -->
<!doctype html>
<html>
<body>
  <h1 id="commodityTag">ทุเรียน</h1>
  <table id="tableWrap">
    <!-- ตารางราคา -->
  </table>
  
  <script src="./mock-prices.js"></script>  <!-- โหลดข้อมูล -->
  <script src="./government-price-card.js"></script> <!-- อ่าน query + render -->
</body>
</html>
```

### 4️⃣ **อ่าน Query Parameter + แสดงข้อมูล** (government-price-card.js)

```javascript
function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// อ่าน URL: government-price-card.html?commodity=ทุเรียน
const commodity = getQuery("commodity") || "ทุเรียน";

// โหลดข้อมูลจาก mock-prices.js
const db = window.__GOV_MOCK_DB__; // ← ได้ object ข้อมูลราคา
const data = db[commodity];  // ← ได้ { unit, rows: [...] }

renderTable(data); // ← แสดงตารางราคา
```

### 5️⃣ **ข้อมูลราคาจำลอง** (mock-prices.js)

```javascript
window.__GOV_MOCK_DB__ = {
  "ทุเรียน": {
    date: "2024-03-04",
    unit: "กก.",
    rows: [
      { variety: "หมอนทอง", min: 150, max: 190, avg: 170 },
      { variety: "ชะนี", min: 120, max: 160, avg: 140 },
    ]
  },
  "ลองกอง": { ... },
  "มังคุด": { ... },
  // ... เพิ่มผลไม้อื่นๆ
};
```

---

## 🔄 ลำดับการไหลของข้อมูล

```
[User clicks fruit icon]
        ↓
[government-price.js: getCommodityName()]
        ↓
[openGovCard("ทุเรียน")]
        ↓
[Navigate to: government-price-card.html?commodity=ทุเรียน] 🔗
        ↓
[government-price-card.js: getQuery("commodity")] ← ได้ "ทุเรียน"
        ↓
[mock-prices.js loads globally] ← window.__GOV_MOCK_DB__.ทุเรียน
        ↓
[renderTable(data)] ← แสดงตาราง
```

---

## ⚙️ การปรับแต่ง

### เพิ่มผลไม้ใหม่

1. **แก้ government-price.html เพิ่มไอค่อน**:
   ```html
   <div class="government-item">
     <img src="assets/images/YOUR_FRUIT.png" alt="ผลไม้ใหม่">
     <span>ผลไม้ใหม่</span>
   </div>
   ```

2. **แก้ mock-prices.js เพิ่มข้อมูลราคา**:
   ```javascript
   "ผลไม้ใหม่": {
     date: fmt(today),
     unit: "กก.",
     rows: [
       { variety: "สายพันธุ์ 1", min: 50, max: 80, avg: 65 },
     ]
   }
   ```

### ย้ายหน้าการ์ดไป pages/

ถ้าต้องการย้าย government-price-card.html ไปที่ `pages/shared/` ให้แก้:

```javascript
// government-price.js
function openGovCard(commodityName) {
  // เดิม: const url = `government-price-card.html?...`;
  const url = `pages/shared/government-price-card.html?commodity=${encodeURIComponent(commodityName)}`;
  window.location.href = url;
}
```

---

## 🧪 ทดสอบ

เปิด `demo.html` ใน browser เพื่อทดสอบ carousel + click

```bash
# หรืออาจจำเป็นต้องใช้ simple HTTP server
python -m http.server 3000
# แล้วไปที่ http://localhost:3000/components/pricegovernment/demo.html
```

---

## 🔧 Troubleshooting

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|--------|
| Click ไม่ทำงาน | Drag กำลังทำงาน หรือ items ไม่มี | ตรวจสอบ `moved` flag หรือ reload |
| ไม่มีข้อมูลแสดง | Commodity ไม่มีใน mock-prices.js | เพิ่มข้อมูลใน mock-prices.js |
| Image ไม่ขึ้น | Path รูป ไม่ถูกต้อง | ตรวจสอบ `assets/images/` มีไฟล์ |
| Carousel ไม่ scroll | CSS overflow hidden | ตรวจสอบ .government-grid-scroll width |

