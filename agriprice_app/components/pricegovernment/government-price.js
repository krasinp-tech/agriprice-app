(function initGovernmentPrice() {
  const scriptSrc = document.currentScript?.src || "";
  const componentBaseUrl = scriptSrc ? new URL("./", scriptSrc) : null;

  const track    = document.getElementById("governmentCarousel");
  const dotsWrap = document.getElementById("governmentDots");
  if (!track || !dotsWrap) return;

  const pages = Array.from(track.querySelectorAll(".government-page"));
  const items = Array.from(track.querySelectorAll(".government-item"));
  if (!pages.length) return;

  function getPageWidth()   { return track.offsetWidth || window.innerWidth; }
  function getCurrentPage() {
    return Math.min(Math.round(track.scrollLeft / getPageWidth()), pages.length - 1);
  }

  function scrollToPage(idx, smooth = true) {
    idx = Math.max(0, Math.min(idx, pages.length - 1));
    track.scrollTo({ left: idx * getPageWidth(), behavior: smooth ? "smooth" : "instant" });
  }

  function setActiveDot() {
    Array.from(dotsWrap.querySelectorAll(".dot"))
      .forEach((d, i) => d.classList.toggle("active", i === getCurrentPage()));
  }

  function buildDots() {
    dotsWrap.innerHTML = "";
    pages.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = "dot" + (i === 0 ? " active" : "");
      dot.addEventListener("click", () => scrollToPage(i));
      dotsWrap.appendChild(dot);
    });
  }

  /* ── Mouse drag (desktop only) ──────────── */
  let mouseDown = false, mouseStartX = 0, mouseStartLeft = 0, mouseMoved = false;
  const THRESHOLD = 8;

  track.addEventListener("mousedown", (e) => {
    mouseDown = true; mouseMoved = false;
    mouseStartX = e.clientX; mouseStartLeft = track.scrollLeft;
    track.classList.add("dragging");
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - mouseStartX;
    if (Math.abs(dx) > THRESHOLD) mouseMoved = true;
    track.scrollLeft = mouseStartLeft - dx;
  });

  window.addEventListener("mouseup", () => {
    if (!mouseDown) return;
    mouseDown = false;
    track.classList.remove("dragging");
    if (mouseMoved) scrollToPage(Math.round(track.scrollLeft / getPageWidth()));
  });

  /* ── ป้องกัน click ตอน drag (desktop) ──── */
  track.addEventListener("click", (e) => {
    if (mouseMoved) {
      e.preventDefault();
      e.stopImmediatePropagation();
      mouseMoved = false;
      return;
    }
    const item = e.target.closest(".government-item");
    if (!item) return;

    const name = (item.querySelector("span")?.textContent || "")
      .trim().replace(/\s+\d+$/, "");
    if (!name) return;

    items.forEach(el => el.classList.remove("active"));
    item.classList.add("active");

    const cardPage = componentBaseUrl
      ? new URL("government-price-card.html", componentBaseUrl).toString()
      : "components/pricegovernment/government-price-card.html";

    window.location.href = `${cardPage}?commodity=${encodeURIComponent(name)}`;
  }, true);

  /* ── Sync dots on scroll ─────────────────── */
  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(setActiveDot);
  }, { passive: true });

  window.addEventListener("resize", () => {
    buildDots();
    scrollToPage(getCurrentPage(), false);
  });

  buildDots();
  setActiveDot();
})();