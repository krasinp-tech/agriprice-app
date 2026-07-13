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
          if (window.AGRIPRICE_DEBUG) console.log('[ForgotPwd] reCAPTCHA verified');
        }
      });
    }
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

    // Save phone and flow, then redirect to register3.html
    sessionStorage.setItem('otp_flow', 'forgot_password');
    sessionStorage.setItem('forgot_phone', phone);

    setTimeout(() => {
      window.location.href = './register3.html';
    }, 150);
  });

  // --- Step 2: Verify OTP ---
  const formStep2 = document.getElementById('formStep2');
  formStep2.addEventListener('submit', async (e) => {
    e.preventDefault();
    let otp = '';
    if (otpInputs && otpInputs.length > 0) {
      otpInputs.forEach(input => otp += input.value);
    } else {
      const singleOtpInput = document.getElementById('otpInput');
      if (singleOtpInput) {
        otp = singleOtpInput.value.trim();
      }
    }

    if (otp.length < 6) {
      showError(2, 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    setLoading(btnVerifyOTP, true);
    hideError(2);

    try {
      if (confirmationResult && confirmationResult.isFallback) {
        const res = await window.api.otpVerify(currentPhone, otp);
        if (res.success) {
          tempToken = res.data.temp_token;
          goToStep(3);
        } else {
          showError(2, res.message || 'รหัส OTP ไม่ถูกต้อง');
        }
      } else if (confirmationResult) {
        // Firebase verification
        const firebaseUserCredential = await confirmationResult.confirm(otp);
        const idToken = await firebaseUserCredential.user.getIdToken();

        // Post to backend verify-phone endpoint to get our temp_token!
        const currentBase = window.api.getBase();
        const verifyRes = await fetch(currentBase + '/api/auth/firebase/verify-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, phone: currentPhone }),
        });
        const json = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok) throw new Error(json.message || 'ยืนยัน OTP กับระบบไม่สำเร็จ');

        tempToken = json.temp_token || (json.data && json.data.temp_token);
        goToStep(3);
      } else {
        throw new Error('ไม่พบการร้องขอ OTP กรุณาส่งรหัสอีกครั้ง');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 2 Error:', err);
      showError(2, err.message || 'รหัส OTP ไม่ถูกต้อง หรือเซิร์ฟเวอร์ไม่ตอบสนอง');
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
    [step1, step2, step3, stepSuccess].forEach(s => {
      if (s) {
        s.classList.remove('active');
        s.setAttribute('hidden', '');
      }
    });

    if (step === 1) {
      if (step1) {
        step1.classList.add('active');
        step1.removeAttribute('hidden');
      }
      stepTitle.textContent = 'ลืมรหัสผ่าน?';
      stepSub.textContent = 'ไม่ต้องกังวล เราจะช่วยคุณกู้คืนบัญชี';
    } else if (step === 2) {
      if (step2) {
        step2.classList.add('active');
        step2.removeAttribute('hidden');
      }
      stepTitle.textContent = 'ยืนยันตัวตน';
      stepSub.textContent = 'กรอกรหัส 6 หลักที่ส่งไปทาง SMS';
      if (otpInputs && otpInputs[0]) {
        otpInputs[0].focus();
      } else {
        const singleOtpInput = document.getElementById('otpInput');
        if (singleOtpInput) singleOtpInput.focus();
      }
    } else if (step === 3) {
      if (step3) {
        step3.classList.add('active');
        step3.removeAttribute('hidden');
      }
      stepTitle.textContent = 'ตั้งรหัสผ่านใหม่';
      stepSub.textContent = 'เลือกใช้รหัสผ่านที่คุณจำได้ง่ายและปลอดภัย';
    } else if (step === 'success') {
      if (stepSuccess) {
        stepSuccess.classList.add('active');
        stepSuccess.removeAttribute('hidden');
      }
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

  function toE164(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('66')) return '+' + d;
    if (d.startsWith('0')) return '+66' + d.slice(1);
    return '+' + d;
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

  // --- Video Setup ---
  const video = document.getElementById('loginVideo');
  const fallback = document.getElementById('mediaFallback');

  function setupVideo() {
    if (!video) return;
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('error', () => {
      if (fallback) fallback.classList.add('is-show');
    });
    video.play().catch(() => {
      if (fallback) fallback.classList.add('is-show');
    });
  }

  setupVideo();

  // Handle steps from query parameters (redirected from register3.html)
  const urlParams = new URLSearchParams(window.location.search);
  const stepParam = urlParams.get('step');
  if (stepParam === '3') {
    tempToken = sessionStorage.getItem('reset_temp_token') || '';
    goToStep(3);
  } else {
    goToStep(1);
  }

  // Navigation
  if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', () => {
      window.location.href = './login2.html';
    });
  }

  if (btnBackToLoginSuccess) {
    btnBackToLoginSuccess.addEventListener('click', () => {
      window.location.href = './login2.html';
    });
  }

});
