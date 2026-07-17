document.addEventListener('DOMContentLoaded', () => {
  "use strict";

  if (window.AuthGuard && !window.AuthGuard.isLoggedIn()) return;
  const signedInRole = window.api?.getRole?.() || localStorage.getItem('role');
  if (String(signedInRole || '').toLowerCase() !== 'buyer') {
    window.location.replace('account.html');
    return;
  }

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

  // Bind navigation immediately so a fast tap cannot happen before the
  // asynchronous profile request finishes. The disabled state still blocks
  // this action when PRO is already the current package.
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      if (!upgradeBtn.disabled && currentTier !== 'pro') {
        window.location.href = 'payment.html';
      }
    });
  }

  // Check current subscription from API
  async function checkCurrentSubscription() {
    try {
      const planResponse = await api.call?.('GET', '/api/payments/plan');
      const plan = planResponse?.data || planResponse;
      if (Number.isFinite(Number(plan?.amount))) {
        document.querySelectorAll('.pro-plan .amount').forEach(el => {
          el.textContent = Number(plan.amount).toLocaleString('th-TH');
        });
      }
    } catch (_) {}

    try {
      if (api.getProfile) {
        const profile = await api.getProfile();
        if (profile && profile.tier) {
          currentTier = profile.tier.toLowerCase();
          proStartedAt = profile.pro_started_at || null;
          proExpiresAt = profile.pro_expires_at || null;
          if (currentTier === 'pro' && proExpiresAt && new Date(proExpiresAt) <= new Date()) {
            currentTier = 'free';
          }
          
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
        const lang = localStorage.getItem('lang') || 'th';
        const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';
        const formatDate = value => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
        periodEl.textContent = t('subscription_period', 'เริ่ม {start} • หมดอายุ {end}')
          .replace('{start}', formatDate(proStartedAt)).replace('{end}', formatDate(proExpiresAt));
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
      }

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
