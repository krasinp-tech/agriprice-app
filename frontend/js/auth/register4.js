/* js/auth/register4.js - Password Setup Screen */
(function () {
  "use strict";

  const form = document.getElementById("registerForm");
  const pwEl = document.getElementById("password");
  const cfEl = document.getElementById("confirmPassword");
  const btn = document.getElementById("finishBtn");
  const t = (key, fallback) => window.i18nT ? window.i18nT(key, fallback) : fallback;
  const video = document.getElementById("registerVideo");
  const videoFallback = document.getElementById("mediaFallback");

  function setLoading(on) {
    if (window.setBtnLoading) window.setBtnLoading(btn, on);
    else if (btn) btn.disabled = !!on;
  }

  function setupVideo() {
    if (!video) return;
    video.muted = true;
    video.playsInline = true;

    const resumeVideo = () => {
      const playAttempt = video.play();
      if (!playAttempt || typeof playAttempt.then !== "function") return;
      playAttempt
        .then(() => videoFallback?.classList.remove("is-show"))
        .catch(() => videoFallback?.classList.add("is-show"));
    };

    resumeVideo();
    video.addEventListener("canplay", resumeVideo, { once: true });
    video.addEventListener("error", () => videoFallback?.classList.add("is-show"));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && video.paused) resumeVideo();
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const password = pwEl.value.trim();
    const confirm = cfEl.value.trim();

    if (password.length < 8) {
      if (window.showToast) window.showToast(t("password_min_8", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"), "error");
      return;
    }
    if (password !== confirm) {
      if (window.showToast) window.showToast(t("password_mismatch", "รหัสผ่านไม่ตรงกัน"), "error");
      return;
    }

    const tempToken = sessionStorage.getItem("otp_temp_token");
    const role = sessionStorage.getItem("reg_role");
    const profileRaw = sessionStorage.getItem("reg_profile");

    if (!tempToken || !role || !profileRaw) {
      if (window.showToast) window.showToast(t("registration_data_incomplete", "ข้อมูลการสมัครไม่ครบถ้วน กรุณาเริ่มใหม่"), "error");
      setTimeout(() => window.location.href = "register1.html", 1500);
      return;
    }

    setLoading(true);
    try {
      const profile = JSON.parse(profileRaw);
      const result = await window.api.registerFinish(tempToken, role, profile, password);

      if (result.success && result.token) {
        // [CLEANUP] Use unified persistAuth
        window.api.persistAuth(result.token, result.user);
        
        sessionStorage.removeItem("otp_temp_token");
        sessionStorage.removeItem("reg_role");
        sessionStorage.removeItem("reg_profile");

        if (window.showToast) window.showToast(t("registration_success", "ลงทะเบียนสำเร็จ!"), "success");

        // [CLEANUP] Use unified redirect from AuthGuard
        setTimeout(() => {
          if (window.AuthGuard && window.AuthGuard.redirectAfterLogin) {
            window.AuthGuard.redirectAfterLogin();
          } else {
            window.location.href = "../../index.html";
          }
        }, 800);
      } else {
        throw new Error(window.i18nApiMessage?.(result.message, 'registration_failed') || t("registration_failed", "การลงทะเบียนไม่สำเร็จ"));
      }
    } catch (err) {
      if (window.appNotify) window.appNotify(err.message, "error");
      else console.error(err);
    } finally {
      setLoading(false);
    }
  }

  form && form.addEventListener("submit", onSubmit);

  // Password visibility toggles
  const toggle1 = document.getElementById("togglePw1");
  const toggle2 = document.getElementById("togglePw2");
  function toggleInputType(input) {
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
  }
  toggle1 && toggle1.addEventListener("click", () => toggleInputType(pwEl));
  toggle2 && toggle2.addEventListener("click", () => toggleInputType(cfEl));
  setupVideo();
})();
