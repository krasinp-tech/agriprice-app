/**
 * early-init.js
 * Initialize theme and other critical settings early.
 */
(function() {
    const savedTheme = localStorage.getItem('agriprice_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

})();
