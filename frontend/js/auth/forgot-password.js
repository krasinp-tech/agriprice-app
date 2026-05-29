/**
 * forgot-password.js
 * Handles the multi-step password reset flow using Firebase OTP
 */

document.addEventListener('DOMContentLoaded', function () {
  // Elements
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');
  const stepSuccess = document.getElementById('stepSuccess');

  const stepTitle = document.getElementById('stepTitle');
  const stepSub = document.getElementById('stepSub');

  const phoneInput = document.getElementById('phoneInput');
  const otpInputs = document.querySelectorAll('.otp-input');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  const displayPhone = document.getElementById('displayPhone');

  // Buttons
  const btnSendOTP = document.getElementById('btnSendOTP');
  const btnVerifyOTP = document.getElementById('btnVerifyOTP');
  const btnResetPassword = document.getElementById('btnResetPassword');
  const btnResendOTP = document.getElementById('btnResendOTP');
  const btnBackToLogin = document.getElementById('btnBackToLogin');
  const btnBackToLoginSuccess = document.getElementById('btnBackToLoginSuccess');

  const timerContainer = document.getElementById('timerContainer');
  const timerText = document.getElementById('timerText');

  // States
  let currentPhone = '';
  let tempToken = '';
  let timerId = null;
  let remaining = 120;
  let confirmationResult = null;
  let recaptchaVerifier = null;

  // --- Firebase Initialization ---
  async function initFirebaseOtp() {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;
    if (!window.firebase || !FIREBASE_CONFIG) {
      throw new Error('ยังไม่ได้ตั้งค่า Firebase บนหน้าเว็บ');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        size: 'normal',
        callback: (response) => {
          console.log('[ForgotPwd] reCAPTCHA verified');
        }
      });
    }
  }

  function toE164(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('66')) return '+' + d;
    if (d.startsWith('0')) return '+66' + d.slice(1);
    return '+' + d;
  }

  // --- Step 1: Send OTP ---
  const formStep1 = document.getElementById('formStep1');
  formStep1.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = phoneInput.value.trim();
    if (!phone || phone.length < 10) {
      showError(1, 'กรุณาระบุเบอร์โทรศัพท์ที่ถูกต้อง (10 หลัก)');
      return;
    }

    setLoading(btnSendOTP, true);
    hideError(1);

    const e164Phone = toE164(phone);
    const TEST_PHONES = ['+66812345678', '+66999999999', '+66888888888'];

    try {
      // 1. ลองผ่าน Firebase ก่อน (ถ้าไม่ใช่เบอร์ทดสอบ)
      if (!TEST_PHONES.includes(e164Phone)) {
        try {
          await initFirebaseOtp();
          const recaptchaEl = document.getElementById('recaptcha-container');
          if (recaptchaEl) recaptchaEl.style.display = 'flex';

          confirmationResult = await firebase.auth().signInWithPhoneNumber(e164Phone, recaptchaVerifier);
          
          currentPhone = phone;
          displayPhone.textContent = formatPhone(phone);
          goToStep(2);
          startTimer(120);
          console.log('[ForgotPwd] Firebase OTP sent successfully');
          return;
        } catch (fErr) {
          console.error('[ForgotPwd] Firebase send failed:', fErr);
          // Fallback to Server if Firebase fails
        }
      }

      // 2. Fallback to Server API
      const res = await window.api.otpSend(phone, 'reset');
      if (res.success) {
        currentPhone = phone;
        displayPhone.textContent = formatPhone(phone);
        goToStep(2);
        startTimer(120);
        confirmationResult = { isFallback: true };
        console.log('[ForgotPwd] Server OTP sent successfully');
      } else {
        showError(1, res.message || 'เกิดข้อผิดพลาดในการส่ง OTP');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 1 Error:', err);
      showError(1, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(btnSendOTP, false);
    }
  });

  // --- Step 2: Verify OTP ---
  const formStep2 = document.getElementById('formStep2');
  formStep2.addEventListener('submit', async (e) => {
    e.preventDefault();
    let otp = '';
    otpInputs.forEach(input => otp += input.value);

    if (otp.length < 6) {
      showError(2, 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    setLoading(btnVerifyOTP, true);
    hideError(2);

    try {
      // --- MOCK OTP 123456 BYPASS ---
      if (otp === '123456') {
         if (confirmationResult && confirmationResult.isFallback) {
            const res = await window.api.otpVerify(currentPhone, otp);
            if (res.success) {
              tempToken = res.data.temp_token;
              goToStep(3);
              return;
            }
         }
         tempToken = `mock_temp_token_${currentPhone}_${Date.now()}`;
         goToStep(3);
         return;
      }

      if (!confirmationResult) {
        showError(2, 'กรุณากดขอรหัส OTP ใหม่อีกครั้ง');
        return;
      }

      // ถ้าเป็น Fallback ให้ใช้ Server Verify
      if (confirmationResult.isFallback) {
        const res = await window.api.otpVerify(currentPhone, otp);
        if (res.success) {
          tempToken = res.data.temp_token;
          goToStep(3);
        } else {
          showError(2, res.message || 'รหัส OTP ไม่ถูกต้อง');
        }
        return;
      }

      // ถ้าเป็น Firebase
      const firebaseUserCredential = await confirmationResult.confirm(otp);
      const idToken = await firebaseUserCredential.user.getIdToken();
      
      const res = await window.api.call('POST', '/api/auth/firebase/verify-phone', { idToken, phone: currentPhone });
      if (res && res.success) {
        tempToken = res.data.temp_token;
        goToStep(3);
      } else {
        showError(2, res?.message || 'ยืนยัน OTP ไม่สำเร็จ');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 2 Error:', err);
      const code = err.code || '';
      let msg = 'รหัส OTP ไม่ถูกต้อง หรือเซิร์ฟเวอร์ไม่ตอบสนอง';
      if (code === 'auth/invalid-verification-code') msg = 'รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
      if (code === 'auth/code-expired') msg = 'รหัส OTP หมดอายุแล้ว กรุณาขอใหม่';
      showError(2, msg);
    } finally {
      setLoading(btnVerifyOTP, false);
    }
  });

  // --- Step 3: Reset Password ---
  const formStep3 = document.getElementById('formStep3');
  formStep3.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = newPassword.value;
    const confirm = confirmPassword.value;

    if (pass.length < 8) {
      showError(3, 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }

    if (pass !== confirm) {
      showError(3, 'รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(btnResetPassword, true);
    hideError(3);

    try {
      const res = await window.api.passwordReset(tempToken, pass);

      if (res.success) {
        goToStep('success');
      } else {
        showError(3, res.message || 'เกิดข้อผิดพลาดในการตั้งรหัสผ่านใหม่');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 3 Error:', err);
      showError(3, err.message || 'เซิร์ฟเวอร์ไม่ตอบสนอง');
    } finally {
      setLoading(btnResetPassword, false);
    }
  });

  // --- Resend OTP ---
  btnResendOTP.addEventListener('click', () => {
    if (remaining > 0) return;
    formStep1.requestSubmit ? formStep1.requestSubmit() : formStep1.dispatchEvent(new Event('submit'));
  });

  // --- Helper Functions ---

  function goToStep(step) {
    [step1, step2, step3, stepSuccess].forEach(s => s.classList.remove('active'));

    if (step === 1) {
      step1.classList.add('active');
      stepTitle.textContent = 'ลืมรหัสผ่าน?';
      stepSub.textContent = 'ไม่ต้องกังวล เราจะช่วยคุณกู้คืนบัญชี';
    } else if (step === 2) {
      step2.classList.add('active');
      stepTitle.textContent = 'ยืนยันตัวตน';
      stepSub.textContent = 'กรอกรหัส 6 หลักที่ส่งไปทาง SMS';
      otpInputs[0].focus();
    } else if (step === 3) {
      step3.classList.add('active');
      stepTitle.textContent = 'ตั้งรหัสผ่านใหม่';
      stepSub.textContent = 'เลือกใช้รหัสผ่านที่คุณจำได้ง่ายและปลอดภัย';
    } else if (step === 'success') {
      stepSuccess.classList.add('active');
      stepTitle.textContent = '';
      stepSub.textContent = '';
    }
  }

  function showError(step, msg) {
    const errEl = document.getElementById(`error${step}`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('is-show');
    }
  }

  function hideError(step) {
    const errEl = document.getElementById(`error${step}`);
    if (errEl) {
      errEl.classList.remove('is-show');
    }
  }

  function setLoading(btn, isLoading) {
    if (isLoading) {
      btn.classList.add('is-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  function formatPhone(p) {
    return p.replace(/(\d{3})(\d{3})(\d{4})/, '$1-XXX-$3');
  }

  function startTimer(sec) {
    clearInterval(timerId);
    remaining = sec;
    if (timerContainer) timerContainer.style.display = 'flex';
    if (btnResendOTP) btnResendOTP.disabled = true;

    const updateLabel = () => {
      if (timerText) {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        timerText.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    };

    updateLabel();
    timerId = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timerId);
        if (btnResendOTP) btnResendOTP.disabled = false;
      }
      updateLabel();
    }, 1000);
  }

  // --- UI Interactivity ---

  // OTP inputs auto-focus next
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });
  });

  // Toggle Passwords
  setupTogglePwd('togglePwd1', 'newPassword');
  setupTogglePwd('togglePwd2', 'confirmPassword');

  function setupTogglePwd(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;

    btn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.style.color = isPass ? 'var(--brand)' : 'var(--muted)';
    });
  }

  // Navigation
  btnBackToLogin.addEventListener('click', () => {
    window.location.href = './login2.html';
  });

  btnBackToLoginSuccess.addEventListener('click', () => {
    window.location.href = './login2.html';
  });

});
