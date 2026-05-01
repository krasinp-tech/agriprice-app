document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('backBtn');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const carousel = document.querySelector('.plans-carousel');
  const dots = document.querySelectorAll('.dot');

  // Go back
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      // Go back to previous page or dashboard
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
      // Navigate to payment page
      window.location.href = 'payment.html';
    });
  }

  // Scroll detection for dots
  if (carousel && dots.length === 2) {
    // Scroll to the second card (Pro Plan) by default on load
    // to match the "active" dot in the design and encourage upgrading
    setTimeout(() => {
      const proCard = document.querySelector('.pro-plan');
      if(proCard) {
        proCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 300);

    carousel.addEventListener('scroll', () => {
      const scrollLeft = carousel.scrollLeft;
      const cardWidth = carousel.querySelector('.plan-card').offsetWidth;
      
      // If scrolled past half of first card, switch dot
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
