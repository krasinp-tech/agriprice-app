(function() {
  if (window.__AGRIPRICE_STORAGE_KEYS_READY) return;
  window.__AGRIPRICE_STORAGE_KEYS_READY = true;

  const STORAGE_KEYS = {
    TOKEN: 'token',
    ROLE: 'role',
    THEME: 'agriprice_theme',
    USER_DATA: 'user_data',
    LANGUAGE: 'language',
    AVATAR: (role) => `profile_avatar_dataurl_${role || 'guest'}`,
    PROFILE: (role) => `myprofile_data_${role || 'guest'}`,
  };

  window.STORAGE_KEYS = STORAGE_KEYS;
})();
