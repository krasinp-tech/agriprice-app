/**
 * booking.js (fixed)
 * - Fix: escapeHtml not defined
 * - Fix: safe search (avoid toLowerCase on undefined)
 * - Improve: QR modal open/close + scan loop safety
 * - Ready for future DB: fetchBookings() can be replaced with real API
 */

/* =========================
   Helpers
========================= */
function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeLower(input) {
  return String(input ?? "").toLowerCase();
}

function mapStatusText(status) {
  if (status === "waiting") return "รอคิว";
  if (status === "success") return "สำเร็จ";
  if (status === "cancel") return "ยกเลิก";
  return "ไม่ทราบสถานะ";
}


async function fetchBookings() {
  // Future:
  // return fetch('/api/bookings').then(r => r.json())
  return new Promise((resolve) => setTimeout(() => resolve(window.getMockupBookings()), 120));
}

/* =========================
   Shared bookings list
   (scanner uses this)
========================= */
let BOOKINGS = [];

/* =========================
   Render booking card
========================= */
function renderCard(b) {
  const badgeClass = b.status || "unknown";
  const statusText = mapStatusText(b.status);

  const phoneLine = b.phone
    ? `<div class="meta">โทร: <b>${escapeHtml(b.phone)}</b></div>`
    : "";

  const productLine = b.productName
    ? `<div class="meta">${escapeHtml(b.productName)} — <b>${Number(
        b.quantityKg || 0
      ).toLocaleString()} กก.</b></div>`
    : "";

  // Vehicle information
  const vehiclesInfo = b.vehicles && Array.isArray(b.vehicles) && b.vehicles.length > 0
    ? `<div class="vehicleInfo">
        <div class="vehicleHeader"> รถ (${b.vehicles.length} คัน)</div>
        <div class="vehicleList">
          ${b.vehicles.map((v) => `
            <div class="vehicleItem">
              <div class="vehiclePlate">${escapeHtml(v.plate || "-")}</div>
              <div class="vehicleType">${escapeHtml(v.type || "-")}</div>
            </div>
          `).join("")}
        </div>
      </div>`
    : "";

  return `
    <article class="booking-card" data-id="${escapeHtml(b.bookingId)}">
      <div class="row">
        <div class="shop">${escapeHtml(b.shopName || "-")}</div>
        <div class="badge ${escapeHtml(badgeClass)}">${escapeHtml(statusText)}</div>
      </div>

      <div class="meta">
        เลขที่การจอง: <b>${escapeHtml(b.bookingId || "-")}</b> • เวลานัดคิว: <b>${escapeHtml(
          b.time || "-"
        )} น.</b>
      </div>

      ${phoneLine}
      ${productLine}
      ${vehiclesInfo}

      <div class="queueBox">
        <div>
          <div class="queueLabel">หมายเลขคิว</div>
          <div class="queueNo">${escapeHtml(b.queueNo || "-")}</div>
        </div>
        <div class="meta" style="text-align:right;">
          <div style="opacity:.7;font-size:12px;">วันที่ทำรายการ</div>
          <div><b>${escapeHtml(b.createdAt || "-")}</b></div>
        </div>
      </div>

      <div class="cta">
        <button class="btn" type="button" data-open>ดูรายละเอียด</button>
      </div>
    </article>
  `;
}

/* =========================
   Main module
========================= */
(function initBookingPage() {
  // Bottom nav
  if (typeof setActiveBottomNav === "function") {
    setActiveBottomNav("booking");
  }

  const listEl = document.getElementById("bookingList");
  const emptyEl = document.getElementById("emptyState");
  const searchEl = document.getElementById("searchInput");

  if (!listEl || !emptyEl || !searchEl) return;

  let filter = "all";
  let keyword = "";

  function apply() {
    const k = keyword.trim().toLowerCase();

    const filtered = BOOKINGS.filter((b) => {
      const passFilter = filter === "all" ? true : (b.status === filter);

      const passSearch =
        !k ||
        safeLower(b.bookingId).includes(k) ||
        safeLower(b.shopName).includes(k) ||
        safeLower(b.queueNo).includes(k);

      return passFilter && passSearch;
    });

    listEl.innerHTML = filtered.map(renderCard).join("");
    emptyEl.hidden = filtered.length !== 0;

    // click -> detail
    listEl.querySelectorAll(".booking-card").forEach((card) => {
      const id = card.dataset.id;

      card.addEventListener("click", (e) => {
        const open = e.target.closest("[data-open]");
        if (open || !e.target.closest("a")) {
          window.location.href = `Booking information.html?bookingId=${encodeURIComponent(id)}`;
        }
      });
    });
  }

  // filter buttons
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter || "all";
      apply();
    });
  });

  // search
  searchEl.addEventListener("input", () => {
    keyword = searchEl.value || "";
    apply();
  });

  // initial load
  fetchBookings().then((data) => {
    BOOKINGS = Array.isArray(data) ? data : [];
    apply();
  });
})();

/* =========================
   QR Scanner module
========================= */
(function qrScannerModule() {
  const scanBtn = document.getElementById("scanBtn");
  const scanModal = document.getElementById("scanModal");
  const closeScanBtn = document.getElementById("closeScanBtn");
  const scanVideo = document.getElementById("scanVideo");
  const scanManualInput = document.getElementById("scanManualInput");
  const scanManualBtn = document.getElementById("scanManualBtn");

  if (!scanBtn || !scanModal || !closeScanBtn || !scanVideo || !scanManualInput || !scanManualBtn) return;

  let stream = null;
  let detector = null;
  let scanInterval = null;

  function openModal() {
    scanModal.classList.add("show");
    scanModal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    scanModal.classList.remove("show");
    scanModal.setAttribute("aria-hidden", "true");
  }

  async function startScanner() {
    try {
      openModal();

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      scanVideo.srcObject = stream;

      // wait video ready (prevents zero width/height canvas)
      await new Promise((resolve) => {
        if (scanVideo.readyState >= 2) return resolve();
        scanVideo.onloadedmetadata = () => resolve();
      });

      // init BarcodeDetector if supported
      if (window.BarcodeDetector) {
        try {
          detector = new BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }

      // scanning loop
      scanInterval = setInterval(async () => {
        if (!detector) return; // manual fallback only
        try {
          const w = scanVideo.videoWidth || 0;
          const h = scanVideo.videoHeight || 0;
          if (!w || !h) return;

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(scanVideo, 0, 0, w, h);

          const results = await detector.detect(canvas);
          if (results && results.length) {
            const raw = results[0].rawValue || "";
            if (raw) handleDetected(raw);
          }
        } catch {
          // ignore per-frame errors
        }
      }, 350);
    } catch (err) {
      stopScanner();
      alert("ไม่สามารถเปิดกล้องได้: " + (err && err.message ? err.message : "unknown"));
    }
  }

  function stopScanner() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    try {
      scanVideo.srcObject = null;
    } catch {}
    closeModal();
  }

  function handleDetected(value) {
    const searchVal = String(value || "").trim();
    if (!searchVal) return;

    const found = BOOKINGS.find((b) => {
      const id = String(b.bookingId || "");
      const shop = String(b.shopName || "");
      return id === searchVal || id.includes(searchVal) || shop.includes(searchVal);
    });

    if (found) {
      stopScanner();

      const card = document.querySelector(`.booking-card[data-id="${CSS.escape(found.bookingId)}"]`);
      if (card) {
        document.querySelectorAll(".booking-card").forEach((c) => c.classList.remove("highlight"));
        card.classList.add("highlight");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      alert("พบการจอง: " + found.bookingId + " — " + (found.shopName || ""));
    } else {
      alert("ไม่พบการจองที่ตรงกับ: " + searchVal);
    }
  }

  // events
  scanBtn.addEventListener("click", () => startScanner());
  closeScanBtn.addEventListener("click", () => stopScanner());

  scanManualBtn.addEventListener("click", () => {
    const v = (scanManualInput.value || "").trim();
    if (!v) return alert("กรุณากรอกหมายเลขการจอง");
    handleDetected(v);
  });

  scanModal.addEventListener("click", (e) => {
    if (e.target === scanModal) stopScanner();
  });
})();
