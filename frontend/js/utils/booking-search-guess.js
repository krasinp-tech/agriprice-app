(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('searchInput');
    const mount = document.getElementById('bookingList');
    if (!input || !mount) return;

    const list = document.createElement('datalist');
    list.id = `booking-search-${Math.random().toString(36).slice(2)}`;
    input.setAttribute('list', list.id);
    input.after(list);

    const update = () => {
      const values = new Set();
      mount.querySelectorAll('.booking-card').forEach(card => {
        [
          card.dataset.id,
          card.querySelector('.shop')?.textContent,
          card.querySelector('.queueNo')?.textContent,
          ...[...card.querySelectorAll('.meta')].map(el => el.textContent)
        ].forEach(value => {
          const clean = String(value || '').trim();
          if (clean && clean !== '-') values.add(clean);
        });
      });
      list.replaceChildren(...[...values].slice(0, 80).map(value => {
        const option = document.createElement('option');
        option.value = value;
        return option;
      }));
    };

    new MutationObserver(update).observe(mount, { childList: true, subtree: true });
    update();
  });
})();
