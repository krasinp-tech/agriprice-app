/**
 * js/api-client.js - AgriPrice v2
 * ไฟล์นี้ทำหน้าที่เป็น "สะพานเชื่อม" (API Client) ระหว่าง Frontend กับ Backend
 * รวมฟังก์ชันการดึงข้อมูลทั้งหมดไว้ที่เดียว เพื่อให้ง่ายต่อการดูแลและเรียกใช้งานซ้ำ (Reusable)
 */
(function () {
  const BASE      = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const USER_KEY  = window.AUTH_USER_KEY  || 'user';

  if (!BASE) return; // ไม่มี server ให้ใช้ fallback แบบเดิม

  // --- 1. Helpers (ตัวช่วยจัดการ Authentication & Token) ---
  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken = t => localStorage.setItem(TOKEN_KEY, t);
  const getUser  = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)||'null'); } catch(_){return null;} };
  const setUser  = u => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const clearAuth = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem('role'); };

  // ฟังก์ชันหลักที่ใช้ยิง API ทุกตัว (จัดการเรื่องแนบ Token ให้อัตโนมัติ)
  async function call(method, path, body, isForm) {
    const headers = {};
    const token = getToken();
    
    // แนบ Token ไปใน Header เพื่อยืนยันตัวตน
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isForm && body) headers['Content-Type'] = 'application/json';
    
    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);
    let res;
    try { res = await fetch(BASE + path, opts); }
    catch (_) { throw new Error('ไม่สามารถเชื่อมต่อ server ได้'); }
    
    // ดักจับกรณี Token หมดอายุ (401) ให้เด้งกลับไปหน้า Login อัตโนมัติ
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

  // --- 2. Auth (ระบบสมัครสมาชิกและล็อกอินผ่าน OTP) ---
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

  // --- 3. Profile (จัดการข้อมูลส่วนตัว) ---
  const getProfile     = ()        => call('GET',   '/api/profile');
  const updateProfile  = form      => call('PATCH', '/api/profile', form, form instanceof FormData);
  const getProfileById = id        => call('GET',   '/api/profiles/' + id);
  const deleteProfile  = reason    => call('DELETE','/api/profile', reason ? { reason } : {});

  // --- 4. Products (จัดการประกาศขายผลผลิต) ---
  function getProducts(params) {
    const q = params ? '?'+new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v])=>v!=null&&v!==''))).toString() : '';
    return call('GET', '/api/products'+q);
  }
  const getProduct     = id   => call('GET',    '/api/products/'+id);
  const createProduct  = form => call('POST',   '/api/products', form, form instanceof FormData);
  const updateProduct  = (id, form) => call('PATCH', '/api/products/'+id, form, form instanceof FormData);
  const deleteProduct  = id   => call('DELETE', '/api/products/'+id);
  const getVarieties   = p    => call('GET', '/api/varieties'+(p?'?'+new URLSearchParams(p).toString():''));

  // --- 5. Product Slots (จัดการรอบการรับซื้อ/วันเวลาว่าง) ---
  const getProductSlots    = (productId, p) => call('GET', `/api/products/${productId}/slots`+(p?'?'+new URLSearchParams(p).toString():''));
  const getAllSlots        = p => call('GET', '/api/product-slots'+(p?'?'+new URLSearchParams(p).toString():''));
  const createProductSlot  = (productId, data) => call('POST', `/api/products/${productId}/slots`, data);
  const createSlotsBatch   = data => call('POST', '/api/product-slots/batch', data);
  const updateProductSlot  = (id, data) => call('PATCH', `/api/product-slots/${id}`, data);
  const deleteProductSlot  = id => call('DELETE', `/api/product-slots/${id}`);

  // --- 6. Users (ค้นหาผู้ใช้) ---
  const getUsers = p => call('GET', '/api/users/search'+(p?'?'+new URLSearchParams(p).toString():''));

  // --- 7. Bookings (ระบบจองคิวรับซื้อ - Core Feature) ---
  const getBookings      = status => call('GET',   '/api/bookings'+(status?'?status='+status:''));
  const getBooking       = id     => call('GET',   '/api/bookings/'+id);
  const createBooking    = body   => call('POST',  '/api/bookings', body);
  const updateBooking    = (id,s) => call('PATCH', '/api/bookings/'+id, { status: s });

  // --- 8. Chat (ระบบแชทเรียลไทม์) ---
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

  // --- 9. Notifications (ระบบการแจ้งเตือน) ---
  const getNotifications = ()  => call('GET',   '/api/notifications');
  const markRead         = id  => call('PATCH', '/api/notifications/'+id+'/read');
  const markAllRead      = ()  => call('PATCH', '/api/notifications/read-all');
  const getNotificationSettings = () => call('GET', '/api/notification-settings');
  const saveNotificationSettings = (settings, role) => call('PATCH', '/api/notification-settings', { settings, role });

  // --- 10. Misc (ฟังก์ชันอื่นๆ) ---
  const search       = q => call('GET', '/api/search?q='+encodeURIComponent(q));
  const getDashboard = () => call('GET', '/api/dashboard');

  // --- Export ออกไปให้ทุกหน้าเรียกใช้ผ่านคำสั่ง window.api.xxx() ได้ ---
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
  if (window.AGRIPRICE_DEBUG) console.log('[api] ✅ connected:', BASE);
})();
