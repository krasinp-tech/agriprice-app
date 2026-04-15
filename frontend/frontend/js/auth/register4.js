/* js/auth/register4.js
  - ตั้งรหัสผ่านและยืนยันการสมัครสมาชิก
  - ใช้ temp_token จาก sessionStorage[otp_temp_token] (มาจาก register3)
  - POST /api/auth/register/finish { temp_token, role, profile, password }
  - ได้ JWT -> login -> redirect
*/
(function () {
  const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const USER_KEY  = window.AUTH_USER_KEY  || 'user';
  const DEBUG_REGISTER = !!window.AGRIPRICE_DEBUG;

  const KEY_ROLE       = 'register_role';
  const KEY_PROFILE    = 'register_profile';
  const KEY_TEMP_TOKEN = 'otp_temp_token';

  const form    = document.getElementById('pwForm');
  const pw1     = document.getElementById('password');
  const pw2     = document.getElementById('password2');
  const pwHelp  = document.getElementById('pwHelp');
  const pw2Help = document.getElementById('pw2Help');
  const errBox  = document.getElementById('formError');
  const hint    = document.getElementById('hintText');
  const toggle1 = document.getElementById('togglePw1');
  const toggle2 = document.getElementById('togglePw2');
  const btn     = document.getElementById('submitBtn');
  const video   = document.getElementById('registerVideo');
  const fallbk  = document.getElementById('mediaFallback');

  const setHint  = msg => { if (hint)   hint.textContent   = msg||''; };
  const showErr  = msg => { if (errBox) { errBox.textContent = msg; errBox.classList.add('is-show'); } };
  const clearErr = ()  => { if (errBox) { errBox.textContent = ''; errBox.classList.remove('is-show'); } };
  const setLoad  = on  => { if (btn) { btn.disabled = !!on; btn.classList.toggle('is-loading', !!on); } };

  function logRegister(step, data) {
    if (!DEBUG_REGISTER) return;
    const t = new Date().toISOString().slice(11, 23);
    console.log(`[REGISTER4 ${t}] ${step}`, data ?? '');
  }

  function validate() {
    clearErr();
    if (pwHelp)  pwHelp.textContent  = '';
    if (pw2Help) pw2Help.textContent = '';
    const a = (pw1?.value || '').trim();
    const b = (pw2?.value || '').trim();
    let ok = true;
    if (a.length < 8) { if (pwHelp)  pwHelp.textContent  = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'; ok = false; }
    if (b.length < 8) { if (pw2Help) pw2Help.textContent = 'กรุณายืนยันรหัสผ่าน'; ok = false; }
    if (a && b && a !== b) { if (pw2Help) pw2Help.textContent = 'รหัสผ่านไม่ตรงกัน'; ok = false; }
    return { ok, password: a };
  }

  function getPayload() {
    const role       = sessionStorage.getItem(KEY_ROLE) || 'farmer';
    const temp_token = sessionStorage.getItem(KEY_TEMP_TOKEN) || '';
    let profile = null;
    try { profile = JSON.parse(sessionStorage.getItem(KEY_PROFILE) || 'null'); } catch (_) {}
    logRegister('payload.loaded', { role, hasTempToken: !!temp_token, profile });
    return { role, temp_token, profile };
  }

  function persistAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    if (user?.role) localStorage.setItem('role', String(user.role).toLowerCase());
  }

  function cleanup() {
    [KEY_ROLE, KEY_PROFILE, KEY_TEMP_TOKEN, 'otp_mock'].forEach(k => sessionStorage.removeItem(k));
  }

  function redirectAfterRegister() {
    if (window.AuthGuard?.redirectAfterLogin) { window.AuthGuard.redirectAfterLogin(); return; }
    const next = new URLSearchParams(location.search).get('next')
      || sessionStorage.getItem('redirectAfterAuth');
    sessionStorage.removeItem('redirectAfterAuth');
    if (window.navigateWithTransition) window.navigateWithTransition(next || '../../index.html'); else window.location.href = next || '../../index.html';
  }

  async function doRegister(temp_token, role, profile, password) {
    if (!API_BASE) {
      throw new Error('ไม่พบการตั้งค่า API กรุณาตั้งค่า API_BASE_URL');
    }
    logRegister('request.start', {
      apiBase: API_BASE,
      role,
      phone: profile?.phone || '',
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      hasTempToken: !!temp_token,
      passwordLength: password?.length || 0,
    });
    
    // Sanitize profile: 
    // 1. Only keep: firstName, lastName, email (if valid), phone
    // 2. Remove: role, createdAt (role is sent at top level, not in profile)
    const sanitizedProfile = {
      firstName: profile.firstName,
      lastName: profile.lastName,
    };
    // Add email only if it's valid
    const emailVal = (profile.email || '').trim();
    const emailOk  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    if (emailOk) sanitizedProfile.email = emailVal;
    // Add phone only if it exists
    if (profile.phone) sanitizedProfile.phone = profile.phone;
    logRegister('request.profile-keys', Object.keys(sanitizedProfile));
    
    const requestBody = { temp_token, role, profile: sanitizedProfile, password };
    logRegister('request.body-full', requestBody);
    logRegister('request.body-json', JSON.stringify(requestBody));
    
    const res = await fetch(API_BASE + '/api/auth/register/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const json = await res.json().catch(() => ({}));
    logRegister('request.response', {
      status: res.status,
      ok: res.ok,
      success: json?.success,
      message: json?.message || '',
      fullError: json,
    });
    if (!res.ok) throw new Error(json.message || 'สมัครสมาชิกไม่สำเร็จ');
    if (!json.token) throw new Error('ไม่พบ token จากเซิร์ฟเวอร์');
    return { token: json.token, user: json.user };
  }

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const v = validate();
    if (!v.ok) { showErr('กรุณาตรวจสอบรหัสผ่าน'); return; }
    const { role, temp_token, profile } = getPayload();
    if (!profile) { showErr('ไม่พบข้อมูลจากขั้นตอนก่อนหน้า'); return; }
    if (!temp_token && API_BASE) { showErr('OTP token หมดอายุ กรุณายืนยัน OTP ใหม่'); return; }
    try {
      setLoad(true); clearErr(); setHint('กำลังสร้างบัญชี...');
      const result = await doRegister(temp_token, role, profile, v.password);
      persistAuth(result.token, result.user);
      cleanup();
      setHint('สำเร็จ กำลังเข้าสู่ระบบ...');
      redirectAfterRegister();
    } catch (err) {
      logRegister('request.error', {
        code: err?.code || '',
        message: err?.message || 'unknown',
        stack: err?.stack || '',
      });
      showErr(err?.message || 'สมัครสมาชิกไม่สำเร็จ');
      setHint('');
    } finally { setLoad(false); }
  });

  toggle1?.addEventListener('click', () => { if (pw1) pw1.type = pw1.type==='password'?'text':'password'; });
  toggle2?.addEventListener('click', () => { if (pw2) pw2.type = pw2.type==='password'?'text':'password'; });
  if (video) {
    video.muted = true; video.playsInline = true;
    video.play().catch(() => fallbk?.classList.add('is-show'));
    video.addEventListener('error', () => fallbk?.classList.add('is-show'));
  }
})();