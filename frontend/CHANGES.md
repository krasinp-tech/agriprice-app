# AGRIPRICE Frontend — การแก้ไข

## ไฟล์ที่แก้ไข

### บัค / เพี้ยน
- **register1.html** — ลบ backtick artifact (`` `n ``) ออกจาก `</head>`
- **booking-step3.html** — ลบ backtick artifact เช่นเดียวกัน
- **index.html** — แก้ SVG linearGradient ที่มี duplicate attributes (x2, y1 ซ้ำ)
- **bottom-nav.html** — แก้ nav-badge ที่มี `display:none` ซ้ำ 2 ครั้ง
- **login1.html** — เพิ่ม JS ซ่อน video element เมื่อไม่มี source (ป้องกันกล่องดำ)

### Layout & Spacing
- **css/home.css** — เพิ่ม `--hero-overlap` variable ให้ hero indicator และ search sync กัน
- **css/home.css** — แก้ product grid: mobile ใช้ 3 col, tablet+ ใช้ 6 col
- **css/home.css** — เพิ่ม `scroll-behavior: smooth` และ `overscroll-behavior-x: contain` ใน hero carousel
- **css/global.css** — แก้ `padding-bottom` ใช้ `--nav-height` variable แทน hardcode
- **css/farmer/booking/booking-step1.css** — เพิ่ม `env(safe-area-inset-top)` ใน header-card padding
- **css/buyer/setbooking/setbooking-step1.css** — ลบ `:root` block ที่ duplicate กับ global.css
- **css/buyer/setbooking/*.css** — เปลี่ยน `100vh` → `100dvh` สำหรับ iOS PWA
- **css/account/account.css** — แก้ `.stat-divider` ให้มี `min-width: 1px; flex-shrink: 0`

### ไอคอน
- **bottom-nav.html** — เปลี่ยน booking icon: `local_mall` → `event_available`
- **bottom-nav.css** — ลด icon size จาก 26px → 24px, เพิ่ม gap จาก 3px → 4px
- **index.html** — เปลี่ยน category icon "น้ำมัน": `opacity` → `oil_barrel`
- **index.html** — เปลี่ยน category icon "อินทรีย์": `spa` → `eco`
- **account.html** — เปลี่ยน icon "จัดการอุปกรณ์": `desktop_windows` → `devices`

### โฟล Booking/Queue
- **farmer/booking/booking.html** — เพิ่ม FAB button "จองคิวใหม่" มุมขวาล่าง
- **css/farmer/booking/booking.css** — เพิ่ม `.fab-btn` styles
- **farmer/booking/booking-step4.html** — เพิ่มปุ่ม "ดูรายการจองทั้งหมด"
- **css/farmer/booking/booking-step4.css** — เพิ่ม `.btn-view-all` styles
- **buyer/setbooking/booking.html** — เปลี่ยน QR scan button เป็น Extended FAB พร้อม label "สแกนเช็กอิน"
- **bottom-nav.html** — เพิ่ม `data-booking-link` attribute สำหรับ JS role-based redirect

### Mobile-feel
- **index.html** — เปลี่ยน clear search button จาก `display:none` เป็น `opacity:0` + transition
- **css/home.css** — เพิ่ม `.clear-search` CSS class
- **farmer/booking/booking-step2.html** — เพิ่ม `inputmode="decimal"` ให้ number inputs

### Font Consistency
- **pages/auth/login1.html, login2.html** — เพิ่ม Sarabun font ควบคู่กับ Kanit
- **pages/farmer/booking/booking-step*.html** — เปลี่ยนจาก Inter → Sarabun
- **css/farmer/booking/booking-step*.css** — อัพเดท font-family stack ให้ใช้ Sarabun เป็น primary

### Auth/Security
- **farmer/booking/booking-step1,2,4.html** — ย้าย guard.js ขึ้นมาใน `<head>` เพื่อ redirect ก่อน render
