/* js/login/register/login1.js (FIXED)
   - Bind events after DOM ready (แก้กดปุ่มแล้วไม่ไปหน้า)
   - Safe even if overlay/fallback/hint not present
   - Navigate to login2/register1
   - Store redirectAfterAuth from ?next=
*/
(function () {
  const goLogin = document.getElementById("goLogin");
  const goRegister = document.getElementById("goRegister");
  const hint = document.getElementById("hintText");

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "";

  function withNext(path) {
    return next ? `${path}?next=${encodeURIComponent(next)}` : path;
  }

  goLogin?.addEventListener("click", () => {
    if (hint) hint.textContent = "กำลังไปยังหน้าเข้าสู่ระบบ…";
    window.location.href = withNext("./login2.html");
  });

  goRegister?.addEventListener("click", () => {
    if (hint) hint.textContent = "กำลังไปยังหน้าสมัครสมาชิก…";
    window.location.href = withNext("./register1.html");
  });
})();

(function () {
  const ROUTES = {
    login2: "./login2.html",
    register1: "./register1.html",
  };

  const AUTH = {
    redirectKey: "redirectAfterAuth",
  };

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(() => {
    const video = document.getElementById("welcomeVideo");
    const overlay = document.getElementById("playOverlay");
    const fallback = document.getElementById("mediaFallback");
    const hintText = document.getElementById("hintText");

    const goLoginBtn = document.getElementById("goLogin");
    const goRegisterBtn = document.getElementById("goRegister");

    function setHint(msg) {
      if (!hintText) return;
      hintText.textContent = msg || "";
    }

    function safeShowFallback(on) {
      if (!fallback) return;
      fallback.classList.toggle("is-show", !!on);
    }

    function goTo(path) {
      window.location.href = path;
    }

    function storeNextFromQuery() {
      try {
        const url = new URL(window.location.href);
        const next = url.searchParams.get("next");
        if (next) sessionStorage.setItem(AUTH.redirectKey, next);
      } catch (_) {}
    }

    async function tryAutoPlay() {
      if (!video) return;

      video.muted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");

      try {
        const p = video.play();
        if (p && typeof p.then === "function") await p;

        // เล่นได้ -> ซ่อน overlay (ถ้ามี)
        if (overlay) overlay.classList.add("is-hide");
        safeShowFallback(false);
        setHint("");
      } catch (e) {
        // เล่นไม่ได้ -> แสดง overlay / fallback (ถ้ามี)
        if (overlay) overlay.classList.remove("is-hide");
        safeShowFallback(true);
        setHint("แตะปุ่มเล่นเพื่อเริ่มวิดีโอ");
      }
    }

    // overlay: แตะเพื่อ play (ไม่ pause เพื่อกันผู้ใช้หยุด)
    function playOnly() {
      if (!video) return;

      video.muted = true;
      video.play().then(() => {
        if (overlay) overlay.classList.add("is-hide");
        safeShowFallback(false);
        setHint("");
      }).catch(() => {
        if (overlay) overlay.classList.remove("is-hide");
        safeShowFallback(true);
        setHint("ไม่สามารถเล่นวิดีโออัตโนมัติได้");
      });
    }

    // ====== Bind events (สำคัญ) ======
    if (overlay) overlay.addEventListener("click", playOnly);

    if (goLoginBtn) {
      goLoginBtn.addEventListener("click", (e) => {
        e.preventDefault(); // กันกรณีปุ่มอยู่ใน form
        goTo(ROUTES.login2);
      });
    } else {
      // ช่วย debug: ถ้าหาปุ่มไม่เจอ แปลว่า id ใน HTML ไม่ตรง
      console.warn('[login1] ไม่พบปุ่ม id="goLogin"');
    }

    if (goRegisterBtn) {
      goRegisterBtn.addEventListener("click", (e) => {
        e.preventDefault();
        goTo(ROUTES.register1);
      });
    } else {
      console.warn('[login1] ไม่พบปุ่ม id="goRegister"');
    }

    // video events
    if (video) {
      video.addEventListener("error", () => {
        safeShowFallback(true);
        if (overlay) overlay.classList.remove("is-hide");
        setHint("ไม่พบไฟล์วิดีโอ (ตรวจสอบ path)");
      });

      video.addEventListener("playing", () => {
        if (overlay) overlay.classList.add("is-hide");
        safeShowFallback(false);
        setHint("");
      });
    }

    // init
    storeNextFromQuery();
    tryAutoPlay();
  });
})();
