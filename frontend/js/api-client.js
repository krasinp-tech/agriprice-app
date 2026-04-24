/**
 * js/api-client.js - AgriPrice v2
 * เชื่อม frontend กับ server.js
 *
 * ใส่ใน HTML ทุกหน้าก่อน </head>:
 *   <script>window.API_BASE_URL = 'http://localhost:5000';</script>
 *   <script src="../../js/api-client.js"></script>
 */
(function () {
  const BASE      = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const USER_KEY  = window.AUTH_USER_KEY  || 'user';

  if (!BASE) return; // ไม่มี server ให้ใช้ fallback แบบเดิม

  // โ”€โ”€โ”€ helpers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken = t => localStorage.setItem(TOKEN_KEY, t);
  const getUser  = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)||'null'); } catch(_){return null;} };
  const setUser  = u => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem('role'); };

  async function call(method, path, body, isForm) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isForm && body) headers['Content-Type'] = 'application/json';
    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    let res;
    try { res = await fetch(BASE + path, opts); }
    catch (_) { throw new Error('ไม่สามารถเชื่อมต่อ server ได้'); }
    if (res.status === 401) {
      clearAuth();
      const p = window.location.pathname, idx = p.indexOf('/pages/');
      if (window.navigateWithTransition) window.navigateWithTransition((idx !== -1 ? p.substring(0, idx+1) : '/') + 'pages/auth/login1.html'); else window.location.href = (idx !== -1 ? p.substring(0, idx+1) : '/') + 'pages/auth/login1.html';
      return null;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'เกิดข้อผิดพลาด');
    return json;
  }

  // โ”€โ”€โ”€ auth โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const otpSend    = phone => call('POST', '/api/auth/otp/send', { phone });
  const otpVerify  = (phone, otp) => call('POST', '/api/auth/otp/verify', { phone, otp });
  const registerFinish = (temp_token, role, profile, password) =>
    call('POST', '/api/auth/register/finish', { temp_token, role, profile, password });

  async function login(phone, password) {
    const data = await call('POST', '/api/auth/login', { phone, password });
    if (data?.token) { setToken(data.token); setUser(data.user); if (data.user?.role) localStorage.setItem('role', data.user.role); }
    return data;
  }
  const logout = clearAuth;

  // โ”€โ”€โ”€ profile โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getProfile     = ()        => call('GET',   '/api/profile');
  const updateProfile  = form      => call('PATCH', '/api/profile', form, form instanceof FormData);
  const getProfileById = id        => call('GET',   '/api/profiles/' + id);
  const deleteProfile  = reason    => call('DELETE','/api/profile', reason ? { reason } : {});

  // โ”€โ”€โ”€ products โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  function getProducts(params) {
    const q = params ? '?'+new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v])=>v!=null&&v!==''))).toString() : '';
    return call('GET', '/api/products'+q);
  }
  const getProduct     = id   => call('GET',    '/api/products/'+id);
  const createProduct  = form => call('POST',   '/api/products', form, form instanceof FormData);
  const updateProduct  = (id, form) => call('PATCH', '/api/products/'+id, form, form instanceof FormData);
  const deleteProduct  = id   => call('DELETE', '/api/products/'+id);
  const getVarieties   = p    => call('GET', '/api/varieties'+(p?'?'+new URLSearchParams(p).toString():''));

  // โ”€โ”€โ”€ product slots โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getProductSlots    = (productId, p) => call('GET', `/api/products/${productId}/slots`+(p?'?'+new URLSearchParams(p).toString():''));
  const getAllSlots        = p => call('GET', '/api/product-slots'+(p?'?'+new URLSearchParams(p).toString():''));
  const createProductSlot  = (productId, data) => call('POST', `/api/products/${productId}/slots`, data);
  const createSlotsBatch   = data => call('POST', '/api/product-slots/batch', data);
  const updateProductSlot  = (id, data) => call('PATCH', `/api/product-slots/${id}`, data);
  const deleteProductSlot  = id => call('DELETE', `/api/product-slots/${id}`);

  // โ”€โ”€โ”€ users โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getUsers = p => call('GET', '/api/users/search'+(p?'?'+new URLSearchParams(p).toString():''));

  // โ”€โ”€โ”€ bookings โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getBookings      = status => call('GET',   '/api/bookings'+(status?'?status='+status:''));
  const getBooking       = id     => call('GET',   '/api/bookings/'+id);
  const createBooking    = body   => call('POST',  '/api/bookings', body);
  const updateBooking    = (id,s) => call('PATCH', '/api/bookings/'+id, { status: s });

  // โ”€โ”€โ”€ chat โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getChats         = ()      => call('GET',  '/api/chats');
  const startChat        = target_user_id => call('POST', '/api/chats/start', { target_user_id });
  const getChatMessages  = id      => call('GET',  '/api/chats/'+id+'/messages');
  async function sendMessage(chatId, message, imageFile) {
    if (imageFile) {
      const fd = new FormData();
      if (message) fd.append('message', message);
      fd.append('image', imageFile);
      return call('POST', '/api/chats/'+chatId+'/messages', fd, true);
    }
    return call('POST', '/api/chats/'+chatId+'/messages', { message });
  }

  // โ”€โ”€โ”€ notifications โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const getNotifications = ()  => call('GET',   '/api/notifications');
  const markRead         = id  => call('PATCH', '/api/notifications/'+id+'/read');
  const markAllRead      = ()  => call('PATCH', '/api/notifications/read-all');
  const getNotificationSettings = () => call('GET', '/api/notification-settings');
  const saveNotificationSettings = (settings, role) => call('PATCH', '/api/notification-settings', { settings, role });

  // โ”€โ”€โ”€ misc โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  const search       = q => call('GET', '/api/search?q='+encodeURIComponent(q));
  const getDashboard = () => call('GET', '/api/dashboard');

  // โ”€โ”€โ”€ export โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  window.api = {
    BASE, getToken, setToken, clearAuth, getUser, setUser,
    otpSend, otpVerify, registerFinish, login, logout,
    getProfile, updateProfile, getProfileById, deleteProfile,
    getProducts, getProduct, createProduct, updateProduct, deleteProduct, getVarieties,
    getProductSlots, getAllSlots, createProductSlot, createSlotsBatch, updateProductSlot, deleteProductSlot,
    getUsers,
    getBookings, getBooking, createBooking, updateBooking,
    getChats, startChat, getChatMessages, sendMessage,
    getNotifications, markRead, markAllRead, getNotificationSettings, saveNotificationSettings,
    search, getDashboard,
  };
  if (window.AGRIPRICE_DEBUG) console.log('[api] โ… connected:', BASE);
})();

