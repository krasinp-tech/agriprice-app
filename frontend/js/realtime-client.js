(function initAgriPriceRealtime() {
  if (window.__AGRIPRICE_REALTIME_READY) return;
  window.__AGRIPRICE_REALTIME_READY = true;

  let controller = null;
  let retryTimer = null;
  let retryMs = 1000;

  function emit(change) {
    const type = String(change?.type || 'data');
    window.dispatchEvent(new CustomEvent('agriprice:realtime', { detail: change }));
    window.dispatchEvent(new CustomEvent(`agriprice:realtime:${type}`, { detail: change }));

    if (type === 'notification') {
      window.dispatchEvent(new CustomEvent('agriprice:notifications-refresh'));
    }
  }

  function parseBlock(block) {
    const data = block.split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (!data) return;
    try { emit(JSON.parse(data)); } catch (_) {}
  }

  function scheduleReconnect() {
    if (retryTimer || document.hidden || !navigator.onLine) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, 30000);
  }

  async function connect() {
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
    const base = window.getAgriPriceApiUrl?.() || window.API_BASE_URL || '';
    if (!token || !base || controller || document.hidden) return;

    controller = new AbortController();
    try {
      if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
      const response = await fetch(base.replace(/\/$/, '') + '/api/realtime/stream', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (response.status === 401) {
        window.api?.clearAuth?.();
        window.AuthGuard?.logout?.();
        return;
      }
      if (!response.ok || !response.body) throw new Error(`Realtime ${response.status}`);

      retryMs = 1000;
      window.dispatchEvent(new CustomEvent('agriprice:realtime-status', { detail: { connected: true } }));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';
        blocks.forEach(parseBlock);
      }
    } catch (error) {
      if (error?.name !== 'AbortError' && window.AGRIPRICE_DEBUG) console.warn('[Realtime]', error.message);
    } finally {
      controller = null;
      window.dispatchEvent(new CustomEvent('agriprice:realtime-status', { detail: { connected: false } }));
      scheduleReconnect();
    }
  }

  function disconnect() {
    controller?.abort();
    controller = null;
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) disconnect();
    else connect();
  });
  window.addEventListener('online', connect);
  window.addEventListener('offline', disconnect);
  window.addEventListener('beforeunload', disconnect);

  window.AgriPriceRealtime = { connect, disconnect };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect);
  else connect();
})();
