/* js/login/register/register4.js
   - Validate password >= 8 and match
   - Future DB ready:
      POST {API_BASE}/api/auth/register/finish with { role, profile, password }
   - No backend => mock: store token/user then redirect (next/default) via AuthGuard
*/

(function () {
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
  const API_PREFIX = (window.API_AUTH_PREFIX || "/api/auth");
  const FINISH_URL = API_BASE ? `${API_BASE}${API_PREFIX}/register/finish` : "";

  const TOKEN_KEY = (window.AUTH_TOKEN_KEY || "token");
  const USER_KEY = (window.AUTH_USER_KEY || "user");

  const KEY_ROLE = "register_role";
  const KEY_PROFILE = "register_profile";

  // ✅ default home แบบ absolute ชัวร์สุด

  const REDIRECT_KEY = "redirectAfterAuth";

  const form = document.getElementById("pwForm");
  const pw1 = document.getElementById("password");
  const pw2 = document.getElementById("password2");

  const pwHelp = document.getElementById("pwHelp");
  const pw2Help = document.getElementById("pw2Help");
  const errBox = document.getElementById("formError");
  const hint = document.getElementById("hintText");

  const toggle1 = document.getElementById("togglePw1");
  const toggle2 = document.getElementById("togglePw2");
  const btn = document.getElementById("submitBtn");

  const topVideo = document.getElementById("registerVideo");
  const fallback = document.getElementById("mediaFallback");

  function setHint(msg){ if (hint) hint.textContent = msg || ""; }

  function showError(msg){
    if (!errBox) return;
    errBox.textContent = msg || "เกิดข้อผิดพลาด";
    errBox.classList.add("is-show");
  }
  function clearError(){
    if (!errBox) return;
    errBox.textContent = "";
    errBox.classList.remove("is-show");
  }

  function setLoading(on){
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("is-loading", !!on);
  }

  function setupVideo(){
    if (!topVideo) return;
    topVideo.muted = true;
    topVideo.playsInline = true;

    topVideo.play().catch(() => fallback && fallback.classList.add("is-show"));
    topVideo.addEventListener("error", () => fallback && fallback.classList.add("is-show"));
  }

  function toggleInputType(input){
    input.type = input.type === "password" ? "text" : "password";
  }

  function getRegisterPayload(){
    let role = sessionStorage.getItem(KEY_ROLE) || null;
    let profile = null;
    try{
      const raw = sessionStorage.getItem(KEY_PROFILE);
      profile = raw ? JSON.parse(raw) : null;
    }catch(_){ profile = null; }

    return { role, profile };
  }

  function validate(){
    clearError();
    if (pwHelp) pwHelp.textContent = "";
    if (pw2Help) pw2Help.textContent = "";
    setHint("");

    const a = (pw1?.value || "").trim();
    const b = (pw2?.value || "").trim();

    let ok = true;

    if (a.length < 8){
      if (pwHelp) pwHelp.textContent = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร";
      ok = false;
    }
    if (b.length < 8){
      if (pw2Help) pw2Help.textContent = "กรุณายืนยันรหัสผ่านให้ครบอย่างน้อย 8 ตัวอักษร";
      ok = false;
    }
    if (a && b && a !== b){
      if (pw2Help) pw2Help.textContent = "รหัสผ่านไม่ตรงกัน";
      ok = false;
    }

    return { ok, password: a };
  }

  async function finishRegisterApi(payload){
    const res = await fetch(FINISH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "สมัครสมาชิกไม่สำเร็จ");

    const token = json.token || json.accessToken || json.access_token;
    const user = json.user || json.profile || json.data?.user;

    if (!token) throw new Error("ไม่พบ token จากเซิร์ฟเวอร์");
    return { token, user: user || payload.profile || {} };
  }

  function finishRegisterMock(payload){
    const token = "mock_token_" + Date.now();
    const user = {
      id: 1,
      role: payload.role || "user",
      phone: payload.profile?.phone || null,
      email: payload.profile?.email || null,
      name: `${payload.profile?.firstName || ""} ${payload.profile?.lastName || ""}`.trim(),
    };
    return { token, user };
  }

  function persistAuth(token, user){
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function cleanupRegisterCache(){
    sessionStorage.removeItem(KEY_ROLE);
    sessionStorage.removeItem(KEY_PROFILE);
  }

  function redirectAfterRegister(){
    // ✅ ใช้ AuthGuard ถ้ามี (ดีที่สุด)
    if (window.AuthGuard && typeof window.AuthGuard.redirectAfterLogin === "function") {
      window.AuthGuard.redirectAfterLogin();

      return;
    }

    // fallback (ถ้า guard ไม่ถูกโหลด)
    let next = "";
    try{
      const url = new URL(window.location.href);
      next = url.searchParams.get("next") || "";
    } catch(_) {}

    const stored = sessionStorage.getItem(REDIRECT_KEY);
    const target = next || stored || DEFAULT_HOME;

    sessionStorage.removeItem(REDIRECT_KEY);
    window.location.href = target;
  }

  // ===== events =====
  toggle1 && toggle1.addEventListener("click", () => toggleInputType(pw1));
  toggle2 && toggle2.addEventListener("click", () => toggleInputType(pw2));

  form && form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const v = validate();
    if (!v.ok){
      showError("กรุณาตรวจสอบข้อมูลรหัสผ่าน");
      return;
    }

    const base = getRegisterPayload();
    if (!base.profile){
      showError("ไม่พบข้อมูลสมัครสมาชิกจากขั้นตอนก่อนหน้า");
      return;
    }

    const payload = {
      role: base.role,
      profile: base.profile,
      password: v.password,
    };

    try{
      setLoading(true);
      clearError();
      setHint("กำลังสร้างบัญชี…");

      const result = API_BASE
        ? await finishRegisterApi(payload)
        : finishRegisterMock(payload);

      // ✅ จุดสำคัญ: ตั้ง token ก่อน
      persistAuth(result.token, result.user);

      // เคลียร์ข้อมูลสมัคร
      cleanupRegisterCache();

      setHint("สำเร็จ กำลังเข้าสู่ระบบ…");

      // ✅ แล้วค่อยเด้งกลับหน้าที่กดมา (next) หรือไป home
      redirectAfterRegister();
    } catch (err){
      showError(err?.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  });

  // init
  setupVideo();
})();
