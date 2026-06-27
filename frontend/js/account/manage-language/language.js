(function() {
  "use strict";

  function init() {
    // i18n logic is now centralized in i18n.js
    // setupLanguageSelector() in i18n.js handles the #langSelector if it exists.
    
    // Add any page-specific logic here (e.g. animation or specific tracking)
    console.log('[LanguagePage] UI Initialized');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
