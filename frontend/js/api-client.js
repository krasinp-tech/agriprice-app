/**
 * js/api-client.js - AgriPrice v2
 * ไฟล์นี้ทำหน้าที่เป็น "สะพานเชื่อม" (API Client) ระหว่าง Frontend กับ Backend
 * รวมฟังก์ชันการดึงข้อมูลทั้งหมดไว้ที่เดียว เพื่อให้ง่ายต่อการดูแลและเรียกใช้งานซ้ำ (Reusable)
 */
(function () {
  if (window.__AGRIPRICE_API_READY) return;
  window.__AGRIPRICE_API_READY = true;
  const IS_EMBEDDED_FRAME = (() => {
    try { return window.self !== window.top; } catch (_) { return true; }
  })();

  // ใช้ helper function เพื่อให้ได้ค่า BASE ล่าสุดเสมอ (เผื่อมีการสลับไป Render fallback)
  const getBase = () => {
    const rawBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
    if (sessionStorage.getItem('agriprice_local_failed') === 'true') {
      if (rawBase.includes('localhost') || rawBase.includes('127.0.0.1')) {
        return 'https://agriprice-app.onrender.com';
      }
    }
    return rawBase;
  };
  const KEYS = window.STORAGE_KEYS || { TOKEN: 'token', ROLE: 'role', USER_DATA: 'user_data' };

  // --- 1. Helpers (ตัวช่วยจัดการ Authentication & Token) ---

  // คำนวณ URL ของหน้า login แบบ relative จาก path ปัจจุบัน
  // ทำงานได้ถูกต้องไม่ว่า Live Server จะ serve จาก /frontend/ หรือ /
  function getLoginUrl() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    const dir = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    const pagesIdx = dir.lastIndexOf('/pages/');
    if (pagesIdx !== -1) {
      // อยู่ใน /pages/... ให้ถอยหลังออกมา
      const afterPages = dir.substring(pagesIdx + '/pages/'.length);
      const depth = afterPages.split('/').filter(Boolean).length;
      return '../'.repeat(depth + 1) + 'pages/auth/login1.html';
    }
    // อยู่ที่ root ของ frontend (เช่น index.html)
    return 'pages/auth/login1.html';
  }

  const getToken = () => localStorage.getItem(KEYS.TOKEN) || '';
  const setToken = t => localStorage.setItem(KEYS.TOKEN, t);
  const getRole = () => String(localStorage.getItem(KEYS.ROLE) || 'guest').toLowerCase();
  const setRole = r => localStorage.setItem(KEYS.ROLE, String(r || 'guest').toLowerCase());
  const getUser = () => {
    try {
      const raw = localStorage.getItem(KEYS.USER_DATA);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      if (window.AGRIPRICE_DEBUG) console.warn('[API] Error parsing user data:', err);
      return null;
    }
  };
  const setUser = u => localStorage.setItem(KEYS.USER_DATA, JSON.stringify(u));
  const isLoggedIn = () => !!getToken() && getRole() !== 'guest';

  const clearAuth = () => {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.USER_DATA);
    localStorage.removeItem(KEYS.ROLE);
    // Option: ล้างค่าอื่นๆ ที่เกี่ยวข้องกับ Session
    localStorage.removeItem('agriprice_favorites_v1');
  };

  const persistAuth = (token, user) => {
    if (token) setToken(token);
    if (user) {
      setUser(user);
      if (user.role) setRole(user.role);
    }
  };

  const t_helper = (k, f) => window.i18nT ? window.i18nT(k, f) : f;

  const CACHE_PREFIX = 'agriprice_api_cache_v1:';
  const CACHEABLE_GET = [/^\/api\/products/, /^\/api\/product-types/, /^\/api\/varieties/, /^\/api\/announcements/, /^\/api\/gov-prices/];
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isCacheable = (method, path) => method === 'GET' && CACHEABLE_GET.some(rule => rule.test(path));
  function readCache(path) {
    try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + path) || 'null')?.data || null; } catch (_) { return null; }
  }
  function writeCache(path, data) {
    try { localStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ savedAt: Date.now(), data })); } catch (_) {}
  }
  function cachedResponse(path) {
    const cached = readCache(path);
    if (!cached) return null;
    return Array.isArray(cached) ? cached : { ...cached, offline: true, from_cache: true };
  }
  function setOfflineState(offline) {
    document.documentElement.classList.toggle('is-offline', offline);
    window.dispatchEvent(new CustomEvent('agriprice:network', { detail: { offline } }));
  }
  window.addEventListener('online', () => setOfflineState(false));
  window.addEventListener('offline', () => setOfflineState(true));

  async function fetchWithRetry(url, opts, attempts) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timeout);
        setOfflineState(false);
        return response;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts) await sleep(400 * (2 ** attempt));
      }
    }
    setOfflineState(true);
    throw lastError;
  }

  // ฟังก์ชันหลักที่ใช้ยิง API ทุกตัว (จัดการเรื่องแนบ Token ให้อัตโนมัติ)
  async function call(method, path, body, isForm) {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const headers = {};
    const token = getToken();

    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isForm && body) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    let res;
    const currentBase = getBase();
    if (!currentBase) throw new Error('API Base URL not initialized');

    try {
      res = await fetchWithRetry(currentBase + path, opts, method === 'GET' ? 3 : 1);
    } catch (err) {
      if (window.AGRIPRICE_DEBUG) console.error('[API] Network Error:', err);

      // [FIX] Auto-fallback to Render if Local fails
      if (currentBase.includes('127.0.0.1') || currentBase.includes('localhost')) {
        if (window.AGRIPRICE_DEBUG) console.warn('[API] Local server unreachable. Switching to Render backend...');
        sessionStorage.setItem('agriprice_local_failed', 'true');

        try {
          const fallbackBase = 'https://agriprice-app.onrender.com';
          res = await fetchWithRetry(fallbackBase + path, opts, method === 'GET' ? 2 : 1);
        } catch (retryErr) {
          if (window.showToast) window.showToast(t_helper('server_fallback_error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์สำรองได้'));
          const cached = isCacheable(method, path) ? cachedResponse(path) : null;
          if (cached) return cached;
          throw new Error(t_helper('server_error', 'ไม่สามารถเชื่อมต่อ server ได้'));
        }
      } else {
        if (window.showToast) window.showToast(t_helper('server_retry_error', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง'));
        const cached = isCacheable(method, path) ? cachedResponse(path) : null;
        if (cached) return cached;
        throw new Error(t_helper('server_error', 'ไม่สามารถเชื่อมต่อ server ได้'));
      }
    }

    // ดักจับกรณี Token หมดอายุ (401) ให้เด้งกลับไปหน้า Login อัตโนมัติ
    if (res.status === 401) {
      // [FIX] ถ้าเป็นการพยายาม login หรือ register ไม่ต้อง redirect ให้ออก error ปกติ
      const isAuthRequest = path.includes('/auth/login') || path.includes('/auth/register/finish');

      if (!isAuthRequest) {
        if (window.AGRIPRICE_DEBUG) console.warn('[API] 401 Unauthorized - Redirecting to login');
        clearAuth();
        const loginUrl = getLoginUrl();
        if (window.navigateWithTransition) window.navigateWithTransition(loginUrl);
        else window.location.href = loginUrl;
        return null;
      }
    }

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (window.AGRIPRICE_DEBUG) console.error(`[API] ${res.status} Error:`, json.message || 'Unknown error');
      throw new Error(json.message || `${t_helper('error_occurred', 'เกิดข้อผิดพลาด')} (${res.status})`);
    }

    if (isCacheable(method, path)) writeCache(path, json);
    return json;
  }

  // --- 2. Auth (ระบบสมัครสมาชิกและล็อกอินผ่าน OTP) ---
  const otpSend = phone => call('POST', '/api/auth/otp/send', { phone });
  const otpVerify = (phone, otp) => call('POST', '/api/auth/otp/verify', { phone, otp });
  const checkPhone = phone => call('POST', '/api/auth/check-phone', { phone });
  async function registerFinish(temp_token, role, profile, password) {
    const res = await call('POST', '/api/auth/register/finish', { temp_token, role, profile, password });
    if (res && res.data) {
      const { token, user } = res.data;
      if (token) persistAuth(token, user);
      return {
        ...res,
        token: token,
        user: user
      };
    }
    return res;
  }
  const passwordReset = (temp_token, password) =>
    call('POST', '/api/auth/password/reset', { temp_token, password });
  const changePassword = (current_password, new_password) =>
    call('POST', '/api/auth/change-password', { current_password, new_password });

  async function login(phoneOrEmail, password) {
    const isEmail = String(phoneOrEmail || '').includes('@');
    const body = isEmail ? { email: phoneOrEmail, password } : { phone: phoneOrEmail, password };
    const res = await call('POST', '/api/auth/login', body);
    if (res && res.data) {
      const { token, user } = res.data;
      if (token) persistAuth(token, user);
      return {
        ...res,
        token: token,
        user: user
      };
    }
    return res;
  }

  // --- 3. Profile & Addresses (จัดการข้อมูลส่วนตัวและที่อยู่) ---
  const getProfile = () => call('GET', '/api/profile');
  const updateProfile = form => call('PATCH', '/api/profile', form, form instanceof FormData);
  const getProfileById = id => call('GET', '/api/profiles/' + id);
  const deleteProfile = reason => call('DELETE', '/api/profile', reason ? { reason } : {});

  const getAddresses = () => call('GET', '/api/addresses');
  const createAddress = body => call('POST', '/api/addresses', body);
  const updateAddress = (id, body) => call('PATCH', '/api/addresses/' + id, body);
  const deleteAddress = id => call('DELETE', '/api/addresses/' + id);

  // --- 4. Products & Favorites (จัดการประกาศและรายการโปรด) ---
  function getProducts(params) {
    const q = params ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))).toString() : '';
    return call('GET', '/api/products' + q);
  }
  function getOfferId(item) {
    if (item == null) return '';
    if (typeof item === 'string' || typeof item === 'number') return item;
    return item.offer_id ?? item.offerId ?? item.product_id ?? item.productId ?? item.id ?? '';
  }
  const getProduct = id => call('GET', '/api/products/' + id);
  const createProduct = form => call('POST', '/api/products', form, form instanceof FormData);
  const updateProduct = (id, form) => call('PATCH', '/api/products/' + id, form, form instanceof FormData);
  const deleteProduct = id => call('DELETE', '/api/products/' + id);
  const getVarieties = p => call('GET', '/api/varieties' + (p ? '?' + new URLSearchParams(p).toString() : ''));
  const getProductTypes = () => call('GET', '/api/product-types');

  const getFavorites = () => call('GET', '/api/favorites');
  const addFavorite = userId => call('POST', '/api/favorites', { user_id: userId });
  const removeFavorite = id => call('DELETE', '/api/favorites/' + id);

  // --- 5. Product Slots ---
  const getProductSlots = (offerId, p) => call('GET', `/api/products/${offerId}/slots` + (p ? '?' + new URLSearchParams(p).toString() : ''));
  const getAllSlots = p => call('GET', '/api/product-slots' + (p ? '?' + new URLSearchParams(p).toString() : ''));
  const createProductSlot = (offerId, data) => call('POST', `/api/products/${offerId}/slots`, data);
  const createSlotsBatch = data => call('POST', '/api/product-slots/batch', data);
  const updateProductSlot = (id, data) => call('PATCH', `/api/product-slots/${id}`, data);
  const deleteProductSlot = id => call('DELETE', `/api/product-slots/${id}`);

  // --- 6. Users & Follow ---
  const getUsers = p => call('GET', '/api/users/search' + (p ? '?' + new URLSearchParams(p).toString() : ''));
  const getFollowingCount = userId => call('GET', `/api/follow/${userId}/following`);

  // --- 7. Bookings ---
  const getBookings = status => call('GET', '/api/bookings' + (status ? '?status=' + status : ''));
  const getBooking = id => call('GET', '/api/bookings/' + id);
  const getQueueStatus = id => call('GET', '/api/bookings/' + id + '/queue-status');
  const createBooking = body => call('POST', '/api/bookings', body);
  const updateBooking = (id, s, extra = {}) => call('PATCH', '/api/bookings/' + id, { status: s, ...extra });

  // --- 8. Chat & Presence ---
  const getChats = () => call('GET', '/api/chats');
  const startChat = target_user_id => call('POST', '/api/chats/start', { target_user_id });
  const getChatMessages = id => call('GET', '/api/chats/' + id + '/messages');
  const markChatRead = id => call('PATCH', '/api/chats/' + id + '/read');
  const markChatUnread = id => call('PATCH', '/api/chats/' + id + '/unread');
  const deleteChat = id => call('DELETE', '/api/chats/' + id);
  const getUnreadChats = () => call('GET', '/api/chats/unread');
  async function sendMessage(chatId, message, imageFile) {
    if (imageFile) {
      const fd = new FormData();
      if (message) fd.append('message', message);
      fd.append('image', imageFile);
      return call('POST', '/api/chats/' + chatId + '/messages', fd, true);
    }
    return call('POST', '/api/chats/' + chatId + '/messages', { message });
  }
  const pingPresence = () => call('POST', '/api/presence/ping', {});
  const getUserPresence = userId => call('GET', '/api/presence/' + userId);

  // --- 9. Notifications & Device Sessions ---
  const getNotifications = () => call('GET', '/api/notifications');
  const markRead = id => call('PATCH', '/api/notifications/' + id + '/read');
  const markUnread = id => call('PATCH', '/api/notifications/' + id + '/unread');
  const markAllRead = () => call('PATCH', '/api/notifications/read-all');
  const deleteNotification = id => call('DELETE', '/api/notifications/' + id);
  const deleteReadNotifications = () => call('DELETE', '/api/notifications/delete-read');
  const getNotificationSettings = () => call('GET', '/api/notification-settings');
  const saveNotificationSettings = (settings, role) => call('PATCH', '/api/notification-settings', { settings, role });
  const updatePushToken = (token, platform = 'native') => call('POST', '/api/notifications/push-token', { token, platform });

  const getDeviceSessions = () => call('GET', '/api/device-sessions');
  const logoutDevice = (id, password) => call('POST', `/api/device-sessions/${id}/logout`, { password });

  // --- 10. Logout ---
  async function logout() {
    try { await call('POST', '/api/auth/logout', {}); } catch (_) { /* ignore server errors on logout */ }
    clearAuth();
    const loginUrl = getLoginUrl();
    if (window.navigateWithTransition) window.navigateWithTransition(loginUrl);
    else window.location.href = loginUrl;
  }

  // --- 11. Misc ---
  const search = q => call('GET', '/api/search?q=' + encodeURIComponent(q));
  const getDashboard = () => call('GET', '/api/dashboard');
  const getAnnouncements = p => call('GET', '/api/announcements' + (p ? '?' + new URLSearchParams(p).toString() : ''));
  const checkoutPayment = body => call('POST', '/api/payments/checkout', body);
  const submitAppReview = body => call('POST', '/api/reviews/app', body);

  // --- Export ออกไปให้ทุกหน้าเรียกใช้ผ่านคำสั่ง window.api.xxx() ได้ ---
  window.api = {
    call, getBase, getToken, setToken, clearAuth, getUser, setUser,
    getRole, setRole, isLoggedIn, persistAuth,
    otpSend, otpVerify, checkPhone, registerFinish, passwordReset, changePassword, login, logout,
    getProfile, updateProfile, getProfileById, deleteProfile,
    getAddresses, createAddress, updateAddress, deleteAddress,
    getProducts, getOfferId, getProduct, createProduct, updateProduct, deleteProduct, getVarieties, getProductTypes,
    getFavorites, addFavorite, removeFavorite,
    getProductSlots, getAllSlots, createProductSlot, createSlotsBatch, updateProductSlot, deleteProductSlot,
    getUsers, getFollowingCount,
    getBookings, getBooking, getQueueStatus, createBooking, updateBooking,
    getChats, startChat, getChatMessages, markChatRead, markChatUnread, deleteChat, getUnreadChats, sendMessage,
    pingPresence, getUserPresence,
    getNotifications, markRead, markUnread, markAllRead, deleteNotification, deleteReadNotifications, getNotificationSettings, saveNotificationSettings, updatePushToken,
    getDeviceSessions, logoutDevice,
    search, getDashboard, getAnnouncements, checkoutPayment, submitAppReview
  };

  // --- 12. Background Notification Polling & Triggering ---
  let lastSeenNotificationId = null;
  let notiPollInterval = null;
  let notiPollInFlight = false;

  async function checkNotificationsBackground() {
    if (notiPollInFlight || document.hidden) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    notiPollInFlight = true;

    try {
      const currentBase = getBase();
      const response = await fetch(currentBase + '/api/notifications?limit=5', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!response.ok) return;
      const res = await response.json();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const unread = res.data.filter(n => !n.is_read);
        if (unread.length === 0) return;

        const latest = unread[0];
        const latestId = String(latest.id || latest.notification_id);

        if (lastSeenNotificationId === null) {
          lastSeenNotificationId = latestId;
          return;
        }

        if (latestId !== lastSeenNotificationId) {
          lastSeenNotificationId = latestId;
          showBackgroundNotification(latest.title, latest.message || latest.content || latest.description);
          window.dispatchEvent(new CustomEvent('agriprice:notifications-refresh', { detail: { latest } }));
          if (typeof window.loadNotifications === 'function') {
            window.loadNotifications();
          }
        }
      }
    } catch (err) {
      console.warn('[API Background] Notification check failed:', err.message);
    } finally {
      notiPollInFlight = false;
    }
  }

  function showBackgroundNotification(title, body) {
    const isLocalNotifSupported = window.Capacitor && window.Capacitor.isPluginAvailable('LocalNotifications');
    if (isLocalNotifSupported) {
      try {
        const { LocalNotifications } = window.Capacitor.Plugins;
        LocalNotifications.schedule({
          notifications: [
            {
              title: title,
              body: body,
              id: Math.floor(Math.random() * 100000),
              schedule: { at: new Date(Date.now() + 100) }
            }
          ]
        });
        return;
      } catch (e) {
        console.error('[API Background] Native local notification failed:', e);
      }
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      return;
    }

    if (window.showToast) {
      window.showToast(`${title}: ${body}`, 'success');
    } else {
      if (window.AGRIPRICE_DEBUG) console.log(`[Background Notification] ${title}: ${body}`);
    }
  }

  function startNotificationPolling() {
    if (notiPollInterval) clearInterval(notiPollInterval);
    notiPollInterval = setInterval(checkNotificationsBackground, 30000);
    setTimeout(checkNotificationsBackground, 12000);
  }

  if (!IS_EMBEDDED_FRAME && localStorage.getItem('token')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startNotificationPolling);
    } else {
      startNotificationPolling();
    }
  }

  if (window.AGRIPRICE_DEBUG) console.log('[API] ✅ Connected to:', getBase());
})();
