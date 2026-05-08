// Global animation helper for fade-slide and modal-fade
(function(){
  function animateOnLoad() {
    document.querySelectorAll('.fade-slide').forEach(el => {
      if (!el.classList.contains('show')) {
        setTimeout(() => el.classList.add('show'), 60);
      }
    });
    document.querySelectorAll('.modal-fade').forEach(el => {
      // Modal will be shown/hidden by JS, so .show is handled elsewhere
      // This ensures modal-content animates when .show is toggled
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateOnLoad);
  } else {
    animateOnLoad();
  }

  // MutationObserver: trigger animation for new .fade-slide elements
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains('fade-slide')) {
            setTimeout(() => node.classList.add('show'), 60);
          }
          // Also check descendants
          node.querySelectorAll && node.querySelectorAll('.fade-slide').forEach(el => {
            if (!el.classList.contains('show')) {
              setTimeout(() => el.classList.add('show'), 60);
            }
          });
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
