/* js/login/register/register3.js
   - Reads phone from sessionStorage register_profile (from register2)
   - Masks phone: 0XX-XXX-488
   - OTP inputs: auto next, backspace prev, paste support
   - Countdown 02:00, enable resend after expired
   - Future backend hooks:
      POST {API_BASE}/api/auth/otp/send   { phone }
      POST {API_BASE}/api/auth/otp/verify { phone, otp }
   - No backend => mock otp "123456"
   - Success => go register4.html
*/

(function () {
  const API_BASE = (window.API_BASE_URL || "").replace(/\/$/, "");
  const API_PREFIX = (window.API_AUTH_PREFIX || "/api/auth");
  const SEND_URL = API_BASE ? `${API_BASE}${API_PREFIX}/otp/send` : "";
  const VERIFY_URL = API_BASE ? `${API_BASE}${API_PREFIX}/otp/verify` : "";

  const KEY_PROFILE = "register_profile";
  const KEY_OTP_SENT_AT = "otp_sent_at";
  const KEY_OTP_LAST = "otp_last_mock"; // mock only

  const NEXT_ROUTE = "./register4.html"; // เปลี่ยนได้

  const otpTo = document.getElementById("otpTo");
  const timerText = document.getElementById("timerText");
  const resendBtn = document.getElementById("resendBtn");
  const form = document.getElementById("otpForm");
  const boxes = Array.from(document.querySelectorAll(".otp-box"));
  const errBox = document.getElementById("formError");
  const hint = document.getElementById("hintText");
  const nextBtn = document.getElementById("nextBtn");

  const topVideo = document.getElementById("registerVideo");
  const fallback = document.getElementById("mediaFallback");

  const OTP_LEN = 6;
  const EXPIRE_SECONDS = 120; // 02:00
  let timerId = null;
  let remaining = EXPIRE_SECONDS;

  function setHint(msg) { if (hint) hint.textContent = msg || ""; }
  function showError(msg) {
    if (!errBox) return;
    errBox.textContent = msg || "เกิดข้อผิดพลาด";
    errBox.classList.add("is-show");
  }
  function clearError() {
    if (!errBox) return;
    errBox.textContent = "";
    errBox.classList.remove("is-show");
  }

  function setLoading(on){
    nextBtn.disabled = !!on;
    nextBtn.classList.toggle("is-loading", !!on);
  }

  function normalizePhone(v){
    return (v || "").replace(/[^\d]/g, "");
  }

  function maskPhone(phone){
    const p = normalizePhone(phone);
    if (!p || p.length < 10) return "0XX-XXX-488";
    // format 0XX-XXX-XXXX with masking middle
    const a = p.slice(0, 3);
    const b = p.slice(3, 6);
    const c = p.slice(-3);
    return `${a[0]}XX-XXX-${c}`;
  }

  function getPhoneFromProfile(){
    try{
      const raw = sessionStorage.getItem(KEY_PROFILE);
      if (!raw) return "";
      const data = JSON.parse(raw);
      return data.phone || "";
    } catch(_) { return ""; }
  }

  function renderToPhone(){
    const phone = getPhoneFromProfile();
    const masked = maskPhone(phone);
    if (otpTo) {
      otpTo.innerHTML = `ส่งรหัสไปที่หมายเลข <span class="to-num">${masked}</span>`;
    }
  }

  function formatTime(sec){
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateTimerUI(){
    if (timerText) timerText.textContent = formatTime(remaining);
    if (remaining <= 0) {
      resendBtn.disabled = false;
      setHint("รหัสหมดอายุแล้ว สามารถขอรหัสใหม่ได้");
    } else {
      resendBtn.disabled = true;
      setHint("");
    }
  }

  function startTimer(fromSeconds){
    clearInterval(timerId);
    remaining = typeof fromSeconds === "number" ? fromSeconds : EXPIRE_SECONDS;
    updateTimerUI();
    timerId = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      updateTimerUI();
      if (remaining === 0) clearInterval(timerId);
    }, 1000);
  }

  // ===== Video fallback =====
  function setupVideo(){
    if (!topVideo) return;
    topVideo.muted = true;
    topVideo.play().catch(() => fallback && fallback.classList.add("is-show"));
    topVideo.addEventListener("error", () => fallback && fallback.classList.add("is-show"));
  }

  // ===== OTP inputs =====
  function focusBox(i){
    const el = boxes[i];
    if (el) el.focus();
  }

  function getOtpValue(){
    return boxes.map(b => (b.value || "").replace(/[^\d]/g, "")).join("");
  }

  function setOtpValue(code){
    const digits = String(code || "").replace(/[^\d]/g, "").slice(0, OTP_LEN).split("");
    boxes.forEach((b, i) => { b.value = digits[i] || ""; });
  }

  function bindOtpInputs(){
    boxes.forEach((box, idx) => {
      box.addEventListener("input", () => {
        box.value = (box.value || "").replace(/[^\d]/g, "").slice(0, 1);
        if (box.value && idx < boxes.length - 1) focusBox(idx + 1);
      });

      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace") {
          if (box.value) {
            box.value = "";
          } else if (idx > 0) {
            boxes[idx - 1].value = "";
            focusBox(idx - 1);
          }
        }
        if (e.key === "ArrowLeft" && idx > 0) focusBox(idx - 1);
        if (e.key === "ArrowRight" && idx < boxes.length - 1) focusBox(idx + 1);
      });

      box.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text") || "";
        const digits = text.replace(/[^\d]/g, "").slice(0, OTP_LEN);
        setOtpValue(digits);
        const last = Math.min(digits.length, boxes.length) - 1;
        if (last >= 0) focusBox(last);
      });
    });

    // focus first
    focusBox(0);
  }

  // ===== Future backend hooks =====
  async function apiSendOtp(phone){
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "ส่ง OTP ไม่สำเร็จ");
    return json;
  }

  async function apiVerifyOtp(phone, otp){
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, otp })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "OTP ไม่ถูกต้อง");
    return json;
  }

  // ===== Mock flow =====
  function mockSendOtp(){
    const otp = "123456";
    sessionStorage.setItem(KEY_OTP_LAST, otp);
    return otp;
  }

  function mockVerifyOtp(otp){
    return otp === (sessionStorage.getItem(KEY_OTP_LAST) || "123456");
  }

  async function sendOtp(){
    clearError();
    const phone = getPhoneFromProfile();
    if (!phone) {
      showError("ไม่พบเบอร์โทรศัพท์จากขั้นตอนก่อนหน้า");
      return false;
    }

    try{
      if (API_BASE) {
        await apiSendOtp(phone);
      } else {
        mockSendOtp();
      }
      sessionStorage.setItem(KEY_OTP_SENT_AT, String(Date.now()));
      startTimer(EXPIRE_SECONDS);
      setHint("ส่งรหัส OTP แล้ว");
      return true;
    } catch (e){
      showError(e?.message || "ส่ง OTP ไม่สำเร็จ");
      return false;
    }
  }

  async function verifyOtp(otp){
    clearError();
    const phone = getPhoneFromProfile();
    if (!phone) throw new Error("ไม่พบเบอร์โทรศัพท์");

    if (remaining <= 0) throw new Error("รหัสหมดอายุ กรุณาขอรหัสใหม่");

    if (API_BASE) {
      await apiVerifyOtp(phone, otp);
      return true;
    } else {
      if (!mockVerifyOtp(otp)) throw new Error("OTP ไม่ถูกต้อง (ทดสอบใช้ 123456)");
      return true;
    }
  }

  // ===== Events =====
  resendBtn.addEventListener("click", async () => {
    if (remaining > 0) return;
    setOtpValue("");
    focusBox(0);
    await sendOtp();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const otp = getOtpValue();
    if (otp.length !== OTP_LEN){
      showError("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    try{
      setLoading(true);
      await verifyOtp(otp);
      // success
      window.location.href = NEXT_ROUTE;
    } catch (err){
      showError(err?.message || "ยืนยัน OTP ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  });

  // ===== Init =====
  setupVideo();
  renderToPhone();
  bindOtpInputs();

  // ถ้ายังไม่เคยส่ง OTP ให้ส่งเลย (รองรับ future)
  // ในระบบจริง: ควรส่งจาก backend ตอน register2 -> register3
  // แต่ที่นี่ทำเผื่อไว้
  sendOtp();
})();
