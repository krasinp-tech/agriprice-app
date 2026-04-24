# 📱 Build AGRIPRICE Android APK

## เครื่องมือที่ต้องติดตั้ง
- [Node.js](https://nodejs.org/) v18+
- [Android Studio](https://developer.android.com/studio) (พร้อม Android SDK)
- [JDK 17+](https://adoptium.net/)

---

## วิธี Build APK (ใช้ Capacitor)

### ขั้นตอนทั้งหมด

```bash
# 1. เข้าไปที่ frontend folder
cd frontend

# 2. ติดตั้ง dependencies (ครั้งแรกครั้งเดียว)
npm install

# 3. Build web assets แล้ว sync ไป Android
npm run cap:sync

# 4. เปิด Android Studio
npm run cap:open
```

จากนั้นใน **Android Studio**:
- รอ Gradle sync เสร็จ
- กด **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK จะอยู่ที่: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Capacitor Plugins ที่ใช้งาน

| Plugin | ฟีเจอร์ | เวอร์ชัน |
|--------|---------|---------|
| `@capacitor/geolocation` | GPS / ตำแหน่งใกล้เคียง | 8.x |
| `@capacitor/camera` | ถ่ายรูป / เลือกรูป | 8.x |
| `@capacitor/local-notifications` | การแจ้งเตือน | 8.x |

---

## Android Permissions ที่ขอ (AndroidManifest.xml)

```xml
INTERNET                  → เชื่อมต่อ API
ACCESS_FINE_LOCATION      → GPS แม่นยำ
ACCESS_COARSE_LOCATION    → GPS คร่าวๆ
CAMERA                    → กล้องถ่ายรูป
READ_MEDIA_IMAGES         → อ่านรูปภาพ (Android 13+)
READ_EXTERNAL_STORAGE     → อ่านไฟล์ (Android ≤12)
POST_NOTIFICATIONS        → แจ้งเตือน (Android 13+)
VIBRATE                   → สั่น
```

---

## Script ที่ใช้ได้

```bash
npm run prepare:web   # copy web assets → www/
npm run cap:copy      # prepare:web + copy ไป android เท่านั้น (ไม่ update plugins)
npm run cap:sync      # prepare:web + sync ทุกอย่าง (แนะนำ)
npm run cap:open      # เปิด Android Studio
```

---

## Native App Behaviors ที่ตั้งค่าแล้ว

| พฤติกรรม | สถานะ |
|---------|-------|
| ✅ Lock Portrait (แนวตั้งเสมอ) | ตั้งค่าใน capacitor.config.json |
| ✅ ไม่มี Overscroll/Bounce | DisallowOverscroll = true |
| ✅ ไม่ zoom ได้เลย | user-scalable=no ทุกหน้า |
| ✅ ไม่ copy text ได้ | global.css + global-anim.js |
| ✅ ไม่มี context menu | global-anim.js |
| ✅ Permission UI แบบ native | permission-manager.js |
| ✅ GPS ขอผ่าน Capacitor | @capacitor/geolocation |
| ✅ Camera ขอผ่าน Capacitor | @capacitor/camera |
| ✅ Notification ผ่าน Capacitor | @capacitor/local-notifications |

---

## ทดสอบบนมือถือ (USB Debugging)

```bash
# เชื่อม USB กับมือถือ เปิด Developer Mode + USB Debugging
# แล้วรันจาก Android Studio: Run → Run 'app'
```

หรือผ่าน Capacitor CLI:
```bash
npx cap run android
```

---

*โปรเจกต์นี้พัฒนาด้วย Capacitor v8 + Vanilla HTML/CSS/JS*
