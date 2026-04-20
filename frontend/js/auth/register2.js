/* js/auth/register2.js
  - ตรวจสอบข้อมูลฟอร์ม
  - เก็บลง sessionStorage
  - ไป register3.html
*/

(function () {
  const KEY_PROFILE = "register_profile";
  const KEY_ROLE = "register_role"; // มาจาก register1
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
    errBox.textContent = msg || "เกิดข้อผิดพลาด";
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

  function validate(){
    clearError();
    clearHelps();

    const fn = (firstName.value || "").trim();
    const ln = (lastName.value || "").trim();
    const em = (email.value || "").trim();
    const ph = (phone.value || "").trim();

    let ok = true;

    if (!fn || fn.length < 2){
      firstNameHelp.textContent = "กรุณากรอกชื่อให้ครบถ้วน";
      ok = false;
    }
    if (!ln || ln.length < 2){
      lastNameHelp.textContent = "กรุณากรอกนามสกุลให้ครบถ้วน";
      ok = false;
    }
    if (em && !isValidEmail(em)){
      emailHelp.textContent = "รูปแบบอีเมลไม่ถูกต้อง";
      ok = false;
    }
    if (!ph){
      phoneHelp.textContent = "กรุณากรอกเบอร์โทร";
      ok = false;
    } else if (!isValidThaiPhone(ph)){
      phoneHelp.textContent = "กรุณากรอกเบอร์โทร 10 หลัก (ขึ้นต้นด้วย 0)";
      ok = false;
    }

    return { ok, fn, ln, em, ph: normalizePhone(ph) };
  }

  function persistProfile(data){
    const role = sessionStorage.getItem(KEY_ROLE) || null;
    const payload = {
      role,
      firstName: (data.fn || '').trim(),
      lastName: (data.ln || '').trim(),
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
    topVideo.play().catch(() => {
      if (fallback) fallback.classList.add("is-show");
    });
    topVideo.addEventListener("error", () => {
      if (fallback) fallback.classList.add("is-show");
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = validate();
    if (!v.ok){
      showError("กรุณาตรวจสอบข้อมูลที่กรอก");
      return;
    }
    persistProfile(v);
    if (window.navigateWithTransition) window.navigateWithTransition(NEXT_ROUTE); else window.location.href = NEXT_ROUTE;
  });

  // init
  setupVideo();
})();

