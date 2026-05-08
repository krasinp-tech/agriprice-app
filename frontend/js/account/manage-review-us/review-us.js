/**
 * AGRIPRICE - Review Us JS
 */
document.addEventListener('DOMContentLoaded', () => {
    const starBtns = document.querySelectorAll('.star-btn');
    const submitBtn = document.getElementById('submitReviewBtn');
    const feedbackText = document.getElementById('feedbackText');
    let currentRating = 0;

    // ── Star Selection Logic ────────────────────────────
    starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRating = parseInt(btn.dataset.value);
            updateStars(currentRating);
            
            // Add a little bounce effect on click
            btn.style.transform = 'scale(1.3)';
            setTimeout(() => btn.style.transform = '', 200);
        });
    });

    function updateStars(rating) {
        starBtns.forEach(btn => {
            const val = parseInt(btn.dataset.value);
            if (val <= rating) {
                btn.classList.add('active');
                btn.querySelector('.material-icons-outlined').textContent = 'star';
            } else {
                btn.classList.remove('active');
                btn.querySelector('.material-icons-outlined').textContent = 'star_border';
            }
        });
    }

    // ── Submit Logic ────────────────────────────────────
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (currentRating === 0) {
                const pleaseRateText = window.i18nT ? window.i18nT('please_rate', 'กรุณาให้คะแนนดาวก่อนส่งรีวิวครับ') : 'กรุณาให้คะแนนดาวก่อนส่งรีวิวครับ';
                if (window.appNotify) window.appNotify(pleaseRateText, 'error');
                else console.warn(pleaseRateText);
                return;
            }

            // UI Feedback: Loading state
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = window.i18nT ? window.i18nT('sending', 'กำลังส่ง...') : 'กำลังส่ง...';
            submitBtn.style.opacity = '0.7';

            // Simulate API Call
            setTimeout(() => {
                // Success State
                const card = document.querySelector('.review-card');
                card.innerHTML = `
                    <div class="fade-slide" style="padding: 20px 0;">
                        <span style="font-size: 64px; display: block; margin-bottom: 16px;">🎉</span>
                        <h2 style="font-size: 20px; font-weight: 800; color: var(--primary); margin-bottom: 8px;">${window.i18nT ? window.i18nT('thank_you_review', 'ขอบคุณสำหรับรีวิว!') : 'ขอบคุณสำหรับรีวิว!'}</h2>
                        <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 24px;">${window.i18nT ? window.i18nT('feedback_value', 'ความคิดเห็นของคุณมีค่ามากสำหรับเรา') : 'ความคิดเห็นของคุณมีค่ามากสำหรับเรา'}</p>
                        <button class="btn-submit-review" onclick="window.location.href='../account.html'">${window.i18nT ? window.i18nT('back_to_account', 'กลับหน้าบัญชี') : 'กลับหน้าบัญชี'}</button>
                    </div>
                `;
            }, 1500);
        });
    }
});