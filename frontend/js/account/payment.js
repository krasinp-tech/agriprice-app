document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const verifyBtn = document.getElementById('verifyBtn');
  const timerText = document.getElementById('timerText');

  // Go back
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (document.referrer && document.referrer.includes(window.location.host)) {
        window.history.back();
      } else {
        if (window.navigateWithTransition) {
          window.navigateWithTransition('subscription.html');
        } else {
          window.location.href = 'subscription.html';
        }
      }
    });
  }

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Add active to clicked
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Verify Button
  if (verifyBtn) {
    verifyBtn.addEventListener('click', async () => {
      const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-target');
      
      // Add loading state
      const originalText = verifyBtn.innerText;
      verifyBtn.innerHTML = '<span class="material-icons-outlined" style="animation: spin 1s linear infinite; font-size: 20px;">autorenew</span>';
      
      try {
        if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        
        const response = await fetch(currentBase + '/api/payments/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ paymentMethod: activeTab, amount: 2490 })
        });
        
        const result = await response.json();
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Payment failed');
        }

        verifyBtn.innerText = 'สำเร็จ!';
        verifyBtn.style.background = '#10b981'; // Green color for success
        verifyBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
        
        // Update local user object and token
        try {
          if (result.data && result.data.token) {
            localStorage.setItem(window.AUTH_TOKEN_KEY || 'token', result.data.token);
          }
          const userStr = localStorage.getItem(window.AUTH_USER_KEY || 'user_data');
          if (userStr) {
            const userObj = JSON.parse(userStr);
            userObj.tier = 'pro';
            localStorage.setItem(window.AUTH_USER_KEY || 'user_data', JSON.stringify(userObj));
          }
        } catch(e) {}

        setTimeout(() => {
          // Redirect to account page after success
          if (window.navigateWithTransition) {
            window.navigateWithTransition('account.html');
          } else {
            window.location.href = 'account.html';
          }
        }, 1000);

      } catch (error) {
        verifyBtn.innerText = originalText;
        if (window.appNotify) {
          window.appNotify(error.message, 'error');
        } else {
          console.error(error.message);
        }
      }
    });
  }

  // QR Countdown Timer (15:00)
  if (timerText) {
    let timeLeft = 15 * 60; // 15 minutes in seconds

    const updateTimer = () => {
      const minutes = Math.floor(timeLeft / 60);
      let seconds = timeLeft % 60;

      // Add leading zero to seconds
      if (seconds < 10) {
        seconds = '0' + seconds;
      }

      timerText.innerText = `${minutes}:${seconds}`;

      if (timeLeft > 0) {
        timeLeft--;
      } else {
        clearInterval(timerInterval);
        timerText.innerText = 'หมดเวลา';
        timerText.style.color = '#ef4444'; // Red color
      }
    };

    updateTimer(); // Initial call
    const timerInterval = setInterval(updateTimer, 1000);
  }

  // Card formatting
  const cardNumberInput = document.getElementById('cardNumber');
  const cardExpiryInput = document.getElementById('cardExpiry');

  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
      let formattedValue = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formattedValue += ' ';
        }
        formattedValue += value[i];
      }
      e.target.value = formattedValue;
    });
  }

  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 2) {
        e.target.value = value.substring(0, 2) + '/' + value.substring(2, 4);
      } else {
        e.target.value = value;
      }
    });
  }

  // [FIX] ย้าย keyframes injection เข้ามาใน DOMContentLoaded เพื่อป้องกัน crash ก่อน <head> พร้อม
  const spinStyle = document.createElement('style');
  spinStyle.innerHTML = `@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`;
  document.head.appendChild(spinStyle);
});
