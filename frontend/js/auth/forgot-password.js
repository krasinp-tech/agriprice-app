/**
 * forgot-password.js
 * Handles the multi-step password reset flow
 */

document.addEventListener('DOMContentLoaded', function() {
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
  
  // States
  let currentPhone = '';
  let tempToken = '';

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

    try {
      const res = await window.api.otpSend(phone);

      if (res.success) {
        currentPhone = phone;
        displayPhone.textContent = formatPhone(phone);
        goToStep(2);
      } else {
        showError(1, res.message || 'เกิดข้อผิดพลาดในการส่ง OTP');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 1 Error:', err);
      showError(1, err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
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
      const res = await window.api.otpVerify(currentPhone, otp);

      if (res.success) {
        if (res.data.isNewUser) {
          showError(2, 'เบอร์โทรศัพท์นี้ยังไม่ได้สมัครสมาชิก');
        } else {
          tempToken = res.data.temp_token;
          goToStep(3);
        }
      } else {
        showError(2, res.message || 'รหัส OTP ไม่ถูกต้อง');
      }
    } catch (err) {
      console.error('[ForgotPwd] Step 2 Error:', err);
      showError(2, err.message || 'ไม่สามารถตรวจสอบ OTP ได้');
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
