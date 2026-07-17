(function () {
  'use strict';
  const t = (key, fallback, params) => window.i18nT ? window.i18nT(key, fallback, params) : fallback;
  const notify = (message, type = 'success') => window.showToast?.(message, type) || window.appNotify?.(message, type);
  const apiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : String(window.API_BASE_URL || '').replace(/\/$/, '');
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || ''}` });

  document.addEventListener('DOMContentLoaded', async () => {
    if (window.AuthGuard && !window.AuthGuard.isLoggedIn()) return;
    const signedInRole = window.api?.getRole?.() || localStorage.getItem('role');
    if (String(signedInRole || '').toLowerCase() !== 'buyer') {
      window.location.replace('account.html');
      return;
    }

    const byId = id => document.getElementById(id);
    const qr = byId('promptpayQr'), loading = byId('qrLoading'), amount = byId('promptpayAmount');
    const planPriceAmount = byId('planPriceAmount'), slipVerificationNote = byId('slipVerificationNote');
    const input = byId('slipInput'), picker = byId('slipPicker'), pickerText = byId('slipPickerText');
    const preview = byId('slipPreview'), submit = byId('checkoutBtn'), timerDigits = byId('timerDigits');
    const successOverlay = byId('paymentSuccessOverlay'), successContinueBtn = byId('successContinueBtn');
    let qrReady = false, remaining = 900, redirectTimer = null;

    const goToSubscription = () => {
      if (redirectTimer) clearTimeout(redirectTimer);
      window.location.href = 'subscription.html';
    };

    const showPaymentSuccess = () => {
      clearInterval(timer);
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const redirectDelay = reduceMotion ? 900 : 2400;
      if (!successOverlay) return goToSubscription();

      successOverlay.style.setProperty('--success-duration', `${redirectDelay}ms`);
      successOverlay.hidden = false;
      document.body.classList.add('payment-success-active');
      window.requestAnimationFrame(() => successOverlay.classList.add('is-visible'));
      successContinueBtn?.focus({ preventScroll: true });
      redirectTimer = window.setTimeout(goToSubscription, redirectDelay);
    };

    successContinueBtn?.addEventListener('click', goToSubscription);
    document.querySelector('.back-btn')?.addEventListener('click', () => window.goBackOrFallback('account.html'));
    picker?.addEventListener('click', () => input.click());
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { input.value = ''; return notify(t('slip_too_large', 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB'), 'error'); }
      pickerText.textContent = file.name;
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    try {
      const response = await fetch(`${apiBase()}/api/payments/promptpay/qr`, { headers: auth() });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(window.i18nApiMessage?.(result.message, 'payment_failed') || result.message || t('payment_failed', 'สร้าง QR ไม่สำเร็จ'));
      qr.src = `data:${result.data.mime || 'image/png'};base64,${result.data.image}`;
      qr.hidden = false; loading.hidden = true; qrReady = true;
      const payableAmount = Number(result.data.amount);
      amount.textContent = `฿${payableAmount.toFixed(2)}`;
      if (planPriceAmount) planPriceAmount.textContent = payableAmount.toLocaleString('th-TH');
      if (slipVerificationNote) {
        slipVerificationNote.textContent = t('slip_verification_note_dynamic', 'ระบบจะตรวจยอด {amount} บาท บัญชีผู้รับ และป้องกันการใช้สลิปซ้ำ', { amount: payableAmount.toLocaleString('th-TH') });
        slipVerificationNote.removeAttribute('data-i18n');
      }
    } catch (error) {
      loading.textContent = error.message; submit.disabled = true; notify(error.message, 'error');
    }

    const timer = setInterval(() => {
      remaining--;
      timerDigits.textContent = `${String(Math.floor(Math.max(remaining, 0) / 60)).padStart(2, '0')}:${String(Math.max(remaining, 0) % 60).padStart(2, '0')}`;
      if (remaining <= 0) { clearInterval(timer); qrReady = false; submit.disabled = true; notify(t('payment_timeout', 'QR หมดเวลา กรุณาเปิดหน้านี้ใหม่'), 'warning'); }
    }, 1000);

    submit?.addEventListener('click', async () => {
      const file = input.files?.[0];
      if (!qrReady) return notify(t('qr_not_ready', 'QR ยังไม่พร้อม กรุณาลองใหม่'), 'error');
      if (!file) return notify(t('slip_required', 'กรุณาแนบรูปสลิปก่อนยืนยัน'), 'warning');
      const original = submit.innerHTML;
      submit.disabled = true; submit.innerHTML = `<span>${window.i18nT ? window.i18nT('verifying_slip', 'กำลังตรวจสอบสลิป...') : 'กำลังตรวจสอบสลิป...'}</span>`;
      try {
        const form = new FormData(); form.append('slip', file);
        const response = await fetch(`${apiBase()}/api/payments/promptpay/verify`, { method: 'POST', headers: auth(), body: form });
        const result = await response.json();
        if (!response.ok && response.status !== 202) throw new Error(window.i18nApiMessage?.(result.message, 'payment_failed') || result.message || t('payment_failed', 'ตรวจสอบสลิปไม่สำเร็จ'));
        if (result.data?.token) {
          localStorage.setItem(window.AUTH_TOKEN_KEY || 'token', result.data.token);
          const key = window.AUTH_USER_KEY || 'user_data', raw = localStorage.getItem(key);
          try {
            if (raw) {
              const user = JSON.parse(raw);
              user.tier = 'pro';
              user.pro_started_at = result.data.pro_started_at || user.pro_started_at;
              user.pro_expires_at = result.data.pro_expires_at || user.pro_expires_at;
              localStorage.setItem(key, JSON.stringify(user));
            }
          } catch (_) {}
          showPaymentSuccess();
          return;
        }
        notify(t('slip_submitted_pending', result.message || 'ส่งสลิปเพื่อรอตรวจสอบแล้ว'), 'warning');
        submit.innerHTML = `<span>${window.i18nT ? window.i18nT('slip_submitted_pending', 'ส่งสลิปแล้ว • รอตรวจสอบ') : 'ส่งสลิปแล้ว • รอตรวจสอบ'}</span>`;
      } catch (error) { notify(error.message, 'error'); submit.disabled = false; submit.innerHTML = original; }
    });
  });
})();
