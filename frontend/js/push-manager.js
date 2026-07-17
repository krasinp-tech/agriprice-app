(function() {
  "use strict";

  if (window.__AGRIPRICE_PUSH_MANAGER_READY) return;
  window.__AGRIPRICE_PUSH_MANAGER_READY = true;

  let registrationInFlight = false;
  let listenersAttached = false;

  function getPushPlugin() {
    const cap = window.Capacitor;
    if (!cap || !cap.isPluginAvailable || !cap.isPluginAvailable('PushNotifications')) return null;
    return cap.Plugins?.PushNotifications || null;
  }

  async function removeListener(handle) {
    try {
      if (handle && handle.remove) await handle.remove();
    } catch (_) {}
  }

  async function registerPush() {
    if (registrationInFlight) return;
    registrationInFlight = true;

    try {
      const PushNotifications = getPushPlugin();
      if (!PushNotifications) {
        if (window.AGRIPRICE_DEBUG) console.log('[Push] Native push notifications are not available');
        return;
      }

      const permStatus = await PushNotifications.requestPermissions();

      if (permStatus.receive !== 'granted') {
        console.warn('[Push] Permission not granted for push notifications');
        return;
      }

      const token = await new Promise((resolve, reject) => {
        let timeoutId;
        let successListener;
        let errorListener;

        const cleanup = async () => {
          clearTimeout(timeoutId);
          await removeListener(successListener);
          await removeListener(errorListener);
        };

        (async () => {
          successListener = await PushNotifications.addListener('registration', async (t) => {
            await cleanup();
            if (t?.value) resolve(t.value);
            else reject(new Error('Push token is empty'));
          });

          errorListener = await PushNotifications.addListener('registrationError', async (err) => {
            await cleanup();
            reject(err instanceof Error ? err : new Error(err?.error || err?.message || 'Push registration failed'));
          });

          timeoutId = setTimeout(async () => {
            await cleanup();
            reject(new Error('Push Registration Timeout'));
          }, 10000);

          await PushNotifications.register();
        })().catch(async (err) => {
          await cleanup();
          reject(err);
        });
      });

      const api = window.api || {};
      if (api.updatePushToken) {
        await api.updatePushToken(token, 'native');
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const authToken = localStorage.getItem('token');
        if (!authToken) return;

        await fetch(currentBase + '/api/notifications/push-token', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
      }
      if (window.AGRIPRICE_DEBUG) console.log('[Push] Token registered successfully');
    } catch (err) {
      console.error('[Push] Registration failed:', err);
    } finally {
      registrationInFlight = false;
    }
  }

  async function attachPushListeners() {
    if (listenersAttached) return;

    const PushNotifications = getPushPlugin();
    if (!PushNotifications) return;

    listenersAttached = true;

    try {
      await PushNotifications.addListener('pushNotificationReceived', () => {
        window.dispatchEvent(new CustomEvent('agriprice:notifications-refresh'));
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
        const link = event?.notification?.data?.link;
        if (!link) return;
        if (window.navigateWithTransition) window.navigateWithTransition(link);
        else window.location.href = link;
      });
    } catch (err) {
      listenersAttached = false;
      console.error('[Push] Listener setup failed:', err);
    }
  }

  function autoRegisterWhenLoggedIn() {
    if (!localStorage.getItem('token')) return;
    const register = () => {
      attachPushListeners();
      registerPush();
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 3000 });
    else setTimeout(register, 1500);
  }

  window.AgriPushManager = {
    forceRegister: registerPush,
    registerPush
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoRegisterWhenLoggedIn);
  } else {
    autoRegisterWhenLoggedIn();
  }
})();
