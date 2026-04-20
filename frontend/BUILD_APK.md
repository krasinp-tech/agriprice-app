# Build AGRIPRICE as APK - Quick Guide

## Prerequisites
- Node.js & npm
- Cordova CLI: `npm install -g cordova`
- Android SDK & Android Studio
- Java Development Kit (JDK)

## Step 1: Setup Project
```bash
# ถ้ายังไม่มี cordova project
cordova create agriprice-apk com.agriprice.app AGRIPRICE

# Copy files from frontend folder
cp -r frontend/* agriprice-apk/www/
cd agriprice-apk
```

## Step 2: Add Android Platform
```bash
cordova platform add android
```

## Step 3: Build APK
### Development Build (Debug APK)
```bash
cordova build android
```
Find APK at: `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (Production APK)
```bash
cordova build android --release

# Then sign with keystore:
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 \
  -keystore agriprice.keystore \
  app-release-unsigned.apk alias_name

# Align:
zipalign 4 app-release-unsigned.apk app-release.apk
```

## Step 4: Update API Configuration
Edit `frontend/js/config.js`:
```javascript
// Change from localhost to production server
window.API_BASE_URL = 'https://your-api-domain.com';
```

## Key Mobile Optimizations Applied:
✅ Viewport locked (no zoom)
✅ Safe area support for notch
✅ PWA manifest added
✅ Optimized touch interactions
✅ Responsive CSS for mobile
✅ Cordova config ready

## Testing
- Install on Android device: `cordova run android`
- Test on emulator: `cordova emulate android`

## Optional: Build APK via Capacitor (alternative)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init
npx cap add android
npx cap sync
# Open in Android Studio and build
```

## Resources
- Cordova Docs: https://cordova.apache.org/
- Android Build Guide: https://developer.android.com/build
- Capacitor: https://capacitorjs.com/
