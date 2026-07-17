/* js/auth/register3.js - Firebase OTP verification */
(function () {
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;
  const getApiBase = () => window.api?.getBase ? window.api.getBase() : (window.API_BASE_URL || "").replace(/\/$/, "");
  const DEBUG_OTP = !!window.AGRIPRICE_DEBUG;
  const DEBUG_REDIRECT_DELAY_MS = DEBUG_OTP ? 3500 : 0;
  const NEXT_ROUTE = "./register4.html";
  const KEY_PROFILE = "reg_profile";
  const KEY_TEMP_TOKEN = "otp_temp_token";
  const OTP_LEN = 6;
  const cap = window.Capacitor;
  const capPlatform = typeof cap?.getPlatform === "function" ? cap.getPlatform() : "";
  const IS_NATIVE = (
    window.location.protocol === "capacitor:" ||
    window.location.protocol === "ionic:" ||
    capPlatform === "android" ||
    capPlatform === "ios" ||
    !!cap?.isNative
  );

  const otpTo = document.getElementById("otpTo");
  const timerTx = document.getElementById("timerText");
  const resendB = document.getElementById("resendBtn");
  const form = document.getElementById("otpForm");
  const boxes = Array.from(document.querySelectorAll(".otp-box"));
  const errBox = document.getElementById("formError");
  const hint = document.getElementById("hintText");
  const configSourceText = document.getElementById("configSourceText");
  const nextBtn = document.getElementById("nextBtn");
  const video = document.getElementById("registerVideo");
  const fallbk = document.getElementById("mediaFallback");

  let firebaseAuth = null;
  let recaptchaVerifier = null;
  let recaptchaRenderPromise = null;
  let confirmationResult = null;
  let otpProvider = IS_NATIVE ? "native-firebase" : "firebase";
  let nativeVerificationId = "";
  let nativeOtpListenersReady = false;
  let nativeSendTimeoutId = null;
  let nativeFallbackInProgress = false;
  let timerId = null;
  let remaining = 120;

  const setHint = (msg) => { if (hint) hint.textContent = msg || ""; };
  const showErr = (msg) => {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.classList.add("is-show");
  };
  const clearErr = () => {
    if (!errBox) return;
    errBox.textContent = "";
    errBox.classList.remove("is-show");
  };
  const setLoad = (on) => {
    if (!nextBtn) return;
    nextBtn.disabled = !!on;
    nextBtn.classList.toggle("is-loading", !!on);
  };

  function logOtp(eventName, payload) {
    if (!DEBUG_OTP) return;
    console.log("[OTP][" + new Date().toISOString() + "] " + eventName, payload || {});
  }

  function setConfigSourceStatus() {
    if (!configSourceText) return;
    const src = String(window.APP_CONFIG_SOURCE || "pending");
    const projectId = window.FIREBASE_CONFIG?.projectId || "-";
    if (src === "server") {
      configSourceText.textContent = "Config: ใช้ server config (" + projectId + ")";
      return;
    }
    if (src === "fallback") {
      configSourceText.textContent = "Config: ใช้ fallback config (" + projectId + ")";
      return;
    }
    configSourceText.textContent = "Config: กำลังโหลด...";
  }

  function getPhone() {
    try {
      if (sessionStorage.getItem("otp_flow") === "forgot_password") {
        return sessionStorage.getItem("forgot_phone") || "";
      }
      return JSON.parse(sessionStorage.getItem(KEY_PROFILE) || "{}").phone || "";
    } catch (_) {
      return "";
    }
  }

  function toE164(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("66")) return "+" + digits;
    if (digits.startsWith("0")) return "+66" + digits.slice(1);
    return "+" + digits;
  }

  function maskPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 10) return "XXX-XXX-XXXX";
    return digits[0] + "XX-XXX-" + digits.slice(-3);
  }

  function goLogin() {
    if (window.navigateWithTransition) window.navigateWithTransition("./login2.html");
    else window.location.href = "./login2.html";
  }

  function markExistingAccount(message) {
    showErr(message || "เบอร์นี้มีบัญชีอยู่แล้ว กำลังพาไป Login...");
    setTimeout(goLogin, 1500);
  }

  function formatTime(seconds) {
    return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }

  function startTimer(seconds) {
    clearInterval(timerId);
    remaining = seconds;
    if (timerTx) timerTx.textContent = formatTime(remaining);
    if (resendB) resendB.disabled = true;
    timerId = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (timerTx) timerTx.textContent = formatTime(remaining);
      if (remaining === 0) {
        clearInterval(timerId);
        if (resendB) resendB.disabled = false;
        setHint(t('otp_expired_request_new', 'รหัสหมดอายุ กรุณาขอรหัสใหม่ได้'));
      }
    }, 1000);
  }

  function getOtp() {
    return boxes.map((box) => (box.value || "").replace(/\D/g, "")).join("");
  }

  function setOtp(code) {
    const digits = String(code || "").replace(/\D/g, "").slice(0, OTP_LEN).split("");
    boxes.forEach((box, idx) => { box.value = digits[idx] || ""; });
  }

  function bindBoxes() {
    boxes.forEach((box, idx) => {
      box.addEventListener("input", () => {
        clearErr();
        box.value = (box.value || "").replace(/\D/g, "").slice(0, 1);
        if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
      });

      box.addEventListener("keydown", (event) => {
        if (event.key === "Backspace") {
          if (box.value) box.value = "";
          else if (idx > 0) {
            boxes[idx - 1].value = "";
            boxes[idx - 1].focus();
          }
        }
        if (event.key === "ArrowLeft" && idx > 0) boxes[idx - 1].focus();
        if (event.key === "ArrowRight" && idx < boxes.length - 1) boxes[idx + 1].focus();
      });

      box.addEventListener("paste", (event) => {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData("text");
        const digits = text.replace(/\D/g, "").slice(0, OTP_LEN);
        setOtp(digits);
        boxes[Math.max(0, Math.min(digits.length, boxes.length) - 1)]?.focus();
      });
    });

    boxes[0]?.focus();
  }

  async function initFirebaseOtp() {
    if (window.FirebaseCompatReady) await window.FirebaseCompatReady;
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const config = window.FIREBASE_CONFIG || null;
    if (!window.firebase || !config) {
      throw new Error("ยังไม่ได้ตั้งค่า Firebase บนหน้าเว็บ");
    }
    const recaptchaEl = document.getElementById("recaptcha-container");
    if (!recaptchaEl) {
      throw new Error("ไม่พบ recaptcha-container บนหน้าเว็บ");
    }

    if (!firebase.apps.length) firebase.initializeApp(config);
    firebaseAuth = firebase.auth();

    if (!recaptchaVerifier) {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier(recaptchaEl, { size: "invisible" });
      recaptchaRenderPromise = recaptchaVerifier.render();
    }
    if (recaptchaRenderPromise) await recaptchaRenderPromise;
  }

  function clearNativeSendTimeout() {
    if (!nativeSendTimeoutId) return;
    clearTimeout(nativeSendTimeoutId);
    nativeSendTimeoutId = null;
  }

  async function sendWebFirebaseOtp(phone, reason) {
    setHint(reason || t('sending_otp_firebase', 'กำลังส่งรหัส OTP ผ่าน Firebase...'));
    await initFirebaseOtp();
    const cleanPhone = toE164(phone);
    otpProvider = "firebase";
    nativeVerificationId = "";
    logOtp("firebase.send.start", { phone: cleanPhone });
    confirmationResult = await firebaseAuth.signInWithPhoneNumber(cleanPhone, recaptchaVerifier);
    logOtp("firebase.send.success");
    setHint(t('otp_sent_to_phone', 'ส่งรหัส OTP เข้ามือถือของคุณแล้ว'));
    startTimer(120);
  }

  async function fallbackToWebFirebaseOtp(phone, reason) {
    if (nativeFallbackInProgress || confirmationResult || nativeVerificationId) return;
    nativeFallbackInProgress = true;
    try {
      logOtp("native.fallback.web.start", { reason: reason || "" });
      await sendWebFirebaseOtp(phone, "Native OTP ไม่ตอบกลับ กำลังลองส่งผ่าน Firebase Web...");
      clearErr();
    } catch (error) {
      logOtp("native.fallback.web.error", { code: error?.code || "", message: error?.message || "unknown" });
      showErr(mapFirebaseOtpError(error));
    } finally {
      nativeFallbackInProgress = false;
    }
  }

  function mapFirebaseOtpError(error) {
    const code = String(error?.code || "");
    const rawMessage = String(error?.message || "");
    const upperMessage = rawMessage.toUpperCase();
    if (rawMessage === "RECAPTCHA_TIMEOUT") return "ยังไม่ได้ยืนยัน reCAPTCHA กรุณาขอรหัสใหม่";
    if (code === "auth/billing-not-enabled" || upperMessage.includes("BILLING_NOT_ENABLED")) {
      return "โปรเจกต์ Firebase ยังไม่ได้เปิด Billing สำหรับ Phone OTP";
    }
    if (code === "auth/operation-not-allowed") return "ยังไม่ได้เปิด Phone ใน Firebase Authentication";
    if (code === "auth/invalid-phone-number") return "รูปแบบเบอร์โทรไม่ถูกต้อง";
    if (code === "auth/captcha-check-failed" || code === "auth/missing-app-credential") return "reCAPTCHA ไม่ผ่าน กรุณาลองใหม่";
    if (code === "auth/unauthorized-domain" || upperMessage.includes("UNAUTHORIZED_DOMAIN")) {
      return "โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authorized domains";
    }
    if (code === "auth/too-many-requests") return "ส่ง OTP บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
    if (code === "auth/invalid-app-credential") return "สภาพแวดล้อมไม่รองรับการส่ง SMS กรุณาตรวจสอบ Firebase";
    return error?.message || "ส่ง OTP ไม่สำเร็จ";
  }

  function mapFirebaseVerifyError(error) {
    const code = String(error?.code || "");
    if (code === "auth/invalid-verification-code") return "รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    if (code === "auth/code-expired") return "รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่";
    return error?.message || "ยืนยัน OTP ไม่สำเร็จ";
  }

  function getNativeFirebaseAuth() {
    return window.Capacitor?.Plugins?.FirebaseAuthentication || null;
  }

  async function ensureNativeOtpListeners() {
    const nativeAuth = getNativeFirebaseAuth();
    if (!nativeAuth || nativeOtpListenersReady) return;
    nativeOtpListenersReady = true;

    await nativeAuth.addListener("phoneCodeSent", (event) => {
      clearNativeSendTimeout();
      nativeVerificationId = event?.verificationId || "";
      confirmationResult = { provider: "native-firebase" };
      otpProvider = "native-firebase";
      logOtp("native.phoneCodeSent", { hasVerificationId: !!nativeVerificationId });
      setHint(t('otp_sent_to_phone', 'ส่งรหัส OTP เข้ามือถือของคุณแล้ว'));
      startTimer(120);
    });

    await nativeAuth.addListener("phoneVerificationCompleted", async () => {
      clearNativeSendTimeout();
      logOtp("native.phoneVerificationCompleted");
      try {
        await finishNativeFirebaseVerification();
      } catch (error) {
        logOtp("native.phoneVerificationCompleted.error", { message: error?.message || "unknown" });
        showErr(mapFirebaseVerifyError(error));
      }
    });

    await nativeAuth.addListener("phoneVerificationFailed", async (event) => {
      clearNativeSendTimeout();
      logOtp("native.phoneVerificationFailed", { message: event?.message || "" });
      const phone = getPhone();
      await fallbackToWebFirebaseOtp(phone, event?.message || "native failed");
    });
  }

  async function verifyFirebaseIdTokenWithBackend(idToken, phone) {
    const res = await fetch(getApiBase() + "/api/auth/firebase/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, phone }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(window.i18nApiMessage?.(json.message, 'otp_invalid') || t('otp_invalid', "ยืนยัน OTP ไม่สำเร็จ"));
    return json.data || json;
  }

  async function handleVerifiedPayload(payload) {
    const flow = sessionStorage.getItem("otp_flow");
    if (flow === "forgot_password") {
      if (payload.isNewUser) {
        showErr("ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณาสมัครสมาชิกก่อน");
        throw new Error("__redirect__");
      }
      sessionStorage.setItem("reset_temp_token", payload.temp_token || "");
      if (window.navigateWithTransition) window.navigateWithTransition("./forgot-password.html?step=3");
      else window.location.href = "./forgot-password.html?step=3";
      throw new Error("__redirect__");
    }

    sessionStorage.setItem(KEY_TEMP_TOKEN, payload.temp_token || "");
    if (!payload.isNewUser) {
      markExistingAccount();
      throw new Error("__redirect__");
    }
  }

  async function finishNativeFirebaseVerification() {
    const phone = getPhone();
    const nativeAuth = getNativeFirebaseAuth();
    if (!nativeAuth) throw new Error("ไม่พบ Firebase Authentication plugin");
    const tokenResult = await nativeAuth.getIdToken({ forceRefresh: true });
    const idToken = tokenResult?.token || "";
    if (!idToken) throw new Error("ไม่พบ Firebase ID token");
    const payload = await verifyFirebaseIdTokenWithBackend(idToken, phone);
    await handleVerifiedPayload(payload);
  }

  async function sendOtp() {
    clearErr();
    const phone = getPhone();
    if (!phone) {
      showErr("ไม่พบเบอร์โทรจากขั้นตอนก่อนหน้า");
      return;
    }

    try {
      if (IS_NATIVE) {
        const nativeAuth = getNativeFirebaseAuth();
        if (!nativeAuth) throw new Error("ไม่พบ Firebase Authentication plugin");
        await ensureNativeOtpListeners();
        setHint(t('sending_otp_firebase_native', 'กำลังส่งรหัส OTP ผ่าน Firebase Native...'));
        const cleanPhone = toE164(phone);
        otpProvider = "native-firebase";
        nativeVerificationId = "";
        confirmationResult = null;
        clearNativeSendTimeout();
        nativeSendTimeoutId = setTimeout(() => {
          if (!confirmationResult && !nativeVerificationId) {
            clearNativeSendTimeout();
            fallbackToWebFirebaseOtp(phone, "native timeout");
          }
        }, 30000);
        logOtp("native.signInWithPhoneNumber.start", { phone: cleanPhone });
        try {
          await nativeAuth.signInWithPhoneNumber({ phoneNumber: cleanPhone, timeout: 60 });
        } catch (error) {
          clearNativeSendTimeout();
          await fallbackToWebFirebaseOtp(phone, error?.message || "native rejected");
        }
        return;
      }

      await sendWebFirebaseOtp(phone);
    } catch (error) {
      logOtp("otp.send.error", { message: error.message });
      showErr(mapFirebaseOtpError(error));
    }
  }

  async function verifyOtp(otp) {
    const phone = getPhone();
    if (!phone) throw new Error("ไม่พบเบอร์โทร");
    if (!getApiBase()) throw new Error("ไม่พบการตั้งค่า API_BASE_URL");
    if (remaining <= 0) throw new Error("รหัสหมดอายุ กรุณาขอรหัสใหม่");
    if (!confirmationResult) throw new Error("ไม่พบคำขอ OTP กรุณากดขอรหัสใหม่");

    if (otpProvider === "native-firebase") {
      const nativeAuth = getNativeFirebaseAuth();
      if (!nativeAuth) throw new Error("ไม่พบ Firebase Authentication plugin");
      if (!nativeVerificationId) throw new Error("ไม่พบ verification ID กรุณาขอรหัสใหม่");
      await nativeAuth.confirmVerificationCode({
        verificationId: nativeVerificationId,
        verificationCode: otp,
      });
      await finishNativeFirebaseVerification();
      return;
    }

    const firebaseUserCredential = await confirmationResult.confirm(otp);
    const idToken = await firebaseUserCredential.user.getIdToken();
    logOtp("otp.verify.firebase.success", {
      uid: firebaseUserCredential?.user?.uid || "",
      phoneNumber: firebaseUserCredential?.user?.phoneNumber || "",
      hasIdToken: !!idToken,
    });

    const payload = await verifyFirebaseIdTokenWithBackend(idToken, phone);
    await handleVerifiedPayload(payload);
  }

  resendB?.addEventListener("click", async () => {
    if (remaining > 0) return;
    setOtp("");
    boxes[0]?.focus();
    await sendOtp();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErr();
    const otp = getOtp();
    if (otp.length !== OTP_LEN) {
      showErr("กรุณากรอกรหัส OTP ให้ครบ 6 หลัก");
      return;
    }

    try {
      setLoad(true);
      await verifyOtp(otp);
      if (DEBUG_REDIRECT_DELAY_MS > 0) {
        setHint(t('otp_verified_redirecting', 'ยืนยันสำเร็จ กำลังไปหน้าถัดไป...'));
        setTimeout(() => {
          if (window.navigateWithTransition) window.navigateWithTransition(NEXT_ROUTE);
          else window.location.href = NEXT_ROUTE;
        }, DEBUG_REDIRECT_DELAY_MS);
      } else if (window.navigateWithTransition) {
        window.navigateWithTransition(NEXT_ROUTE);
      } else {
        window.location.href = NEXT_ROUTE;
      }
    } catch (error) {
      if (error?.message !== "__redirect__") {
        logOtp("otp.verify.error", { code: error?.code || "", message: error?.message || "unknown" });
        showErr(mapFirebaseVerifyError(error));
      }
    } finally {
      setLoad(false);
    }
  });

  window.addEventListener("error", (event) => {
    logOtp("window.error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason || {};
    logOtp("window.unhandledrejection", {
      message: reason.message || String(reason),
      code: reason.code || "",
      stack: reason.stack || "",
    });
  });

  if (video) {
    video.muted = true;
    video.playsInline = true;
    const resumeVideo = () => video.play().catch(() => fallbk?.classList.add("is-show"));
    const startVideo = () => { if (!document.hidden) resumeVideo(); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(startVideo, { timeout: 1200 });
    else setTimeout(startVideo, 300);
    video.addEventListener("error", () => fallbk?.classList.add("is-show"));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) video.pause();
      else if (video.paused) resumeVideo();
    });
  }
  if (otpTo) {
    otpTo.innerHTML = t('otp_sent_to_number', 'ส่งรหัสไปที่หมายเลข') + ' <span class="to-num">' + maskPhone(getPhone()) + "</span>";
  }

  setConfigSourceStatus();
  bindBoxes();
  sendOtp();
})();
