document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const freePlanBtn = document.getElementById('freePlanBtn');
  const carousel = document.querySelector('.plans-carousel');
  const dots = document.querySelectorAll('.dot');

  // Go back
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (document.referrer && document.referrer.includes(window.location.host)) {
        window.history.back();
      } else {
        window.location.href = '../buyer/Dashboard/Dashboard1.html';
      }
    });
  }

  // Upgrade Button -> go to payment
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      window.location.href = 'payment.html';
    });
  }

  function updateUI(tier) {
    const isPro = (String(tier).toLowerCase() === 'pro');
    
    if (isPro) {
      // Pro plan card button: disabled, says "แพ็กเกจปัจจุบัน"
      if (upgradeBtn) {
        upgradeBtn.disabled = true;
        upgradeBtn.innerText = window.i18nT ? window.i18nT('current_plan_btn', 'แพ็กเกจปัจจุบัน') : 'แพ็กเกจปัจจุบัน';
        upgradeBtn.className = 'plan-btn btn-current';
      }
      // Free plan card button: enabled, says "ยกเลิกแพ็กเกจโปร"
      if (freePlanBtn) {
        freePlanBtn.disabled = false;
        freePlanBtn.innerText = window.i18nT ? window.i18nT('cancel_pro_btn', 'ยกเลิกแพ็กเกจโปร') : 'ยกเลิกแพ็กเกจโปร';
        freePlanBtn.className = 'plan-btn btn-upgrade'; // style as active button
        freePlanBtn.style.background = '#ef4444'; // Red background for cancellation/downgrade
        freePlanBtn.style.color = '#ffffff';
        freePlanBtn.style.cursor = 'pointer';
      }
    } else {
      // Free plan card button: disabled, says "แพ็กเกจปัจจุบัน"
      if (freePlanBtn) {
        freePlanBtn.disabled = true;
        freePlanBtn.innerText = window.i18nT ? window.i18nT('current_plan_btn', 'แพ็กเกจปัจจุบัน') : 'แพ็กเกจปัจจุบัน';
        freePlanBtn.className = 'plan-btn btn-current';
        freePlanBtn.style.background = '';
        freePlanBtn.style.color = '';
        freePlanBtn.style.cursor = '';
      }
      // Pro plan card button: enabled, says "อัปเกรดเป็น Pro"
      if (upgradeBtn) {
        upgradeBtn.disabled = false;
        upgradeBtn.innerText = window.i18nT ? window.i18nT('upgrade_pro_btn', 'อัปเกรดเป็น Pro') : 'อัปเกรดเป็น Pro';
        upgradeBtn.className = 'plan-btn btn-upgrade';
      }
    }
  }

  // Load initial state from local storage
  let currentTier = 'free';
  try {
    const userStr = localStorage.getItem('user_data') || localStorage.getItem('user');
    if (userStr) {
      const userObj = JSON.parse(userStr);
      currentTier = userObj.tier || 'free';
    }
  } catch(e) {}
  updateUI(currentTier);

  // Sync latest tier status from API in background
  const token = localStorage.getItem('token') || '';
  if (token && window.api && typeof window.api.getProfile === 'function') {
    window.api.getProfile()
      .then(profile => {
        if (profile && profile.tier) {
          const userStr = localStorage.getItem('user_data') || localStorage.getItem('user');
          if (userStr) {
            try {
              const userObj = JSON.parse(userStr);
              userObj.tier = profile.tier;
              localStorage.setItem('user_data', JSON.stringify(userObj));
              localStorage.setItem('user', JSON.stringify(userObj));
            } catch(e) {}
          }
          updateUI(profile.tier);
        }
      })
      .catch(err => console.warn('[Subscription] Sync profile status failed:', err));
  }

  // Downgrade/Cancellation Handler
  if (freePlanBtn) {
    freePlanBtn.addEventListener('click', async () => {
      const isPro = (freePlanBtn.innerText.includes('ยกเลิก') || freePlanBtn.innerText.toLowerCase().includes('cancel') || freePlanBtn.innerText.includes('套餐'));
      if (!isPro) return;

      const message = window.i18nT 
        ? window.i18nT('confirm_cancel_subscription', 'ต้องการยกเลิกแพ็กเกจโปรและกลับไปใช้แผนเริ่มต้นใช่หรือไม่? คุณจะเสียสิทธิ์ในการเข้าถึงแดชบอร์ดวิเคราะห์ข้อมูล') 
        : 'ต้องการยกเลิกแพ็กเกจโปรและกลับไปใช้แผนเริ่มต้นใช่หรือไม่? คุณจะเสียสิทธิ์ในการเข้าถึงแดชบอร์ดวิเคราะห์ข้อมูล';
      
      const handleCancel = async () => {
        const originalText = freePlanBtn.innerText;
        freePlanBtn.disabled = true;
        freePlanBtn.innerHTML = '<span class="material-icons-outlined" style="animation: spin 1s linear infinite; font-size: 20px; color: #fff;">autorenew</span>';

        try {
          if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
          const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
          
          const response = await fetch(currentBase + '/api/payments/cancel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            }
          });

          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || 'Cancellation failed');
          }

          if (result.data && result.data.token) {
            localStorage.setItem(window.AUTH_TOKEN_KEY || 'token', result.data.token);
          }
          const userStr = localStorage.getItem('user_data') || localStorage.getItem('user');
          if (userStr) {
            const userObj = JSON.parse(userStr);
            userObj.tier = 'free';
            localStorage.setItem('user_data', JSON.stringify(userObj));
            localStorage.setItem('user', JSON.stringify(userObj));
          }

          if (window.appNotify) {
            window.appNotify(window.i18nT ? window.i18nT('cancel_success', 'ยกเลิกแพ็กเกจโปรสำเร็จ') : 'ยกเลิกแพ็กเกจโปรสำเร็จ', 'success');
          }

          setTimeout(() => {
            window.location.reload();
          }, 1000);

        } catch (error) {
          freePlanBtn.innerText = originalText;
          freePlanBtn.disabled = false;
          freePlanBtn.style.color = '#ffffff';
          if (window.appNotify) {
            window.appNotify(error.message, 'error');
          } else {
            alert(error.message);
          }
        }
      };

      if (window.showConfirm) {
        window.showConfirm(message, (confirmed) => {
          if (confirmed) handleCancel();
        });
      } else {
        if (confirm(message)) {
          handleCancel();
        }
      }
    });
  }

  // Scroll detection for dots
  if (carousel && dots.length === 2) {
    setTimeout(() => {
      const proCard = document.querySelector('.pro-plan');
      if (proCard && currentTier !== 'pro') {
        proCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else if (currentTier === 'pro') {
        const freeCard = document.querySelector('.free-plan');
        if (freeCard) {
          freeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 300);

    carousel.addEventListener('scroll', () => {
      const scrollLeft = carousel.scrollLeft;
      const cardWidth = carousel.querySelector('.plan-card').offsetWidth;

      if (scrollLeft > cardWidth / 2) {
        dots[0].classList.remove('active');
        dots[1].classList.add('active');
      } else {
        dots[0].classList.add('active');
        dots[1].classList.remove('active');
      }
    });
  }
});
