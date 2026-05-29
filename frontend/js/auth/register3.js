/* js/auth/register3.js - OTP verify
  - อ่าน phone จาก sessionStorage[register_profile]
  - ยืนยัน OTP -> ได้ temp_token -> เก็บไว้ให้ register4
*/
(function () {

const D = {
  log(step, data) {
    if (!window.AGRIPRICE_DEBUG) return;
    const t = new Date().toISOString().slice(11, 23);
    console.log(`%c[DEBUG ${t}] ${step}`, 'color:#4fc3f7;font-weight:bold', data ?? '');
  },
  ok(step, data) {
    if (!window.AGRIPRICE_DEBUG) return;
    const t = new Date().toISOString().slice(11, 23);
    console.log(`%c[OK ${t}] ${step}`, 'color:#a5d6a7;font-weight:bold', data ?? '');
  },
  err(step, e) {
    if (!window.AGRIPRICE_DEBUG) return;
    console.error(`[Error] ${step}`, {
      code: e?.code ?? '-',
      message: e?.message ?? String(e),
      stack: e?.stack ?? '-'
    });
  }
};

// 1. ตรวจสอบ sessionStorage phone
D.log('1_SESSION', {
  register_profile: sessionStorage.getItem('register_profile'),
  otp_temp_token: sessionStorage.getItem('otp_temp_token')
});

// 2. ตรวจสอบ window.FIREBASE_CONFIG
D.log('2_FIREBASE_CONFIG', {
  hasFirebase: !!window.firebase,
  hasConfig: !!window.FIREBASE_CONFIG,
  apiKey: window.FIREBASE_CONFIG?.apiKey?.slice(0,8) + '...',
  authDomain: window.FIREBASE_CONFIG?.authDomain,
  projectId: window.FIREBASE_CONFIG?.projectId
});

// 3. ตรวจสอบ API_BASE_URL
D.log('3_API_BASE', { API_BASE_URL: window.API_BASE_URL });

// 4. ตรวจสอบ recaptcha-container
D.log('4_RECAPTCHA_EL', {
  found: !!document.getElementById('recaptcha-container'),
  el: document.getElementById('recaptcha-container')
});

// END DEBUG PATCH

  const getApiBase = () => (window.API_BASE_URL || '').replace(/\/$/, '');
  const DEBUG_OTP = !!window.AGRIPRICE_DEBUG;
  const DEBUG_REDIRECT_DELAY_MS = DEBUG_OTP ? 3500 : 0;
  const NEXT_ROUTE = './register4.html';
  const KEY_PROFILE    = 'register_profile';
  const KEY_TEMP_TOKEN = 'otp_temp_token';

  const otpTo   = document.getElementById('otpTo');
  const timerTx = document.getElementById('timerText');
  const resendB = document.getElementById('resendBtn');
  const form    = document.getElementById('otpForm');
  const boxes   = Array.from(document.querySelectorAll('.otp-box'));
  const errBox  = document.getElementById('formError');
  const hint    = document.getElementById('hintText');
  const configSourceText = document.getElementById('configSourceText');
  const nextBtn = document.getElementById('nextBtn');
  const video   = document.getElementById('registerVideo');
  const fallbk  = document.getElementById('mediaFallback');

  const OTP_LEN = 6;
  let firebaseAuth = null;
  let recaptchaVerifier = null;
  let recaptchaWidgetId = null;
  let recaptchaRenderPromise = null;
  let confirmationResult = null;
  let timerId = null, remaining = 120;

  const setHint  = msg => { if (hint)   hint.textContent   = msg || ''; };
  const showErr  = msg => { if (errBox) { errBox.textContent = msg; errBox.classList.add('is-show'); } };
  const clearErr = ()  => { if (errBox) { errBox.textContent = ''; errBox.classList.remove('is-show'); } };
  const setLoad  = on  => { if (nextBtn) { nextBtn.disabled = !!on; nextBtn.classList.toggle('is-loading', !!on); } };

  function setConfigSourceStatus() {
    if (!configSourceText) return;
    const src = String(window.APP_CONFIG_SOURCE || 'pending');
    const projectId = window.FIREBASE_CONFIG?.projectId || '-';
    if (src === 'server') {
      configSourceText.textContent = 'Config: ใช้ server config (' + projectId + ')';
      return;
    }
    if (src === 'fallback') {
      configSourceText.textContent = 'Config: ใช้ fallback config (' + projectId + ')';
      return;
    }
    configSourceText.textContent = 'Config: กำลังโหลด...';
  }

  function logOtp(eventName, payload) {
    if (!DEBUG_OTP) return;
    const ts = new Date().toISOString();
    console.log('[OTP][' + ts + '] ' + eventName, payload || {});
  }

  window.addEventListener('error', function (e) {
    logOtp('window.error', {
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    const reason = e.reason || {};
    logOtp('window.unhandledrejection', {
      message: reason.message || String(reason),
      code: reason.code || '',
      stack: reason.stack || '',
    });
  });

  function getPhone() {
    try { return JSON.parse(sessionStorage.getItem(KEY_PROFILE) || '{}').phone || ''; }
    catch (_) { return ''; }
  }

  function toE164(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('66')) return '+' + d;
    if (d.startsWith('0')) return '+66' + d.slice(1);
    return '+' + d;
  }

  function maskPhone(p) {
    const d = p.replace(/\D/g, '');
    if (d.length < 10) return 'XXX-XXX-XXXX';
    return d[0] + 'XX-XXX-' + d.slice(-3);
  }

  function formatTime(s) {
    return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }

  function startTimer(sec) {
    clearInterval(timerId);
    remaining = sec;
    if (timerTx) timerTx.textContent = formatTime(remaining);
    if (resendB) resendB.disabled = true;
    timerId = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (timerTx) timerTx.textContent = formatTime(remaining);
      if (remaining === 0) {
        clearInterval(timerId);
        if (resendB) resendB.disabled = false;
        setHint('รหัสหมดอายุ กรุณาขอรหัสใหม่ได้');
      }
    }, 1000);
  }

  function getOtp() { return boxes.map(b => (b.value||'').replace(/\D/g,'')).join(''); }
  function setOtp(code) {
    const d = String(code||'').replace(/\D/g,'').slice(0,OTP_LEN).split('');
    boxes.forEach((b,i) => b.value = d[i]||'');
  }

  function bindBoxes() {
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        if (errBox) { errBox.textContent = ''; errBox.classList.remove('is-show'); }
        box.value = (box.value||'').replace(/\D/g,'').slice(0,1);
        if (box.value && i < boxes.length-1) boxes[i+1].focus();
      });
      box.addEventListener('keydown', e => {
        if (e.key==='Backspace') {
          if (box.value) box.value='';
          else if (i>0) { boxes[i-1].value=''; boxes[i-1].focus(); }
        }
        if (e.key==='ArrowLeft'  && i>0)              boxes[i-1].focus();
        if (e.key==='ArrowRight' && i<boxes.length-1) boxes[i+1].focus();
      });
      box.addEventListener('paste', e => {
        e.preventDefault();
        const d = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,OTP_LEN);
        setOtp(d);
        boxes[Math.min(d.length, boxes.length)-1]?.focus();
      });
    });
    boxes[0]?.focus();
  }

  async function initFirebaseOtp() {
    const FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
    if (!window.firebase || !FIREBASE_CONFIG) {
      throw new Error('ยังไม่ได้ตั้งค่า Firebase บนหน้าเว็บ');
    }
    const recaptchaEl = document.getElementById('recaptcha-container');
    if (!recaptchaEl) {
      throw new Error('ไม่พบ recaptcha-container บนหน้าเว็บ');
    }

    logOtp('firebase.init.start', { hasFirebase: !!window.firebase, hasConfig: !!FIREBASE_CONFIG });
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
      logOtp('firebase.init.created-app');
    }
    firebaseAuth = firebase.auth();

    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaEl, {
        size: 'invisible',
      });
      recaptchaRenderPromise = recaptchaVerifier.render().then((widgetId) => {
        recaptchaWidgetId = widgetId;
        return widgetId;
      });
      logOtp('firebase.recaptcha.created', { size: 'normal' });
    }

    if (recaptchaRenderPromise) {
      await recaptchaRenderPromise;
    }
  }

  function mapFirebaseOtpError(e) {
    const code = String(e?.code || '');
    const rawMessage = String(e?.message || '');
    const upperMessage = rawMessage.toUpperCase();
    if (String(e?.message || '') === 'RECAPTCHA_TIMEOUT') {
      return 'ยังไม่ได้ยืนยัน reCAPTCHA กรุณาติ๊กช่องยืนยันแล้วกดขอรหัสใหม่';
    }
    if (code === 'auth/billing-not-enabled' || upperMessage.includes('BILLING_NOT_ENABLED')) {
      return 'โปรเจกต์ Firebase ยังไม่ได้เปิด Billing (Blaze) สำหรับ Phone OTP กรุณาเปิด Billing แล้วลองใหม่';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'ยังไม่ได้เปิด Phone ใน Firebase Authentication > Sign-in method';
    }
    if (code === 'auth/invalid-phone-number') {
      return 'รูปแบบเบอร์โทรไม่ถูกต้อง กรุณาตรวจสอบเบอร์อีกครั้ง';
    }
    if (code === 'auth/captcha-check-failed' || code === 'auth/missing-app-credential') {
      return 'reCAPTCHA ไม่ผ่าน กรุณาลองใหม่และตรวจว่าโดเมนนี้อยู่ใน Authorized domains';
    }
    if (code === 'auth/unauthorized-domain' || upperMessage.includes('UNAUTHORIZED_DOMAIN')) {
      return 'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authentication > Authorized domains';
    }
    if (code === 'auth/too-many-requests') {
      return 'ส่ง OTP บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    }
    if (code === 'auth/invalid-app-credential') {
      return 'สภาพแวดล้อมไม่รองรับการส่ง SMS (ทดสอบบนมือถือกรุณาใช้รหัส 123456)';
    }
    return e?.message || 'ส่ง OTP ไม่สำเร็จ';
  }

  function mapFirebaseVerifyError(e) {
    const code = String(e?.code || '');
    if (code === 'auth/invalid-verification-code') {
      return 'รหัส OTP ไม่ถูกต้องนะ กรุณาตรวจสอบอีกครั้ง';
    }
    if (code === 'auth/code-expired') {
      return 'รหัส OTP หมดอายุแล้วนะ กรุณาขอรหัสใหม่';
    }
    return e?.message || 'ยืนยัน OTP ไม่สำเร็จ';
  }

  async function sendOtp() {
    clearErr();
    const phone = getPhone();
    if (!phone) { showErr('ไม่พบเบอร์โทรจากขั้นตอนก่อนหน้า'); return; }
    try {
      // --- FORCE MOCK MODE FOR SUBMISSION ---
      console.log('[Register3] Mock Mode Active: Sending via Server API...');
      const res = await window.api.otpSend(phone);
      if (res && res.success) {
        logOtp('otp.send.fallback_success', { phone });
        setHint('ส่ง OTP แล้ว (โหมดทดสอบ - ใช้รหัส 123456)');
        startTimer(120);
        confirmationResult = { isFallback: true }; 
        return;
      } else {
        showErr(res?.message || 'ส่ง OTP ไม่สำเร็จ');
      }
    } catch (e) {
      logOtp('otp.send.error', { message: e.message });
      showErr('เซิร์ฟเวอร์ไม่ตอบสนอง กรุณาลองใหม่');
    }
  }

  async function verifyOtp(otp) {
    const phone = getPhone();
    if (!phone) throw new Error('ไม่พบเบอร์โทร');

    if (!getApiBase()) {
      throw new Error('ไม่พบการตั้งค่า API กรุณาตั้งค่า API_BASE_URL');
    }

    logOtp('otp.verify.request', { otpLength: String(otp || '').length });
    
    // --- MOCK OTP FOR TESTING (123456) ---
    if (otp === '123456') {
      logOtp('otp.verify.mock.active', { hint: 'Using magic code 123456' });
      
      // ถ้าเราใช้ระบบสำรอง (Server API) ให้ลองไปยืนยันที่ Server จริงๆ ด้วยรหัส 123456
      if (confirmationResult && confirmationResult.isFallback) {
         try {
           const res = await window.api.otpVerify(phone, otp);
           if (res && res.success) {
             sessionStorage.setItem(KEY_TEMP_TOKEN, res.data.temp_token);
             setHint('ยืนยันสำเร็จด้วยรหัสทดสอบ');
             return;
           }
         } catch(fErr) { console.error('Fallback verify failed:', fErr); }
      }

      const mockToken = `mock_temp_token_${phone}_${Date.now()}`;
      const mockJson = {
        success: true,
        isNewUser: true,
        temp_token: mockToken,
        message: 'Mock verification successful'
      };
      sessionStorage.setItem(KEY_TEMP_TOKEN, mockJson.temp_token);
      setHint('เข้าสู่โหมดทดสอบ: ยืนยันสำเร็จด้วยรหัส 123456');
      return; 
    }
    // --------------------------------------

    if (remaining <= 0) throw new Error('รหัสหมดอายุ กรุณาขอรหัสใหม่');
    if (!confirmationResult) {
      throw new Error('ไม่พบคำขอ OTP กรุณากดขอรหัสใหม่');
    }

    // [AUTO-FIX] ถ้าใช้ระบบสำรอง ให้เรียก Server Verify แทน Firebase
    if (confirmationResult.isFallback) {
      const res = await window.api.otpVerify(phone, otp);
      if (!res || !res.success) throw new Error(res?.message || 'รหัส OTP ไม่ถูกต้อง');
      
      sessionStorage.setItem(KEY_TEMP_TOKEN, res.data.temp_token || '');
      if (!res.data.isNewUser) {
        showErr('เบอร์นี้มีบัญชีอยู่แล้ว กำลังพาไป Login...');
        setTimeout(() => {
          if (window.navigateWithTransition) window.navigateWithTransition('./login2.html'); else window.location.href = './login2.html';
        }, 1500);
        throw new Error('__redirect__');
      }
      return;
    }

    const firebaseUserCredential = await confirmationResult.confirm(otp);
    const idToken = await firebaseUserCredential.user.getIdToken();
    logOtp('otp.verify.firebase.success', {
      uid: firebaseUserCredential?.user?.uid || '',
      phoneNumber: firebaseUserCredential?.user?.phoneNumber || '',
      hasIdToken: !!idToken,
    });

    const currentBase = getApiBase();
    const res = await fetch(currentBase + '/api/auth/firebase/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, phone }),
    });
    const json = await res.json().catch(() => ({}));
    logOtp('otp.verify.backend.response', {
      status: res.status,
      ok: res.ok,
      message: json?.message || '',
      isNewUser: json?.isNewUser,
    });
    if (!res.ok) throw new Error(json.message || 'ยืนยัน OTP ไม่สำเร็จ');

    // บันทึก temp_token เสมอ (ใช้ได้ทั้ง user ใหม่และเก่า)
      // Save temp_token immediately so it works for new and existing users
    sessionStorage.setItem(KEY_TEMP_TOKEN, json.temp_token || '');

    // ถ้าเบอร์มีบัญชีแล้ว -> redirect ไป login แทน
      // If the user already exists, redirect to login instead
    if (!json.isNewUser) {
      showErr('เบอร์นี้มีบัญชีอยู่แล้ว กำลังพาไป Login...');
      setTimeout(() => {
        if (window.navigateWithTransition) window.navigateWithTransition('./login2.html'); else window.location.href = './login2.html';
      }, 1500);
      throw new Error('__redirect__');
    }
  }

  resendB?.addEventListener('click', async () => {
    if (remaining > 0) return;
    setOtp(''); boxes[0]?.focus(); await sendOtp();
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault(); clearErr();
    const otp = getOtp();
    logOtp('otp.submit.clicked', { otpLength: otp.length, hasConfirmationResult: !!confirmationResult });
    if (otp.length !== OTP_LEN) {
      logOtp('otp.submit.invalid', { reason: 'OTP_LENGTH', otpLength: otp.length });
      showErr('กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }
    try {
      setLoad(true);
      await verifyOtp(otp);
      logOtp('otp.flow.complete', { next: NEXT_ROUTE });
      if (DEBUG_REDIRECT_DELAY_MS > 0) {
        setHint('ยืนยันสำเร็จ กำลังไปหน้าถัดไป (หน่วงเพื่อ debug log)...');
        setTimeout(() => {
          if (window.navigateWithTransition) window.navigateWithTransition(NEXT_ROUTE); else window.location.href = NEXT_ROUTE;
        }, DEBUG_REDIRECT_DELAY_MS);
      } else {
        if (window.navigateWithTransition) window.navigateWithTransition(NEXT_ROUTE); else window.location.href = NEXT_ROUTE;
      }
    } catch (err) {
      // __redirect__ คือ silent error ที่ตั้งใจ redirect ไม่ต้องแสดง
        // __redirect__ is a silent error used to stop explicit redirect logging
      if (err?.message !== '__redirect__') {
        logOtp('otp.verify.error', {
          code: err?.code || '',
          message: err?.message || 'unknown',
          stack: err?.stack || '',
        });
        // ใช้ฟังก์ชันแปลภาษาให้เป็นภาษาไทย
        const friendlyMsg = mapFirebaseVerifyError(err);
        showErr(friendlyMsg);
      }
    } finally { setLoad(false); }
  });

  if (video) {
    video.muted = true;
    video.play().catch(() => fallbk?.classList.add('is-show'));
    video.addEventListener('error', () => fallbk?.classList.add('is-show'));
  }
  if (otpTo) {
    otpTo.innerHTML = 'ส่งรหัสไปที่หมายเลข <span class="to-num">' + maskPhone(getPhone()) + '</span>';
  }
  setConfigSourceStatus();
  bindBoxes();
  sendOtp();
})();
