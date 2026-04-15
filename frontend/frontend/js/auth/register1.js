/* js/auth/register1.js
  - เลือกประเภทผู้ใช้ (farmer/buyer)
  - เล่นวิดีโออัตโนมัติ (ด้านบน + ในการ์ด)
  - ถัดไป -> เปิด modal ยืนยัน
  - ยืนยัน -> ไป register2 พร้อม role และเก็บ sessionStorage
  - พร้อมต่อ DB ภายหลัง: role ถูกส่งไปกับ query param
*/

(function () {
  const KEY_ROLE = "register_role";

  const cards = Array.from(document.querySelectorAll(".role-card"));
  const nextBtn = document.getElementById("nextBtn");
  const hint = document.getElementById("hintText");

  const modal = document.getElementById("confirmModal");
  const modalText = document.getElementById("modalText");
  const cancelBtn = document.getElementById("cancelBtn");
  const confirmBtn = document.getElementById("confirmBtn");
  const backdrop = document.querySelector(".modal-backdrop");

  const topVideo = document.getElementById("registerVideo");
  const topSource = document.getElementById("topVideoSource");
  const fallback = document.getElementById("mediaFallback");

  const roleNameMap = {
    farmer: "เกษตรกร",
    buyer: "ผู้รับซื้อ",
  };

  const ROUTES = {
    register2: "./register2.html",
  };

  function setHint(msg) {
    if (!hint) return;
    hint.textContent = msg || "";
  }

  function showFallback(on) {
    if (!fallback) return;
    fallback.classList.toggle("is-show", !!on);
  }

  function hardenVideo(v) {
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("muted", "");
    v.setAttribute("loop", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("autoplay", "");
    v.setAttribute("disablepictureinpicture", "");
    v.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
    v.removeAttribute("controls");
  }

  async function safePlay(v, onFail) {
    if (!v) return;
    try {
      const p = v.play();
      if (p && typeof p.then === "function") await p;
      if (onFail) onFail(false);
    } catch (e) {
      if (onFail) onFail(true);
    }
  }

  function setupVideos() {
    // อนาคต: เปิดให้เปลี่ยนวิดีโอตาม config ได้
    const customTop = window.REGISTER_VIDEO_URL;
    if (customTop && topSource) topSource.src = customTop;

    hardenVideo(topVideo);
    safePlay(topVideo, (failed) => showFallback(!!failed));

    // วิดีโอในการ์ด role
    document.querySelectorAll(".role-video").forEach((v) => {
      hardenVideo(v);
      safePlay(v);
    });

    // พยายามเล่นต่อหาก browser หยุดเล่นเอง
    if (topVideo) {
      topVideo.addEventListener("pause", () => {
        topVideo.muted = true;
        topVideo.play().catch(() => {});
      });
      topVideo.addEventListener("error", () => showFallback(true));
    }
  }

  function setSelected(role) {
    sessionStorage.setItem(KEY_ROLE, role);

    cards.forEach((c) => {
      const is = c.dataset.role === role;
      c.classList.toggle("is-selected", is);
      c.setAttribute("aria-pressed", is ? "true" : "false");
    });

    nextBtn.disabled = !role;
    setHint(role ? `เลือกแล้ว: ${roleNameMap[role]} - กดถัดไปเพื่อยืนยัน` : "กรุณาเลือกประเภทผู้ใช้งาน");
  }

  function restoreSelection() {
    const role = sessionStorage.getItem(KEY_ROLE);
    if (role && roleNameMap[role]) setSelected(role);
    else setSelected("");
  }

  function openModal(role) {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal.dataset.role = role;

    modalText.textContent = `คุณต้องการสมัครเป็น “${roleNameMap[role]}” ใช่หรือไม่?`;
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    delete modal.dataset.role;
  }

  function bindEvents() {
    cards.forEach((c) => {
      c.addEventListener("click", () => setSelected(c.dataset.role));
    });

    nextBtn.addEventListener("click", () => {
      const role = sessionStorage.getItem(KEY_ROLE);
      if (!role) {
        setHint("กรุณาเลือกประเภทผู้ใช้งานก่อน");
        return;
      }
      openModal(role);
    });

    cancelBtn && cancelBtn.addEventListener("click", closeModal);
    backdrop && backdrop.addEventListener("click", (e) => {
      if (e.target && e.target.dataset && e.target.dataset.close) closeModal();
      // คลิกพื้นหลังเพื่อปิด modal
      closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    confirmBtn && confirmBtn.addEventListener("click", () => {
      const role = modal.dataset.role || sessionStorage.getItem(KEY_ROLE);
      if (!role) return;

      // ไป step2 พร้อมส่ง role ให้ backend
      if (window.navigateWithTransition) window.navigateWithTransition(`${ROUTES.register2}?role=${encodeURIComponent(role)}`); else window.location.href = `${ROUTES.register2}?role=${encodeURIComponent(role)}`;
    });
  }

  // init
  setupVideos();
  bindEvents();
  restoreSelection();
})();

