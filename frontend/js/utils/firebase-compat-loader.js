(function () {
  if (window.FirebaseCompatReady) return;

  const loadScript = (id, src, isReady) => new Promise((resolve, reject) => {
    if (isReady()) {
      resolve();
      return;
    }

    let script = document.getElementById(id);
    const timeoutId = setTimeout(() => reject(new Error(`Timed out loading ${src}`)), 12000);
    const finish = (callback) => {
      clearTimeout(timeoutId);
      callback();
    };

    const shouldAppend = !script;
    if (shouldAppend) {
      script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
    }

    script.addEventListener('load', () => finish(() => {
      if (isReady()) resolve();
      else reject(new Error(`Invalid library response from ${src}`));
    }), { once: true });
    script.addEventListener('error', () => finish(() => reject(new Error(`Failed to load ${src}`))), { once: true });
    if (shouldAppend) document.head.appendChild(script);
  });

  window.FirebaseCompatReady = (async () => {
    await loadScript(
      'firebaseAppCompatLibrary',
      'https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js',
      () => typeof window.firebase?.initializeApp === 'function'
    );
    await loadScript(
      'firebaseAuthCompatLibrary',
      'https://www.gstatic.com/firebasejs/9.6.10/firebase-auth-compat.js',
      () => typeof window.firebase?.auth === 'function'
    );
    return window.firebase;
  })().catch((error) => {
    console.warn('[Firebase Loader]', error?.message || error);
    throw new Error('ไม่สามารถโหลดระบบ OTP ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  });

  // Prevent an unhandled rejection before the user starts an OTP action.
  window.FirebaseCompatReady.catch(() => {});
})();
