# AgriPrice Frontend JS Documentation
เอกสารสรุปหน้าที่ของไฟล์ JavaScript แต่ละส่วนในโปรเจกต์ AgriPrice สำหรับการนำเสนอ (Presentation)

---

## 📂 Core & Shared (ไฟล์หลักและส่วนกลาง)
- **`js/api-client.js`**: "สะพานเชื่อม API" รวมฟังก์ชันการดึงข้อมูลจาก Server ทั้งหมด (Login, Profile, Product, Booking)
- **`js/components.js`**: จัดการ Component ต่างๆ ในแอป เช่น แถบเมนูล่าง (Bottom Nav) และระบบ Navigation
- **`js/config.js`**: ไฟล์ตั้งค่าหลัก เช่น URL ของ Server (API Base URL)
- **`js/global-anim.js`**: ควบคุมเอนิเมชั่น, ระบบ Dark Mode, และการเปลี่ยนหน้า (Page Transitions)
- **`js/permission-manager.js`**: จัดการขอสิทธิ์เข้าถึงพิกัด (GPS) และฟีเจอร์ต่างๆ ของมือถือ
- **`js/home-sliders.js`**: ควบคุมหน้าแรก (Home) ทั้ง Slider, หมวดหมู่สินค้า และการแสดงรายการสินค้า
- **`js/gov-prices.js`**: จัดการการดึงและแสดงผลราคากลางจากภาครัฐ

---

## 🔐 Auth System (ระบบยืนยันตัวตน)
- **`js/auth/guard.js`**: ตรวจสอบสิทธิ์การเข้าถึง (ถ้ายังไม่ Login จะเด้งไปหน้า Login อัตโนมัติ)
- **`js/auth/login1.js` & `login2.js`**: ควบคุมหน้าเข้าสู่ระบบ (Video Hero และฟอร์มกรอกเบอร์โทร/รหัสผ่าน)
- **`js/auth/register1.js` - `register4.js`**: ขั้นตอนการสมัครสมาชิก (เลือกบทบาท -> กรอกข้อมูล -> ยืนยัน OTP -> ตั้งรหัสผ่าน)
- **`js/auth/forgot-password.js`**: ระบบกู้คืนรหัสผ่านผ่าน OTP

---

## 👤 User Account (จัดการบัญชีและโปรไฟล์)
- **`js/account/account.js`**: หน้าเมนูหลักของ "บัญชี" (แสดงรูปโปรไฟล์, สถิติผู้ติดตาม, และเมนูตั้งค่า)
- **`js/account/manage-accounts/`**: กลุ่มไฟล์จัดการข้อมูลส่วนตัว (เปลี่ยนชื่อ, อีเมล, วันเกิด, รหัสผ่าน)
- **`js/account/manage-address/address-book.js`**: ระบบจัดการที่อยู่สำหรับการรับซื้อ/ขาย
- **`js/account/manage-language/i18n.js`**: ระบบสลับภาษา (ไทย / English / Chinese)
- **`js/account/payment.js` & `subscription.js`**: ระบบชำระเงินและสมัครสมาชิกรายเดือน (Pro Plan)

---

## 🚜 Farmer Flow (ระบบสำหรับเกษตรกร)
- **`js/farmer/booking/booking.js`**: หน้ารวมรายการจองคิวขายของเกษตรกร
- **`js/farmer/booking/booking-step1.js` - `step4.js`**: ขั้นตอนการจองคิวขาย (เลือกวัน/เวลา -> เลือกสินค้า/รถ -> ตรวจสอบข้อมูล -> รับรหัสคิว)

---

## 🛍️ Buyer Flow (ระบบสำหรับผู้ซื้อ/โรงงาน)
- **`js/buyer/myprofile.js`**: หน้าโปรไฟล์ของผู้ซื้อ (แสดงข้อมูลร้านค้า, แผนที่, และสินค้าที่รับซื้อ)
- **`js/buyer/Dashboard/Dashboard1.js`**: หน้าวิเคราะห์ข้อมูล (สถิติการรับซื้อ, กราฟแนวโน้มราคา)
- **`js/buyer/setbooking/booking.js`**: หน้ารวมคิวที่เกษตรกรจองเข้ามา (สำหรับผู้ซื้อตรวจสอบและแสกน QR Code)

---

## 💬 Shared Features (ฟีเจอร์ที่ใช้ร่วมกัน)
- **`js/shared-pages/chat.js`**: ระบบแชทพูดคุยระหว่างเกษตรกรและผู้ซื้อ
- **`js/shared-pages/notifications.js`**: ระบบแจ้งเตือน (คิวใหม่, ข่าวสาร, อัปเดตราคา)
- **`js/shared-pages/search.js`**: ระบบค้นหาผู้ซื้อและสินค้าตามระยะทาง (GPS)
- **`js/shared-pages/favorites.js`**: จัดการรายการโปรด (ร้านค้าที่ติดตาม)
- **`js/shared-pages/profile.js`**: หน้าแสดงโปรไฟล์ของผู้ใช้อื่นๆ ในแอป

---

## 🛠️ Utilities (เครื่องมือเสริม)
- **`js/utils/ui-helpers.js`**: รวมฟังก์ชันช่วยแต่ง UI (จัดรูปแบบวันที่, ตัวเลข, เวลา)
- **`js/utils/location-helper.js`**: เครื่องมือคำนวณระยะทางและพิกัด GPS
- **`js/utils/auth.js`**: ตัวช่วยจัดการ Token และสถานะการ Login
