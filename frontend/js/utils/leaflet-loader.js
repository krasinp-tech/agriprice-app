(function () {
  if (window.LeafletReady) return;

  const cssHref = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  if (!document.querySelector('link[data-agriprice-leaflet]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = cssHref;
    stylesheet.dataset.agripriceLeaflet = 'true';
    document.head.appendChild(stylesheet);
  }

  window.LeafletReady = new Promise((resolve, reject) => {
    if (window.L?.map) {
      resolve(window.L);
      return;
    }

    let script = document.getElementById('leafletLibrary');
    const timeoutId = setTimeout(() => reject(new Error('Leaflet load timeout')), 12000);
    const finish = (callback) => {
      clearTimeout(timeoutId);
      callback();
    };

    const shouldAppend = !script;
    if (shouldAppend) {
      script = document.createElement('script');
      script.id = 'leafletLibrary';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
    }

    script.addEventListener('load', () => finish(() => {
      if (window.L?.map) resolve(window.L);
      else reject(new Error('Invalid Leaflet library response'));
    }), { once: true });
    script.addEventListener('error', () => finish(() => reject(new Error('Failed to load Leaflet'))), { once: true });
    if (shouldAppend) document.head.appendChild(script);
  }).catch((error) => {
    console.warn('[Leaflet Loader]', error?.message || error);
    throw new Error('ไม่สามารถโหลดแผนที่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
  });

  // Consumers await the same promise when map functionality is requested.
  window.LeafletReady.catch(() => {});
})();
