/**
 * AGRIPRICE - Review Us
 */
document.addEventListener('DOMContentLoaded', () => {
  const starBtns = document.querySelectorAll('.star-btn');
  const submitBtn = document.getElementById('submitReviewBtn');
  const feedbackText = document.getElementById('feedbackText');
  let currentRating = 0;

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : fallback;
  }

  function notify(message, type = 'success') {
    if (window.appNotify) window.appNotify(message, type);
    else if (window.showToast) window.showToast(message, type);
    else if (type === 'error') console.error(message);
  }

  starBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentRating = Number(btn.dataset.value || 0);
      updateStars(currentRating);
      btn.style.transform = 'scale(1.3)';
      setTimeout(() => { btn.style.transform = ''; }, 200);
    });
  });

  function updateStars(rating) {
    starBtns.forEach((btn) => {
      const value = Number(btn.dataset.value || 0);
      const icon = btn.querySelector('.material-icons-outlined');
      if (value <= rating) {
        btn.classList.add('active');
        if (icon) icon.textContent = 'star';
      } else {
        btn.classList.remove('active');
        if (icon) icon.textContent = 'star_border';
      }
    });
  }

  function renderSuccess() {
    const card = document.querySelector('.review-card');
    if (!card) return;
    card.innerHTML = `
      <div class="fade-slide" style="padding: 20px 0;">
        <span style="font-size: 64px; display: block; margin-bottom: 16px;">✓</span>
        <h2 style="font-size: 20px; font-weight: 800; color: var(--primary); margin-bottom: 8px;">${t('thank_you_review', 'ขอบคุณสำหรับรีวิว!')}</h2>
        <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">${t('feedback_value', 'ความคิดเห็นของคุณมีค่ามากสำหรับเรา')}</p>
        <button class="btn-submit-review" onclick="window.location.href='../account.html'">${t('back_to_account', 'กลับหน้าบัญชี')}</button>
      </div>
    `;
  }

  async function submitReview() {
    if (currentRating === 0) {
      notify(t('please_rate', 'กรุณาให้คะแนนดาวก่อนส่งรีวิวครับ'), 'error');
      return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = t('sending', 'กำลังส่ง...');
    submitBtn.style.opacity = '0.7';

    try {
      const payload = {
        rating: currentRating,
        comment: (feedbackText?.value || '').trim(),
      };

      const res = window.api?.submitAppReview
        ? await window.api.submitAppReview(payload)
        : await window.api.call('POST', '/api/reviews/app', payload);

      if (!res || !res.success) {
        throw new Error(res?.message || t('review_submit_failed', 'ส่งรีวิวไม่สำเร็จ'));
      }

      renderSuccess();
    } catch (err) {
      console.error('[Review] Submit failed:', err);
      notify(err.message || t('review_submit_failed', 'ส่งรีวิวไม่สำเร็จ'), 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      submitBtn.style.opacity = '';
    }
  }

  submitBtn?.addEventListener('click', submitReview);
});
