document.addEventListener('DOMContentLoaded', () => {
  "use strict";

  const backBtn = document.getElementById('backBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const carousel = document.querySelector('.plans-carousel');
  const dots = document.querySelectorAll('.dot');
  const api = window.api || {};
  
  let currentTier = 'free';
  let proStartedAt = null;
  let proExpiresAt = null;

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  // Go back
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.goBackOrFallback('account.html');
    });
  }

  // Check current subscription from API
  async function checkCurrentSubscription() {
    try {
      if (api.getProfile) {
        const profile = await api.getProfile();
        if (profile && profile.tier) {
          currentTier = profile.tier.toLowerCase();
          proStartedAt = profile.pro_started_at || null;
          proExpiresAt = profile.pro_expires_at || null;
          
          // Update user_data in localStorage
          const rawUser = localStorage.getItem("user_data");
          if (rawUser) {
            const user = JSON.parse(rawUser);
            user.tier = currentTier;
            localStorage.setItem("user_data", JSON.stringify(user));
          }
        }
      }
    } catch (err) {
      console.warn('[Subscription] Sync error, fallback to cache:', err);
      try {
        const rawUser = localStorage.getItem("user_data");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          currentTier = (user.tier || 'free').toLowerCase();
        }
      } catch (_) {}
    }

    renderUI();
  }

  function renderUI() {
    const freeBtn = document.querySelector('.free-plan .plan-btn');
    const proBtn = document.querySelector('.pro-plan .plan-btn');
    const cancelSubWrap = document.getElementById('cancelSubWrap');
    const cancelSubLink = document.getElementById('cancelSubLink');

    let periodEl = document.getElementById('proMembershipPeriod');
    const proCard = document.querySelector('.pro-plan');
    if (!periodEl && proCard) {
      periodEl = document.createElement('div');
      periodEl.id = 'proMembershipPeriod';
      periodEl.style.cssText = 'margin:12px 0 4px;padding:10px 12px;border-radius:12px;background:rgba(11,133,60,.08);color:#0B853C;font-size:13px;font-weight:700;line-height:1.6;text-align:center';
      proCard.appendChild(periodEl);
    }

    if (periodEl) {
      if (currentTier === 'pro' && proStartedAt && proExpiresAt) {
        const formatDate = value => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
        periodEl.textContent = `เริ่ม ${formatDate(proStartedAt)} • หมดอายุ ${formatDate(proExpiresAt)}`;
        periodEl.style.display = 'block';
      } else {
        periodEl.style.display = 'none';
      }
    }

    if (currentTier === 'pro') {
      // Free Plan card -> Disabled base plan style
      if (freeBtn) {
        freeBtn.textContent = t('free_plan_name', 'FREE');
        freeBtn.disabled = true;
        freeBtn.className = 'plan-btn btn-current';
        freeBtn.onclick = null;
      }

      // Pro Plan card -> Current package status
      if (proBtn) {
        proBtn.textContent = t('current_plan_btn', 'แพ็กเกจปัจจุบัน');
        proBtn.disabled = true;
        proBtn.className = 'plan-btn btn-current';
        proBtn.onclick = null;
      }

      // Show cancel link below Pro card
      if (cancelSubWrap) cancelSubWrap.style.display = 'block';
      if (cancelSubLink) {
        cancelSubLink.onclick = async (e) => {
          e.preventDefault();
          const confirmText = t('confirm_cancel_sub', 'คุณแน่ใจหรือไม่ที่จะยกเลิกแพ็กเกจ PRO?');

          const runCancel = async () => {
            cancelSubLink.style.pointerEvents = 'none';
            cancelSubLink.textContent = t('processing', 'กำลังดำเนินการ...');
            try {
              let res;
              if (api.call) {
                res = await api.call('POST', '/api/payments/cancel');
              } else {
                const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
                const token = localStorage.getItem('token');
                const response = await fetch(currentBase + '/api/payments/cancel', {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                });
                res = await response.json();
              }

              if (res && res.success) {
                if (res.data && res.data.token) {
                  localStorage.setItem('token', res.data.token);
                  const rawUser = localStorage.getItem("user_data");
                  if (rawUser) {
                    const user = JSON.parse(rawUser);
                    user.tier = res.data.tier || currentTier;
                    localStorage.setItem("user_data", JSON.stringify(user));
                  }
                }
                alert(res.message || t('cancel_success', 'ยกเลิกการต่ออายุแล้ว คุณยังใช้ PRO ได้จนถึงวันหมดอายุ'));
                window.location.reload();
              } else {
                throw new Error(res?.error || res?.message || 'Cancel rejected');
              }
            } catch (err) {
              console.error('[Subscription] Cancel failed:', err);
              alert(err.message || t('error_occurred', 'เกิดข้อผิดพลาด'));
              cancelSubLink.style.pointerEvents = 'auto';
              cancelSubLink.textContent = t('cancel_sub_btn', 'ยกเลิกการสมัคร PRO');
            }
          };

          if (window.showConfirm) {
            window.showConfirm(confirmText, (agreed) => {
              if (agreed) runCancel();
            });
          } else {
            window.showAlert?.(confirmText, 'info');
          }
        };
      }
    } else {
      // Free Plan card -> Current package status
      if (freeBtn) {
        freeBtn.textContent = t('current_plan_btn', 'แพ็กเกจปัจจุบัน');
        freeBtn.disabled = true;
        freeBtn.className = 'plan-btn btn-current';
        freeBtn.onclick = null;
      }

      // Pro Plan card -> Upgrade option
      if (proBtn) {
        proBtn.textContent = t('upgrade_pro_btn', 'อัปเกรดเป็น Pro');
        proBtn.disabled = false;
        proBtn.className = 'plan-btn btn-upgrade';
        proBtn.onclick = () => {
          window.location.href = 'payment.html';
        };
      }

      // Hide cancel link below Pro card
      if (cancelSubWrap) cancelSubWrap.style.display = 'none';
    }
  }

  // Scroll detection for dots
  if (carousel && dots.length === 2) {
    // Scroll to active plan after short delay
    setTimeout(() => {
      const activeCardClass = currentTier === 'pro' ? '.pro-plan' : '.free-plan';
      const activeCard = document.querySelector(activeCardClass);
      if (activeCard) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 400);

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

  // Load state
  checkCurrentSubscription();
});
