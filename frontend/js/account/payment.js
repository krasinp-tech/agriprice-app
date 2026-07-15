(function () {
  'use strict';
  const notify = (message, type = 'success') => window.showToast?.(message, type) || window.appNotify?.(message, type);
  const apiBase = () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : String(window.API_BASE_URL || '').replace(/\/$/, '');
  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || ''}` });

  document.addEventListener('DOMContentLoaded', async () => {
    const byId = id => document.getElementById(id);
    const qr = byId('promptpayQr'), loading = byId('qrLoading'), amount = byId('promptpayAmount');
    const input = byId('slipInput'), picker = byId('slipPicker'), pickerText = byId('slipPickerText');
    const preview = byId('slipPreview'), submit = byId('checkoutBtn'), timerDigits = byId('timerDigits');
    let qrReady = false, remaining = 900;
    document.querySelector('.back-btn')?.addEventListener('click', () => window.goBackOrFallback('account.html'));
    picker?.addEventListener('click', () => input.click());
    input?.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) { input.value = ''; return notify('รูปสลิปต้องมีขนาดไม่เกิน 4 MB', 'error'); }
      pickerText.textContent = file.name;
      preview.src = URL.createObjectURL(file);
      preview.hidden = false;
    });

    try {
      const response = await fetch(`${apiBase()}/api/payments/promptpay/qr`, { headers: auth() });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'สร้าง QR ไม่สำเร็จ');
      qr.src = `data:${result.data.mime || 'image/png'};base64,${result.data.image}`;
      qr.hidden = false; loading.hidden = true; qrReady = true;
      amount.textContent = `฿${Number(result.data.amount).toFixed(2)}`;
    } catch (error) {
      loading.textContent = error.message; submit.disabled = true; notify(error.message, 'error');
    }

    const timer = setInterval(() => {
      remaining--;
      timerDigits.textContent = `${String(Math.floor(Math.max(remaining, 0) / 60)).padStart(2, '0')}:${String(Math.max(remaining, 0) % 60).padStart(2, '0')}`;
      if (remaining <= 0) { clearInterval(timer); qrReady = false; submit.disabled = true; notify('QR หมดเวลา กรุณาเปิดหน้านี้ใหม่', 'warning'); }
    }, 1000);

    submit?.addEventListener('click', async () => {
      const file = input.files?.[0];
      if (!qrReady) return notify('QR ยังไม่พร้อม กรุณาลองใหม่', 'error');
      if (!file) return notify('กรุณาแนบรูปสลิปก่อนยืนยัน', 'warning');
      const original = submit.innerHTML;
      submit.disabled = true; submit.innerHTML = '<span>กำลังตรวจสอบสลิป...</span>';
      try {
        const form = new FormData(); form.append('slip', file);
        const response = await fetch(`${apiBase()}/api/payments/promptpay/verify`, { method: 'POST', headers: auth(), body: form });
        const result = await response.json();
        if (!response.ok && response.status !== 202) throw new Error(result.message || 'ตรวจสอบสลิปไม่สำเร็จ');
        if (result.data?.token) {
          localStorage.setItem(window.AUTH_TOKEN_KEY || 'token', result.data.token);
          const key = window.AUTH_USER_KEY || 'user_data', raw = localStorage.getItem(key);
          if (raw) { const user = JSON.parse(raw); user.tier = 'pro'; localStorage.setItem(key, JSON.stringify(user)); }
          notify(result.message, 'success');
          return setTimeout(() => { location.href = 'subscription.html'; }, 1200);
        }
        notify(result.message || 'ส่งสลิปเพื่อรอตรวจสอบแล้ว', 'warning');
        submit.innerHTML = '<span>ส่งสลิปแล้ว • รอตรวจสอบ</span>';
      } catch (error) { notify(error.message, 'error'); submit.disabled = false; submit.innerHTML = original; }
    });
  });
})();
