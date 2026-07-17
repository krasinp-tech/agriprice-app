/* js/auth/register2.js
  - ตรวจสอบข้อมูลฟอร์ม
  - เก็บลง sessionStorage
  - ไป register3.html
*/

(function () {
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;
  const KEY_PROFILE = "reg_profile";
  const KEY_ROLE = "reg_role"; // มาจาก register1
  const NEXT_ROUTE = "./register3.html";

  const form = document.getElementById("registerForm");
  const firstName = document.getElementById("firstName");
  const lastName  = document.getElementById("lastName");
  const email     = document.getElementById("email");
  const phone     = document.getElementById("phone");

  const firstNameHelp = document.getElementById("firstNameHelp");
  const lastNameHelp  = document.getElementById("lastNameHelp");
  const emailHelp     = document.getElementById("emailHelp");
  const phoneHelp     = document.getElementById("phoneHelp");

  const errBox = document.getElementById("formError");
  const hint = document.getElementById("hintText");

  const topVideo = document.getElementById("registerVideo");
  const fallback = document.getElementById("mediaFallback");

  function setHint(msg){ if (hint) hint.textContent = msg || ""; }

  function showError(msg){
    if (!errBox) return;
    errBox.textContent = msg || t("error", "เกิดข้อผิดพลาด");
    errBox.classList.add("is-show");
  }
  function clearError(){
    if (!errBox) return;
    errBox.textContent = "";
    errBox.classList.remove("is-show");
  }

  function clearHelps(){
    firstNameHelp.textContent = "";
    lastNameHelp.textContent = "";
    emailHelp.textContent = "";
    phoneHelp.textContent = "";
  }

  function normalizePhone(v){
    return (v || "").replace(/[^\d]/g, "").trim();
  }
  function isValidEmail(v){
    if (!v) return true; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(v.trim());
  }
  function isValidThaiPhone(v){
    const p = normalizePhone(v);
    if (!p) return true; // optional ถ้าไม่ได้กรอกก็ผ่าน
    return p.length === 10 && p.startsWith("0");
  }

  function goLoginSoon() {
    setTimeout(() => {
      if (window.navigateWithTransition) window.navigateWithTransition("./login2.html");
      else window.location.href = "./login2.html";
    }, 1800);
  }

  function validate(){
    clearError();
    clearHelps();

    const fn = (firstName.value || "").trim();
    const ln = (lastName.value || "").trim();
    const em = (email.value || "").trim();
    const ph = (phone.value || "").trim();

    let ok = true;

    if (!fn || fn.length < 2){
      firstNameHelp.textContent = t("first_name_required", "กรุณากรอกชื่อให้ครบถ้วน");
      ok = false;
    }
    if (!ln || ln.length < 2){
      lastNameHelp.textContent = t("last_name_required", "กรุณากรอกนามสกุลให้ครบถ้วน");
      ok = false;
    }
    if (em && !isValidEmail(em)){
      emailHelp.textContent = t("invalid_email_format", "รูปแบบอีเมลไม่ถูกต้อง");
      ok = false;
    }
    if (!ph){
      phoneHelp.textContent = t("phone_required", "กรุณากรอกเบอร์โทร");
      ok = false;
    } else if (!isValidThaiPhone(ph)){
      phoneHelp.textContent = t("thai_phone_format", "กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)");
      ok = false;
    }

    return { ok, fn, ln, em, ph: normalizePhone(ph) };
  }

  function persistProfile(data){
    const role = sessionStorage.getItem(KEY_ROLE) || null;
    const payload = {
      role,
      first_name: (data.fn || '').trim(),
      last_name: (data.ln || '').trim(),
      email: data.em ? (data.em || '').trim() : null,
      phone: data.ph ? (data.ph || '').trim() : null,
      // Future: backend can use this object directly
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem(KEY_PROFILE, JSON.stringify(payload));
  }

  function setupVideo(){
    if (!topVideo) return;
    topVideo.muted = true;
    topVideo.playsInline = true;
    const resumeVideo = () => topVideo.play().catch(() => {
      if (fallback) fallback.classList.add("is-show");
    });
    resumeVideo();
    topVideo.addEventListener("canplay", resumeVideo, { once: true });
    topVideo.addEventListener("error", () => {
      if (fallback) fallback.classList.add("is-show");
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && topVideo.paused) resumeVideo();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = validate();
    if (!v.ok){
      showError(t("check_form_information", "กรุณาตรวจสอบข้อมูลที่กรอก"));
      return;
    }

    try {
      setHint(t("checking_phone", "กำลังตรวจสอบเบอร์โทร..."));
      const phoneCheck = await window.api.checkPhone(v.ph);
      const exists = !!(phoneCheck?.data?.exists || phoneCheck?.exists);
      if (exists) {
        phoneHelp.textContent = t("phone_already_registered", "เบอร์นี้มีบัญชีอยู่แล้ว");
        showError(t("phone_login_instead", "เบอร์โทรนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่"));
        setHint(t("redirecting_to_login", "กำลังพาไปหน้าเข้าสู่ระบบ..."));
        goLoginSoon();
        return;
      }
    } catch (err) {
      console.warn("[Register] Phone precheck failed:", err);
      setHint("");
    }

    // [NEW] Request location before proceeding
    setHint(t("checking_location", "กำลังตรวจสอบตำแหน่ง..."));
    let userLoc = null;
    if (window.LocationHelper && typeof window.LocationHelper.getUserLocation === 'function') {
      try {
        userLoc = await window.LocationHelper.getUserLocation();
      } catch (err) {
        console.warn("[Register] Failed to get location:", err);
      }
    }

    const role = sessionStorage.getItem(KEY_ROLE) || null;
    const payload = {
      role,
      first_name: (v.fn || '').trim(),
      last_name: (v.ln || '').trim(),
      email: v.em ? (v.em || '').trim() : null,
      phone: v.ph ? (v.ph || '').trim() : null,
      lat: userLoc ? userLoc.lat : null,
      lng: userLoc ? userLoc.lng : null,
      createdAt: new Date().toISOString(),
    };
    sessionStorage.setItem(KEY_PROFILE, JSON.stringify(payload));

    if (window.navigateWithTransition) window.navigateWithTransition(NEXT_ROUTE); else window.location.href = NEXT_ROUTE;
  });

  // init
  setupVideo();
})();
