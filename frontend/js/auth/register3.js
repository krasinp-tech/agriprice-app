/* js/auth/register3.js - OTP verify
  - อ่าน phone จาก sessionStorage[register_profile]
  - ยืนยัน OTP -> ได้ temp_token -> เก็บไว้ให้ register4
*/
(function () {
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// DEBUG PATCH - inspect verification flow
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•

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
  // 1. Check sessionStorage phone
  // 2. Check window.FIREBASE_CONFIG
  },
  err(step, e) {
    if (!window.AGRIPRICE_DEBUG) return;
    console.error(`[โ] ${step}`, {
      code: e?.code ?? '-',
      message: e?.message ?? String(e),
      stack: e?.stack ?? '-'
    });
  }
};

// โ”€โ”€ 1. เธ•เธฃเธงเธ sessionStorage phone โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
D.log('1_SESSION', {
  register_profile: sessionStorage.getItem('register_profile'),
  otp_temp_token: sessionStorage.getItem('otp_temp_token')
});

// โ”€โ”€ 2. เธ•เธฃเธงเธ window.FIREBASE_CONFIG โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
D.log('2_FIREBASE_CONFIG', {
  hasFirebase: !!window.firebase,
  hasConfig: !!window.FIREBASE_CONFIG,
  apiKey: window.FIREBASE_CONFIG?.apiKey?.slice(0,8) + '...',
  authDomain: window.FIREBASE_CONFIG?.authDomain,
  projectId: window.FIREBASE_CONFIG?.projectId
});

// โ”€โ”€ 3. เธ•เธฃเธงเธ API_BASE_URL โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
// 3. Check API_BASE_URL
D.log('3_API_BASE', { API_BASE_URL: window.API_BASE_URL });

// โ”€โ”€ 4. เธ•เธฃเธงเธ recaptcha-container โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
// 4. Check recaptcha-container
D.log('4_RECAPTCHA_EL', {
  found: !!document.getElementById('recaptcha-container'),
  el: document.getElementById('recaptcha-container')
});

// โ”€โ”€ 5. hook XMLHttpRequest โ€” เธ”เธน network call เธ—เธธเธเธ•เธฑเธง
// 5. Hook XMLHttpRequest to inspect every network call
(function hookXHR() {
  const _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this.addEventListener('load', function() {
      if (String(this._url).includes('identitytoolkit') ||
          String(this._url).includes('firebase') ||
          String(this._url).includes('localhost')) {
        D.log('5_XHR', {
          method, url: this._url,
          status: this.status,
          responseSnippet: this.responseText?.slice(0, 300)
        });
      }
    });
    this.addEventListener('error', function() {
      D.err('5_XHR_ERROR', { url: this._url });
    });
    return _open.apply(this, arguments);
  };
})();

// โ”€โ”€ 6. hook fetch โ€” เธ”เธน /api/auth/firebase/verify-phone
// 6. Hook fetch to inspect /api/auth/firebase/verify-phone
(function hookFetch() {
  const _fetch = window.fetch;
  window.fetch = async function(url, opts) {
    D.log('6_FETCH_REQ', { url, method: opts?.method, body: opts?.body });
    try {
      const res = await _fetch.apply(this, arguments);
      const clone = res.clone();
      clone.text().then(body =>
        D.log('6_FETCH_RES', { url, status: res.status, body: body?.slice(0, 400) })
      );
      return res;
    } catch (e) {
      D.err('6_FETCH_FAIL', e); throw e;
    }
  };
})();

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// ๐” END DEBUG PATCH
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•

  const API_BASE   = (window.API_BASE_URL || '').replace(/\/$/, '');
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
    return e?.message || 'ส่ง OTP ไม่สำเร็จ';
  }

  async function sendOtp() {
    clearErr();
    const phone = getPhone();
    if (!phone) { showErr('ไม่พบเบอร์โทรจากขั้นตอนก่อนหน้า'); return; }
    try {
      if (window.APP_CONFIG_READY) {
        await window.APP_CONFIG_READY;
      }
      setConfigSourceStatus();
      if (!window.FIREBASE_CONFIG || !window.FIREBASE_CONFIG.apiKey) {
        const cfgErr = window.APP_CONFIG_ERROR || 'CONFIG_MISSING';
        throw new Error('APP_CONFIG_ERROR:' + cfgErr);
      }
      await initFirebaseOtp();
      const phoneE164 = toE164(phone);
      logOtp('otp.send.request', { rawPhone: phone, phoneE164 });
      logOtp('otp.send.pending', { hint: 'waiting for recaptcha / firebase response' });
      const sendPromise = firebaseAuth.signInWithPhoneNumber(phoneE164, recaptchaVerifier);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RECAPTCHA_TIMEOUT')), 90000);
      });
      confirmationResult = await Promise.race([sendPromise, timeoutPromise]);
      logOtp('otp.send.success', { phoneE164 });
      setHint('ส่ง OTP แล้ว');
      startTimer(120);
    } catch (e) {
      if (String(e?.message || '').startsWith('APP_CONFIG_ERROR:')) {
        logOtp('config.load.error', {
          appConfigError: window.APP_CONFIG_ERROR || 'UNKNOWN',
          apiBase: API_BASE,
        });
        showErr('โหลดการตั้งค่าระบบไม่สำเร็จ กรุณาเปิด backend แล้วลองใหม่');
        return;
      }
      logOtp('otp.send.error', {
        code: e?.code || '',
        message: e?.message || 'unknown',
        stack: e?.stack || '',
      });
      showErr(mapFirebaseOtpError(e));
      try {
        if (typeof recaptchaWidgetId === 'number' && window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
          window.grecaptcha.reset(recaptchaWidgetId);
        }
      } catch (_) {}
    }
  }

  async function verifyOtp(otp) {
    const phone = getPhone();
    if (!phone) throw new Error('ไม่พบเบอร์โทร');
    if (remaining <= 0) throw new Error('รหัสหมดอายุ กรุณาขอรหัสใหม่');

    if (!API_BASE) {
      throw new Error('ไม่พบการตั้งค่า API กรุณาตั้งค่า API_BASE_URL');
    }

    if (!confirmationResult) {
      throw new Error('ไม่พบคำขอ OTP กรุณากดขอรหัสใหม่');
    }

    logOtp('otp.verify.request', { otpLength: String(otp || '').length });
    const firebaseUserCredential = await confirmationResult.confirm(otp);
    const idToken = await firebaseUserCredential.user.getIdToken();
    logOtp('otp.verify.firebase.success', {
      uid: firebaseUserCredential?.user?.uid || '',
      phoneNumber: firebaseUserCredential?.user?.phoneNumber || '',
      hasIdToken: !!idToken,
    });

    const res = await fetch(API_BASE + '/api/auth/firebase/verify-phone', {
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

    // เธเธฑเธเธ—เธถเธ temp_token เน€เธชเธกเธญ (เนเธเนเนเธ”เนเธ—เธฑเนเธ user เนเธซเธกเนเนเธฅเธฐเน€เธเนเธฒ)
      // Save temp_token immediately so it works for new and existing users
    sessionStorage.setItem(KEY_TEMP_TOKEN, json.temp_token || '');

    // เธ–เนเธฒเน€เธเธญเธฃเนเธกเธตเธเธฑเธเธเธตเนเธฅเนเธง โ’ redirect เนเธ login เนเธ—เธ
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
      // __redirect__ เธเธทเธญ silent error เธ—เธตเนเธ•เธฑเนเธเนเธ redirect เนเธกเนเธ•เนเธญเธเนเธชเธ”เธ
        // __redirect__ is a silent error used to stop explicit redirect logging
      if (err?.message !== '__redirect__') {
        logOtp('otp.verify.error', {
          code: err?.code || '',
          message: err?.message || 'unknown',
          stack: err?.stack || '',
        });
        showErr(err?.message || 'ยืนยัน OTP ไม่สำเร็จ');
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
