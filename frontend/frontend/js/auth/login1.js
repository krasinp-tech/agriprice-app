/* js/auth/login1.js
   - ผูกอีเวนต์หลัง DOM พร้อมใช้งาน
   - ปลอดภัยแม้ไม่มี overlay / fallback / hint
   - ไปหน้า login2 หรือ register1
   - เก็บ redirectAfterAuth จาก ?next=
*/
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
      if (window.navigateWithTransition) window.navigateWithTransition(path); else window.location.href = path;
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

        // เล่นได้ -> ซ่อน overlay ถ้ามี
        if (overlay) overlay.classList.add("is-hide");
        safeShowFallback(false);
        setHint("");
      } catch (e) {
        // เล่นไม่ได้ -> แสดง overlay / fallback ถ้ามี
        if (overlay) overlay.classList.remove("is-hide");
        safeShowFallback(true);
        setHint("แตะปุ่มเล่นเพื่อเริ่มวิดีโอ");
      }
    }

    // overlay: แตะเพื่อเล่นวิดีโอ
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

    // ====== ผูกอีเวนต์ ======
    if (overlay) overlay.addEventListener("click", playOnly);

    if (goLoginBtn) {
      goLoginBtn.addEventListener("click", (e) => {
        e.preventDefault(); // กันไม่ให้ปุ่มทำงานแบบ submit
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

