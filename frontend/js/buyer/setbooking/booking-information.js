/**
 * AGRIPRICE - buyer booking detail
 * Uses the backend booking API only. No sample booking records are kept here.
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

  const escapeHtml = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const btnBack = document.getElementById("btnBack");
  const toggleDetailBtn = document.getElementById("toggleDetailBtn");
  const btnCancelBooking = document.getElementById("btnCancelBooking");
  const queueNo = document.getElementById("queueNo");
  const timeText = document.getElementById("timeText");
  const bookingIdText = document.getElementById("bookingIdText");
  const currentQueue = document.getElementById("currentQueue");
  const myQueue = document.getElementById("myQueue");
  const aheadCount = document.getElementById("aheadCount");
  const eta = document.getElementById("eta");
  const shopName = document.getElementById("shopName");
  const shopAddr = document.getElementById("shopAddr");
  const farmerPhone = document.getElementById("farmerPhone");
  const btnCall = document.getElementById("btnCall");
  const btnChat = document.getElementById("btnChat");
  const btnOpenMap = document.getElementById("btnOpenMap");
  const detailPanel = document.getElementById("detailPanel");
  const qrCanvas = document.getElementById("qrCanvas");
  const vehicleCountTotal = document.getElementById("vehicleCountTotal");
  const vehiclesList = document.getElementById("vehiclesList");

  function t(key, fallback) {
    return window.i18nT ? window.i18nT(key, fallback) : fallback;
  }

  function getRelativePrefixToRoot() {
    const path = (window.location.pathname || "").replace(/\\/g, "/");
    const dir = path.endsWith("/") ? path : path.substring(0, path.lastIndexOf("/") + 1);
    const idx = dir.lastIndexOf("/pages/");
    if (idx === -1) return "";
    const afterPages = dir.substring(idx + "/pages/".length);
    const depth = afterPages.split("/").filter(Boolean).length;
    return "../" + "../".repeat(depth);
  }

  const prefixRoot = getRelativePrefixToRoot();

  function resolveToRootUrl(p) {
    if (!p) return "";
    if (/^(https?:\/\/|data:|blob:|#|tel:|mailto:)/i.test(p)) return p;
    const normalized = String(p).replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
    return prefixRoot + normalized;
  }

  const getApiBase = () => window.getAgriPriceApiUrl
    ? window.getAgriPriceApiUrl()
    : (window.API_BASE_URL || "").replace(/\/$/, "");

  const tokenKey = window.AUTH_TOKEN_KEY || "token";
  const authHeaders = () => {
    const token = localStorage.getItem(tokenKey) || "";
    return token ? { Authorization: "Bearer " + token } : {};
  };

  function readStoredBooking() {
    try {
      const raw = localStorage.getItem("confirmedBooking");
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeVehicles(d) {
    if (Array.isArray(d.vehicles)) return d.vehicles;
    if (Array.isArray(d.booking_vehicles)) {
      return d.booking_vehicles
        .map((v) => ({ plate: v.plate || v.plate_no || "", type: v.type || t("truck", "รถบรรทุก") }))
        .filter((v) => v.plate || v.type);
    }
    const plates = d.vehicle_plates || d.vehicle_info || "";
    if (plates) {
      return String(plates).split(",")
        .map((plate) => plate.trim())
        .filter(Boolean)
        .map((plate) => ({ plate, type: t("truck", "รถบรรทุก") }));
    }
    try {
      const note = typeof d.note === "string" ? JSON.parse(d.note || "{}") : (d.note || {});
      if (Array.isArray(note.vehicles)) return note.vehicles;
    } catch (_) {}
    return [];
  }

  function mapBookingRecord(raw, fallbackId) {
    const d = raw?.data?.booking || raw?.data || raw?.booking || raw || {};
    const farmer = d.farmer || d.seller || d.buyer_profile || null;
    const product = d.product || d.products || d.buy_offer || {};
    const vehicles = normalizeVehicles(d);
    const bookingId = String(d.booking_no || d.booking_id || fallbackId || "");

    return {
      bookingId,
      booking_id: d.booking_id || null,
      booking_no: d.booking_no || null,
      status: d.status || "waiting",
      shopName: farmer
        ? (farmer.shop_name || `${farmer.first_name || ""} ${farmer.last_name || ""}`.trim())
        : (d.shop_name || ""),
      fullName: farmer ? `${farmer.first_name || ""} ${farmer.last_name || ""}`.trim() : "",
      phone: farmer?.phone || d.farmer_phone || d.contact_phone || "",
      address: farmer
        ? [farmer.address_line1, farmer.address_line2].filter(Boolean).join(" ")
        : (d.address || ""),
      queueNo: d.queue_no || "",
      time: d.scheduled_time
        ? new Date(d.scheduled_time).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        : "",
      date: d.scheduled_time ? new Date(d.scheduled_time).toISOString() : "",
      productName: product.name || product.product_name || d.product_name || "",
      quantityKg: d.quantity || d.product_amount || d.expected_qty || 0,
      vehicles,
      vehicleCount: d.vehicle_count || vehicles.length || 0,
      slotName: d.slot?.slot_name || d.slot_name || "",
      mapLink: farmer?.map_link || farmer?.mapLink || "",
      chatTargetId: farmer?.profile_id || d.farmer_id || d.seller_id || null,
      dateFormatted: d.scheduled_time ? new Date(d.scheduled_time).toISOString() : "",
    };
  }

  const BookingAPI = {
    async loadConfirmedBooking() {
      const urlP = new URLSearchParams(window.location.search);
      const requestedId = urlP.get("bookingId") || urlP.get("bid") || urlP.get("id") || null;
      const stored = readStoredBooking();
      const lookupId = requestedId || stored?.booking_id || stored?.booking_no || stored?.bookingId || null;

      if (lookupId && window.api?.getBooking) {
        const json = await window.api.getBooking(lookupId);
        return mapBookingRecord(json, lookupId);
      }

      const apiBase = getApiBase();
      if (lookupId && apiBase) {
        const res = await fetch(`${apiBase}/api/bookings/${encodeURIComponent(lookupId)}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(t("booking_not_found", "ไม่พบข้อมูลการจองจากเซิร์ฟเวอร์"));
        const json = await res.json();
        return mapBookingRecord(json, lookupId);
      }

      if (stored && !requestedId) return mapBookingRecord(stored, stored.bookingId);
      return null;
    },

    async saveConfirmedBooking(data) {
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus(bookingData) {
      const lookupId = bookingData?.booking_id || bookingData?.booking_no || bookingData?.bookingId;
      if (!lookupId) {
        return { currentQueue: "-", waitingQueues: 0, estimatedMinutes: 0, averageTimePerQueue: 0 };
      }

      try {
        const json = window.api?.getQueueStatus
          ? await window.api.getQueueStatus(lookupId)
          : null;
        if (json) {
          const d = json.data || json || {};
          return {
            currentQueue: d.currentQueue || "-",
            waitingQueues: Number(d.waitingAhead || 0),
            estimatedMinutes: Number(d.estimatedMinutes || 0),
            averageTimePerQueue: Number(d.averageTimePerQueue || 0),
          };
        }
      } catch (e) {
        if (DEBUG_BOOKING) console.warn("[BookingAPI] queue-status:", e.message);
      }

      return { currentQueue: "-", waitingQueues: 0, estimatedMinutes: 0, averageTimePerQueue: 0 };
    },

    async cancelBooking(bookingId) {
      if (!bookingId) return { success: false, message: t("booking_id_not_found", "ไม่พบรหัสการจอง") };
      try {
        if (window.api?.updateBooking) {
          await window.api.updateBooking(bookingId, "cancel");
        } else {
          const apiBase = getApiBase();
          if (!apiBase) throw new Error(t("api_not_ready", "ยังไม่พร้อมเชื่อมต่อเซิร์ฟเวอร์"));
          const res = await fetch(`${apiBase}/api/bookings/${encodeURIComponent(bookingId)}`, {
            method: "PATCH",
            headers: { ...authHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancel" }),
          });
          if (!res.ok) throw new Error(t("cancel_error", "ยกเลิกการจองไม่สำเร็จ"));
        }

        localStorage.removeItem("confirmedBooking");
        localStorage.removeItem("bookingSlotId");
        localStorage.removeItem("bookingStep1");
        localStorage.removeItem("bookingStep2");
        localStorage.removeItem("bookingData");
        localStorage.removeItem("bookingReferrer");
        return { success: true, message: t("cancel_success", "ยกเลิกการจองสำเร็จ") };
      } catch (e) {
        return { success: false, message: e.message || t("cancel_error", "ยกเลิกการจองไม่สำเร็จ") };
      }
    },
  };

  function formatBookingDate(dateValue) {
    if (window.AgriPriceUI?.formatThaiDate) return window.AgriPriceUI.formatThaiDate(dateValue);
    if (!dateValue) return "-";
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "-";
    const lang = localStorage.getItem("lang") || "th";
    const locale = lang === "en" ? "en-US" : lang === "zh" ? "zh-CN" : "th-TH";
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(d);
  }

  function formatEstimatedTime(minutes) {
    if (window.AgriPriceUI?.formatEstimatedTime) return window.AgriPriceUI.formatEstimatedTime(minutes);
    const value = Number(minutes || 0);
    if (value < 60) return `${value} ${t("minute", "นาที")}`;
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    if (mins === 0) return `${hours} ${t("hour", "ชั่วโมง")}`;
    return `${hours} ${t("hour", "ชั่วโมง")} ${mins} ${t("minute", "นาที")}`;
  }

  function renderDetailPanel(bookingData) {
    return `
      <div><b>${t("shop_label", "ร้าน")}:</b> ${escapeHtml(bookingData.shopName || "-")}</div>
      <div><b>${t("address_label", "ที่อยู่")}:</b> ${escapeHtml(bookingData.address || "-")}</div>
      <div><b>${t("queue_number", "หมายเลขคิว")}:</b> ${escapeHtml(bookingData.queueNo || "-")}</div>
      <div><b>${t("queue_time", "เวลานัดคิว")}:</b> ${escapeHtml(bookingData.time ? bookingData.time + " น." : "-")}</div>
      <div><b>${t("transaction_date", "วันที่")}:</b> ${escapeHtml(formatBookingDate(bookingData.date || bookingData.dateFormatted))}</div>
      <div><b>${t("booking_number", "Booking ID")}:</b> ${escapeHtml(bookingData.bookingId || bookingData.booking_no || "-")}</div>
    `;
  }

  function renderVehicles(bookingData) {
    const vehicles = Array.isArray(bookingData.vehicles) ? bookingData.vehicles : [];
    const count = vehicles.length || bookingData.vehicleCount || 0;
    if (vehicleCountTotal) vehicleCountTotal.textContent = count || "-";

    if (!vehiclesList) return;
    if (vehicles.length === 0) {
      vehiclesList.innerHTML = "";
      return;
    }

    vehiclesList.innerHTML = vehicles.map((v) => `
      <div class="vehicleRow">
        <div class="vehicleRowContent">
          <div class="vehicleRowPlate">${escapeHtml(String(v.plate || "-").toUpperCase())}</div>
          <div class="vehicleRowType">${escapeHtml(v.type || "-")}</div>
        </div>
      </div>
    `).join("");
  }

  function buildQrPayload(bookingId) {
    let baseUrl = window.FRONTEND_URL || window.location.origin;
    if (baseUrl.startsWith('capacitor://') || baseUrl.startsWith('ionic://')) {
      const apiBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : '';
      if (apiBase && !apiBase.startsWith('capacitor://') && !apiBase.startsWith('ionic://')) {
        baseUrl = apiBase;
      } else {
        baseUrl = 'https://agriprice-otp.web.app';
      }
    }
    const url = new URL("pages/buyer/setbooking/booking-information.html", baseUrl);
    url.searchParams.set("bid", bookingId);
    return url.href;
  }

  function drawQrUnavailable() {
    if (!qrCanvas) return;
    qrCanvas.innerHTML = `<div style="width:110px;height:110px;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;text-align:center;border:1px solid #ddd;border-radius:4px;">${escapeHtml(t("qr_unavailable", "ไม่สามารถสร้าง QR ได้"))}</div>`;
  }

  function generateQRCode(text) {
    if (!qrCanvas) return;
    try {
      qrCanvas.innerHTML = "";
      new QRCode(qrCanvas, {
        text: String(text || ""),
        width: 110,
        height: 110,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
      drawQrUnavailable();
    }
  }

  async function loadSuccessData() {
    const bookingData = await BookingAPI.loadConfirmedBooking();
    if (!bookingData) throw new Error(t("booking_not_found", "ไม่พบข้อมูลการจอง"));
    if (!bookingData.bookingId) throw new Error(t("booking_id_not_found", "ไม่พบรหัสการจองจากเซิร์ฟเวอร์"));

    const slot = bookingData.queueNo || bookingData.slotId || localStorage.getItem("bookingSlotId") || "";
    if (queueNo) queueNo.textContent = slot || "-";
    if (myQueue) myQueue.textContent = slot || "-";
    if (bookingData.time && timeText) timeText.textContent = bookingData.time;

    await BookingAPI.saveConfirmedBooking(bookingData);
    if (bookingIdText) bookingIdText.textContent = bookingData.bookingId;
    generateQRCode(buildQrPayload(bookingData.bookingId));

    const queueStatus = await BookingAPI.loadQueueStatus(bookingData);
    if (currentQueue) currentQueue.textContent = queueStatus.currentQueue || "-";
    if (aheadCount) aheadCount.textContent = `${queueStatus.waitingQueues ?? 0} ${t("queue_suffix", "คิว")}`;
    if (eta) eta.textContent = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    if (shopName) shopName.textContent = bookingData.shopName || "-";
    if (shopAddr) shopAddr.textContent = bookingData.address || "-";
    if (farmerPhone) farmerPhone.textContent = bookingData.phone || "-";

    if (btnCall) {
      btnCall.onclick = () => {
        if (bookingData.phone) window.location.href = `tel:${bookingData.phone}`;
      };
    }

    if (btnChat) {
      btnChat.onclick = () => {
        const targetId = bookingData.chatTargetId || bookingData.farmerId;
        if (targetId) {
          const chatUrl = resolveToRootUrl(`pages/shared/chat.html?targetId=${targetId}`);
          if (window.navigateWithTransition) window.navigateWithTransition(chatUrl);
          else window.location.href = chatUrl;
        } else if (window.appNotify) {
          window.appNotify(t("chat_not_available", "ไม่พบข้อมูลสำหรับการแชท"), "warning");
        }
      };
    }

    if (btnOpenMap) {
      const mUrl = bookingData.mapLink || "";
      btnOpenMap.style.display = mUrl ? "flex" : "none";
      btnOpenMap.onclick = () => {
        const finalUrl = mUrl.startsWith("http") ? mUrl : `https://www.google.com/maps?q=${encodeURIComponent(mUrl)}`;
        window.open(finalUrl, "_blank");
      };
    }

    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);
    renderVehicles(bookingData);
  }

  function handleToggleDetail() {
    if (!detailPanel || !toggleDetailBtn) return;
    const isHidden = detailPanel.hidden;
    detailPanel.hidden = !isHidden;
    toggleDetailBtn.textContent = isHidden
      ? t("hide_booking_details", "ซ่อนรายละเอียดการจอง")
      : t("show_booking_details", "แสดงรายละเอียดการจอง");
  }

  async function handleCancelBooking() {
    const confirmed = await new Promise((resolve) => {
      const message = t("confirm_cancel_booking", "คุณต้องการยกเลิกการจองหรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้");
      if (window.showConfirm) window.showConfirm(message, resolve);
      else resolve(window.confirm(message));
    });
    if (!confirmed) return;

    const bkId = (bookingIdText?.textContent || "").trim();
    const result = await BookingAPI.cancelBooking(bkId);
    if (result?.success) {
      if (window.appNotify) window.appNotify(t("cancel_success", "ยกเลิกการจองสำเร็จ"), "success");
      const nextHref = resolveToRootUrl("pages/buyer/setbooking/booking.html?filter=cancel");
      if (window.navigateWithTransition) window.navigateWithTransition(nextHref);
      else window.location.href = nextHref;
      return;
    }

    if (window.appNotify) window.appNotify(result?.message || t("cancel_error", "ยกเลิกการจองไม่สำเร็จ"), "error");
  }

  btnBack?.addEventListener("click", () => {
    const href = resolveToRootUrl("pages/buyer/setbooking/booking.html");
    if (window.navigateWithTransition) window.navigateWithTransition(href);
    else window.location.href = href;
  });
  toggleDetailBtn?.addEventListener("click", handleToggleDetail);
  btnCancelBooking?.addEventListener("click", handleCancelBooking);

  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get("bookingId") || urlParams.get("bid") || urlParams.get("id");
    const confirmedBooking = readStoredBooking();

    if (!bookingId && !confirmedBooking) {
      const href = resolveToRootUrl("pages/buyer/setbooking/booking.html");
      if (window.navigateWithTransition) window.navigateWithTransition(href);
      else window.location.href = href;
      return;
    }

    try {
      await loadSuccessData();
      if (DEBUG_BOOKING) console.log("Booking detail initialized");
    } catch (err) {
      console.error("Error loading booking data:", err);
      if (window.appNotify) {
        window.appNotify(err.message || t("load_data_error", "เกิดข้อผิดพลาดในการโหลดข้อมูล"), "error");
      }
    }
  }

  init();
});
