# 🌾 AgriPrice - แพลตฟอร์มซื้อขายผลผลิตการเกษตร

แพลตฟอร์มสำหรับเชื่อมต่อระหว่างเกษตรกร (Farmer) และผู้รับซื้อ (Buyer) เพื่อจัดการการจองคิวรับซื้อผลผลิตอย่างมีประสิทธิผล ลดระยะเวลาการรอคอย และเพิ่มความโปร่งใสในด้านราคา

## 🚀 โครงสร้างโปรเจกต์ (Project Structure)

โปรเจกต์นี้แบ่งออกเป็น 2 ส่วนหลัก:

### 1. [Frontend (Client)](./frontend/)
- **เทคโนโลยี**: HTML5, Vanilla CSS, Javascript (ES6+)
- **ฟีเจอร์**: ระบบจองคิว, แชท, ค้นหาสินค้าพร้อมตัวกรอง, ระบบแจ้งเตือน และโปรไฟล์ผู้ใช้
* **Mobile Support**: รองรับการทำแอป Android ผ่าน Capacitor/Cordova

### 2. [Backend (Server)](./server/)
- **เทคโนโลยี**: Node.js, Express, PostgreSQL (บน Supabase)
- **ฟีเจอร์**: API Auth (OTP Development Mode), Database Connection Pool, ระบบคำนวณคิวอัตโนมัติ และ File Upload
- **ความปลอดภัย**: รองรับ JWT Authentication และมาตรฐาน CORS

## 🛠️ วิธีการรันโปรเจกต์ (Getting Started)

### การเตรียมการ
1. ติดตั้ง [Node.js](https://nodejs.org/)
2. ปรับปรุงไฟล์ `.env` ในโฟลเดอร์ `server` โดยระบุ `DATABASE_URL` ของคุณ

### การรัน Backend
```bash
cd server
npm install
npm run dev
```

### การรัน Frontend
- สามารถใช้ **Live Server** (VS Code) เปิดจากโฟลเดอร์ `frontend/index.html`
- ตัวแอปจะเชื่อมต่อกับ API ที่ `http://localhost:5000` โดยอัตโนมัติ

### 3. [Infrastructure & Setup](./infrastructure/)
- **Database Scripts**: รวมสคริปต์ SQL สำหรับสร้างและปรับปรุงฐานข้อมูลบน Supabase
- **Optimization**: มีระบบ Indexing และ RLS Security ให้พร้อมใช้งาน

## 🛠️ วิธีการรันโปรเจกต์ (Getting Started)

### 1. การเตรียมฐานข้อมูล (Database)
- เข้าไปที่โฟลเดอร์ `infrastructure/database/`
- นำคำสั่งใน `SUPABASE_OPTIMIZE.sql` ไปรันใน SQL Editor ของ Supabase

### 2. การรัน Backend
```bash
cd server
npm install
# คัดลอก .env.example เป็น .env และตั้งค่า DATABASE_URL
npm run dev
```

### 3. การรัน Frontend
- ใช้ **Live Server** เปิด `frontend/index.html`
- ตัวแอปจะเชื่อมต่อกับ API อัตโนมัติ

## 📱 การพัฒนาแอปมือถือ (Mobile Development)
- โปรเจกต์นี้รองรับ Capacitor สำหรับการ Build เป็น Android/iOS App
- สามารถรัน `npm run cap:copy` ในโฟลเดอร์ frontend เพื่อซิงค์ไฟล์


---
*โปรเจกต์นี้ได้รับการพัฒนาเพื่อยกระดับสินค้าเกษตรไทย* 🍎🍍🍇
