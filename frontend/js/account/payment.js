(function() {
  "use strict";

  const api = window.api || {};

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // --- Toast Helper (Application Alert replacement) ---
  function toast(msg, type = 'success') {
    if (window.showToast) {
      window.showToast(msg, type);
    } else {
      console.log(`[Payment ${type}]`, msg);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const checkoutBtn = document.getElementById('checkoutBtn');
    const backBtn = document.querySelector('.back-btn');
    const cardInput = document.querySelector('input[placeholder="0000 0000 0000 0000"]');
    const nameInput = document.querySelector('input[placeholder="JOHN DOE"]');
    const expiryInput = document.querySelector('input[placeholder="MM/YY"]');
    const cvvInput = document.querySelector('input[placeholder="***"]');

    // Tab Selection Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const cardTabContent = document.getElementById('cardTabContent');
    const qrTabContent = document.getElementById('qrTabContent');
    const secureInfo = document.querySelector('.secure-info');
    let activeTab = 'card';
    let timerInterval = null;

    if (backBtn) {
      backBtn.onclick = () => {
        window.history.back();
      };
    }

    // Format Card Number (space every 4 digits)
    if (cardInput) {
      cardInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
        e.target.value = formatted.substring(0, 19);
      });
    }

    // Format Expiry Date (MM/YY)
    if (expiryInput) {
      expiryInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length >= 2) {
          e.target.value = val.substring(0, 2) + '/' + val.substring(2, 4);
        } else {
          e.target.value = val;
        }
      });
    }

    // Format CVV (digits only)
    if (cvvInput) {
      cvvInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
      });
    }

    // Tab Switching Logic
    if (tabBtns.length > 0) {
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeTab = btn.dataset.tab;

          if (activeTab === 'card') {
            cardTabContent.style.display = 'block';
            qrTabContent.style.display = 'none';
            if (secureInfo) secureInfo.style.display = 'flex';
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
          } else {
            cardTabContent.style.display = 'none';
            qrTabContent.style.display = 'block';
            if (secureInfo) secureInfo.style.display = 'none';
            startQrTimer();
          }
        });
      });
    }

    // Countdown Timer for QR Code Tab (15 minutes)
    function startQrTimer() {
      if (timerInterval) clearInterval(timerInterval);
      let duration = 15 * 60; // 15 mins in seconds
      const timerDigits = document.getElementById('timerDigits');

      function updateTimer() {
        let minutes = Math.floor(duration / 60);
        let seconds = duration % 60;

        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;

        if (timerDigits) timerDigits.textContent = minutes + ':' + seconds;

        if (duration <= 0) {
          clearInterval(timerInterval);
          toast(t('payment_timeout', 'หมดเวลาการทำรายการ กรุณาลองใหม่อีกครั้ง'), 'error');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
        duration--;
      }

      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
    }

    // Checkout / Payment confirm event handler
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', async () => {
        
        // 1. Validation for Card tab only
        if (activeTab === 'card') {
          const cardVal = cardInput ? cardInput.value.replace(/\s/g, '') : '';
          const nameVal = nameInput ? nameInput.value.trim() : '';
          const expiryVal = expiryInput ? expiryInput.value.trim() : '';
          const cvvVal = cvvInput ? cvvInput.value.trim() : '';

          if (cardVal.length < 16) {
            toast(t('error_invalid_card', 'กรุณาระบุหมายเลขบัตรเครดิตให้ครบถ้วน'), 'error');
            return;
          }
          if (!nameVal) {
            toast(t('error_invalid_card_name', 'กรุณากรอกชื่อผู้ถือบัตร'), 'error');
            return;
          }
          if (expiryVal.length < 5 || !expiryVal.includes('/')) {
            toast(t('error_invalid_expiry', 'กรุณากรอกวันหมดอายุในรูปแบบ MM/YY'), 'error');
            return;
          }
          if (cvvVal.length < 3) {
            toast(t('error_invalid_cvv', 'กรุณากรอกรหัส CVV 3 หลักหลังบัตร'), 'error');
            return;
          }
        }

        // 2. Submit payment to server
        checkoutBtn.disabled = true;
        const origText = checkoutBtn.innerHTML;
        checkoutBtn.innerHTML = `<span>${t('processing', 'กำลังดำเนินการ...')}</span>`;

        try {
          let res;
          if (api.call) {
            res = await api.call('POST', '/api/payments/checkout', { plan: 'pro', method: activeTab });
          } else {
            const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem('token');
            const response = await fetch(currentBase + '/api/payments/checkout', {
              method: 'POST',
              headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan: 'pro', method: activeTab })
            });
            res = await response.json();
          }

          if (res && res.success) {
            // Clear timer if any
            if (timerInterval) clearInterval(timerInterval);

            // Save new token & update user local storage tier
            if (res.data && res.data.token) {
              localStorage.setItem('token', res.data.token);
              const rawUser = localStorage.getItem("user_data");
              if (rawUser) {
                const user = JSON.parse(rawUser);
                user.tier = 'pro';
                localStorage.setItem("user_data", JSON.stringify(user));
              }
            }
            toast(t('payment_success', 'ชำระเงินสำเร็จ! บัญชีของคุณอัปเกรดเป็น PRO เรียบร้อยแล้ว'), 'success');
            setTimeout(() => {
              window.location.href = 'subscription.html';
            }, 1500);
          } else {
            throw new Error(res.message || 'Payment rejected');
          }
        } catch (err) {
          console.error('[Payment] Checkout failed:', err);
          toast(err.message || t('payment_failed', 'การชำระเงินล้มเหลว กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง'), 'error');
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = origText;
        }
      });
    }
  });

})();
