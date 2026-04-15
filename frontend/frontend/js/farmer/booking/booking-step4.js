/**
 * AGRIPRICE - Booking Step 4 JavaScript
 * เธเธตเน€เธเธญเธฃเน: เธเธฒเธฃเธเธญเธเธชเธณเน€เธฃเนเธ, QR Code, เธชเธ–เธฒเธเธฐเธเธดเธง, เนเธเธเธ—เธตเน, เธขเธเน€เธฅเธดเธเธเธฒเธฃเธเธญเธ
 * เนเธเธงเธ—เธฒเธ QR เธ—เธตเนเธ–เธนเธเธ•เนเธญเธ: เน€เธเนเธ URL/bookingId เธชเธฑเนเธ เน เนเธฅเนเธง lookup เธเธฒเธ DB เนเธเธญเธเธฒเธเธ•
 */

document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
  // ================================
  // Elements
  // ================================
  const btnBack = document.getElementById("btnBack");
  const btnOpenMap = document.getElementById("openMapBtn");
  const btnCancelBooking = document.getElementById("btnCancelBooking");
  const toggleDetailBtn = document.getElementById("toggleDetailBtn");

  const queueNo = document.getElementById("queueNo");
  const timeText = document.getElementById("timeText");
  const bookingIdText = document.getElementById("bookingIdText");
  const currentQueue = document.getElementById("currentQueue");
  const myQueue = document.getElementById("myQueue");
  const aheadCount = document.getElementById("aheadCount");
  const eta = document.getElementById("eta");
  const shopName = document.getElementById("shopName");
  const shopAddr = document.getElementById("shopAddr");
  const detailPanel = document.getElementById("detailPanel");
  const qrCanvas = document.getElementById("qrCanvas");

  // ================================
  // Path helpers (เธชเธณเธเธฑเธ: เนเธซเนเธ—เธณเธเธฒเธเนเธ”เนเธ—เธธเธเธฃเธฐเธ”เธฑเธ)
  // ================================
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

  // ================================
  // API LAYER โ€” เน€เธเธทเนเธญเธก server เธเธฃเธดเธ
  // ================================
  const _API    = (window.API_BASE_URL || '').replace(/\/$/, '');
  const _TKEY   = window.AUTH_TOKEN_KEY || 'token';
  const _aH     = () => { const t=localStorage.getItem(_TKEY)||''; return t?{'Authorization':'Bearer '+t}:{}; };
  const qlog = () => {};
  const statusLog = (...args) => console.log('[BOOKING-STATUS-CHECK]', ...args);
  let statusPollTimer = null;

  const BookingAPI = {
    getResolvedAddress(raw) {
      const formPayload = raw?.form_payload && typeof raw.form_payload === 'object'
        ? raw.form_payload
        : {};
      const formAddress = [
        formPayload.address,
        formPayload.contact?.address,
        formPayload.contact?.address_line1,
      ].find(v => typeof v === 'string' && v.trim());

      return [
        raw?.address,
        formAddress,
      ].find(v => typeof v === 'string' && v.trim()) || '';
    },

    async loadConfirmedBooking() {
      // เธญเนเธฒเธ bookingId เธเธฒเธ URL เธซเธฃเธทเธญ localStorage
      const urlP = new URLSearchParams(window.location.search);
      const bid  = urlP.get("bookingId") || urlP.get("bid") || null;
      const local = localStorage.getItem("confirmedBooking");
      const localObj = (() => {
        try { return local ? JSON.parse(local) : null; }
        catch (_) { return null; }
      })();

      // Prefer booking id that already exists in local confirmed data.
      // URL bid may be a temporary/generated id from old flow.
      const preferredBid = localObj?.booking_id || localObj?.bookingId || localObj?.booking_no || bid || null;
      qlog('loadConfirmedBooking.idSelection', {
        bidFromUrl: bid,
        localBookingPk: localObj?.booking_id || null,
        localBookingId: localObj?.bookingId || null,
        localBookingNo: localObj?.booking_no || null,
        preferredBid,
        hasApiBase: !!_API,
      });

      const mapBookingRecord = (d, fallbackId) => {
        let vehicles = [];
        let productAmount = 0;
        try {
          const noteData = JSON.parse(d.note || '{}');
          vehicles = Array.isArray(noteData.vehicles) ? noteData.vehicles : [];
          productAmount = noteData.productAmount || 0;
        } catch(_) {}

        const resolvedAddress = BookingAPI.getResolvedAddress(d);
        return {
          bookingId:    String(d.booking_no || d.booking_id || fallbackId || ''),
          booking_id:   d.booking_id || null,
          booking_no:   d.booking_no || null,
          status:       d.status || 'waiting',
          shopName:     d.farmer ? `${d.farmer.first_name} ${d.farmer.last_name}`.trim() : '',
          fullName:     d.buyer  ? `${d.buyer.first_name} ${d.buyer.last_name}`.trim()   : '',
          phone:        d.farmer?.phone || '',
          address:      resolvedAddress,
          queueNo:      d.queue_no || '',
          queue_no:     d.queue_no || '',
          slot_id:      d.slot_id || null,
          time:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}) : '',
          date:         d.scheduled_time ? new Date(d.scheduled_time).toLocaleDateString('th-TH') : '',
          productName:  d.product?.name || '',
          vehicleCount: d.vehicle_count || vehicles.length || 1,
          productAmount,
          vehicles,
        };
      };

      // เธ–เนเธฒเธกเธต API เนเธฅเธฐ bid โ’ เธ”เธถเธเธเธฒเธ server
      if (_API && preferredBid) {
        try {
          const res = await fetch(`${_API}/api/bookings/${preferredBid}`, { headers: _aH() });
          qlog('loadConfirmedBooking.fetchBooking', { url: `${_API}/api/bookings/${preferredBid}`, status: res.status });
          if (res.ok) {
            const d = await res.json();
            qlog('loadConfirmedBooking.bookingPayload', {
              booking_id: d?.booking_id,
              booking_no: d?.booking_no,
              queue_no: d?.queue_no,
              slot_id: d?.slot_id,
              status: d?.status,
            });
            return mapBookingRecord(d, preferredBid);
          }

          // Recovery path: local bookingId may be stale/local-only. Try to resolve by queue_no + slot_id from own booking list.
          if (res.status === 404 && localObj && (localObj.queue_no || localObj.queueNo)) {
            const listRes = await fetch(`${_API}/api/bookings`, { headers: _aH() });
            qlog('loadConfirmedBooking.recoverFromList.response', { status: listRes.status });
            if (listRes.ok) {
              const listJson = await listRes.json();
              const rows = Array.isArray(listJson?.data) ? listJson.data : [];
              const targetQueue = String(localObj.queue_no || localObj.queueNo || '').trim();
              const targetSlot = String(localObj.slot_id || localObj.slotId || '').trim();

              const matched = rows.find((r) => {
                const rq = String(r.queue_no || '').trim();
                const rs = String(r.slot_id || '').trim();
                if (!rq) return false;
                if (targetSlot) return rq === targetQueue && rs === targetSlot;
                return rq === targetQueue;
              }) || null;

              qlog('loadConfirmedBooking.recoverFromList.match', {
                targetQueue,
                targetSlot,
                matchedBookingNo: matched?.booking_no || null,
                matchedBookingId: matched?.booking_id || null,
              });

              if (matched) {
                const recovered = mapBookingRecord(matched, matched.booking_no || matched.booking_id);
                localStorage.setItem('confirmedBooking', JSON.stringify({
                  ...(localObj || {}),
                  ...recovered,
                  bookingId: recovered.bookingId,
                  booking_id: matched.booking_id || recovered.booking_id || null,
                  booking_no: matched.booking_no || recovered.booking_no || null,
                  queue_no: recovered.queueNo,
                  slot_id: matched.slot_id || recovered.slot_id || null,
                }));
                return recovered;
              }
            }
          }
        } catch(e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] loadConfirmedBooking:', e.message); }
      }

      // fallback: localStorage (เธเนเธญเธกเธนเธฅเธเธฒเธ step3)
      if (local) return JSON.parse(local);

      return null;
    },

    async saveConfirmedBooking(data) {
      localStorage.setItem("confirmedBooking", JSON.stringify(data));
      return true;
    },

    async loadQueueStatus(bookingId) {
      // เธ”เธถเธเธชเธ–เธฒเธเธฐเธเธดเธงเธเธฒเธ API เธ–เนเธฒเธกเธต bookingId
      if (_API && bookingId) {
        try {
          const res = await fetch(`${_API}/api/bookings/${bookingId}/queue-status`, { headers: _aH() });
          qlog('loadQueueStatus.queueStatusResponse', { bookingId, status: res.status, url: `${_API}/api/bookings/${bookingId}/queue-status` });
          if (res.ok) {
            const json = await res.json();
            const d = json?.data || {};
            qlog('loadQueueStatus.queueStatusData', d);
            return {
              currentQueue: d.currentQueue || '-',
              waitingQueues: Number(d.waitingAhead || 0),
              estimatedMinutes: Number(d.estimatedMinutes || 0),
              averageTimePerQueue: Number(d.averageTimePerQueue || 30),
            };
          }

          // fallback: server รุ่นเก่าอาจยังไม่มี endpoint นี้
          const detailRes = await fetch(`${_API}/api/bookings/${bookingId}`, { headers: _aH() });
          qlog('loadQueueStatus.fallback.bookingDetailResponse', { status: detailRes.status, url: `${_API}/api/bookings/${bookingId}` });
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            const currentBooking = detailJson?.data || detailJson || {};
            const slotId = currentBooking.slot_id || currentBooking.slot?.slot_id || currentBooking.slot?.id || null;
            qlog('loadQueueStatus.fallback.currentBooking', {
              booking_id: currentBooking?.booking_id,
              booking_no: currentBooking?.booking_no,
              queue_no: currentBooking?.queue_no,
              slotId,
              status: currentBooking?.status,
            });

            const waitingRes = await fetch(`${_API}/api/bookings?status=waiting`, { headers: _aH() });
            qlog('loadQueueStatus.fallback.waitingResponse', { status: waitingRes.status, url: `${_API}/api/bookings?status=waiting` });
            if (waitingRes.ok) {
              const waitingJson = await waitingRes.json();
              const all = Array.isArray(waitingJson.data) ? waitingJson.data : [];
              const sameSlot = slotId
                ? all.filter((b) => String(b.slot_id || b.slot?.slot_id || b.slot?.id || '') === String(slotId))
                : all;
              qlog('loadQueueStatus.fallback.waitingCounts', {
                allCount: all.length,
                sameSlotCount: sameSlot.length,
                slotId,
              });

              sameSlot.sort((a, b) => {
                const at = new Date(a.created_at || 0).getTime();
                const bt = new Date(b.created_at || 0).getTime();
                if (at !== bt) return at - bt;
                return Number(a.booking_id || 0) - Number(b.booking_id || 0);
              });

              const myIndex = sameSlot.findIndex(
                (b) => String(b.booking_id) === String(currentBooking.booking_id) || String(b.booking_no) === String(currentBooking.booking_no)
              );
              const currentQueue = sameSlot[0]?.queue_no || currentBooking.queue_no || '-';
              const parseSeq = (q) => {
                const m = String(q || '').match(/-(\d+)$/);
                if (!m) return null;
                const n = Number(m[1]);
                return Number.isFinite(n) ? n : null;
              };
              const mySeq = parseSeq(currentBooking.queue_no);
              const currentSeq = parseSeq(currentQueue);
              const waitingAhead = (Number.isFinite(mySeq) && Number.isFinite(currentSeq))
                ? Math.max(0, mySeq - currentSeq)
                : (myIndex > 0 ? myIndex : 0);
              qlog('loadQueueStatus.fallback.calculated', {
                myIndex,
                mySeq,
                currentSeq,
                currentQueue,
                waitingAhead,
              });

              return {
                currentQueue,
                waitingQueues: waitingAhead,
                estimatedMinutes: waitingAhead * 30,
                averageTimePerQueue: 30,
              };
            }
          }
        } catch(e) { if (DEBUG_BOOKING) console.warn('[step4] loadQueueStatus:', e.message); }
      }
      return { currentQueue: '-', waitingQueues: 0, estimatedMinutes: 0, averageTimePerQueue: 30 };
    },

    async loadLocationData(bookingData) {
      // เนเธเนเธเนเธญเธกเธนเธฅเธเธฒเธ bookingData เธ—เธตเนเธ”เธถเธเธกเธฒเธเธฒเธ API เนเธฅเนเธง
      if (bookingData) {
        return {
          name: bookingData.shopName || '',
          address: bookingData.address || '',
          lat: null,
          lng: null,
          googleMapsUrl: bookingData.address
            ? `https://maps.google.com/?q=${encodeURIComponent(bookingData.address)}`
            : '',
        };
      }
      return { name: '', address: '', lat: null, lng: null, googleMapsUrl: '' };
    },

    async cancelBooking(bookingId) {
      if (_API && bookingId) {
        try {
          const res = await fetch(`${_API}/api/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { ..._aH(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancel' }),
          });
          if (res.ok) {
            localStorage.removeItem("confirmedBooking");
            localStorage.removeItem("bookingSlotId");
            localStorage.removeItem("bookingStep1");
            localStorage.removeItem("bookingStep2");
            return { success: true, message: "ยกเลิกการจองสำเร็จ" };
          }
          return { success: false, message: "ยกเลิกการจองไม่สำเร็จ" };
        } catch(e) { if (DEBUG_BOOKING) console.warn('[BookingAPI] cancelBooking:', e.message); }
      }
      return { success: false, message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้" };
    },
  };


  // ================================
  // Utilities
  // ================================
  function generateBookingId(slotId) {
    const timePart = Date.now().toString(36).toUpperCase().slice(-2);
    const randPart = Math.random().toString(36).toUpperCase().slice(2, 5);
    return `${timePart}${randPart}`;
  }

  function formatEstimatedTime(minutes) {
    if (minutes < 60) return `${minutes} นาที`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ชั่วโมง`;
    return `${hours} ชั่วโมง ${mins} นาที`;
  }

  function renderDetailPanel(bookingData) {
    const vehicles = Array.isArray(bookingData.vehicles) ? bookingData.vehicles : [];
    const vehicleHtml = vehicles.length
      ? vehicles.map(v => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0">
            <span class="material-icons-outlined" style="font-size:18px;color:#666">local_shipping</span>
            <div>
              <div style="font-size:13px;font-weight:600">${v.typeName || v.type || 'รถ'}</div>
              <div style="font-size:12px;color:#888">${v.plate || '-'}</div>
            </div>
          </div>`).join('')
      : '<div style="color:#999;font-size:13px">ไม่มีข้อมูลรถ</div>';

    return `
      <div style="display:flex;flex-direction:column;gap:6px;font-size:14px">
        <div><b>ร้าน:</b> ${shopName.textContent || '-'}</div>
        <div><b>ที่อยู่:</b> ${shopAddr.textContent || '-'}</div>
        <div><b>หมายเลขคิว:</b> ${bookingData.queueNo || bookingData.slotId || '-'}</div>
        <div><b>เวลานัดคิว:</b> ${timeText ? timeText.textContent + ' น.' : '-'}</div>
        <div><b>วันที่:</b> ${bookingData.date || bookingData.dateFormatted || '-'}</div>
        <div><b>Booking ID:</b> ${bookingData.bookingId || '-'}</div>
        ${bookingData.productAmount ? `<div><b>น้ำหนักสินค้า:</b> ${bookingData.productAmount} กก.</div>` : ''}
        <div style="margin-top:8px"><b>ยานพาหนะ (${vehicles.length} คัน):</b></div>
        ${vehicleHtml}
      </div>
    `;
  }

  // ================================
  // QR Code (เนเธเน overflow + เธชเนเธเธเนเธฅเนเธงเนเธเนเนเธ”เนเธเธฃเธดเธ)
  // ================================
  function buildQrPayload(bookingId) {
    // โ… เนเธเธฐเธเธณเนเธซเน QR เน€เธเนเธ โ€URL เธชเธฑเนเธโ€ เนเธฅเนเธงเธเธฑเนเธเธเธฅเธฒเธขเธ—เธฒเธเนเธเน bookingId เนเธ lookup DB
    // เธชเนเธเธเนเธฅเนเธงเน€เธเธดเธ”เธซเธเนเธฒ step4 เธเธฃเนเธญเธก bid (เธ•เธญเธเธเธตเนเนเธเน localStorage fallback เนเธ”เน)
    const base =
      (window.location.origin || "") + resolveToRootUrl("pages/farmer/booking/booking-step4.html");
    return `${base}?bid=${encodeURIComponent(bookingId)}`;
  }

  function drawFallbackQR() {
    if (!qrCanvas) return;
    qrCanvas.innerHTML = '<div style="width:110px;height:110px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#666;font-size:12px;border-radius:4px;">QR</div>';
  }

  function generateQRCode(text) {
    if (!qrCanvas) return;
    try {
      // เธฅเนเธฒเธ div เธเนเธญเธ (เธเธฑเธเธเนเธญเธ)
      qrCanvas.innerHTML = "";
      // qrcodejs เธ•เนเธญเธเธเธฒเธฃ div เนเธกเนเนเธเน canvas
      new QRCode(qrCanvas, {
        text: String(text || ""),
        width: 110,
        height: 110,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
      if (DEBUG_BOOKING) console.log("โ… เธชเธฃเนเธฒเธ QR Code:", text);
    } catch (error) {
      console.error("Error generating QR code:", error);
      drawFallbackQR();
    }
  }

  // ================================
  // Load Success Data
  // ================================
  async function loadSuccessData() {
    const bookingData = await BookingAPI.loadConfirmedBooking();
    if (!bookingData) throw new Error("ไม่พบข้อมูลการจอง");

    // --- queue number: เนเธเนเธเธฒเธ API (queue_no) เธเนเธญเธ เนเธฅเนเธงเธเนเธญเธข fallback ---
    const queueLabel = bookingData.queueNo
      || bookingData.queue_no
      || bookingData.timeSlot?.slot_name
      || bookingData.timeSlot?.time
      || "-";
    if (queueNo)  queueNo.textContent  = queueLabel;
    if (myQueue)  myQueue.textContent  = queueLabel;

    // --- เน€เธงเธฅเธฒเธเธฑเธ” ---
    if (bookingData.time) {
      if (timeText) timeText.textContent = bookingData.time;
    } else if (bookingData.timeSlot?.time) {
      const startTime = bookingData.timeSlot.time.split("-")[0];
      if (timeText) timeText.textContent = startTime;
    }

    // --- bookingId ---
    const bidFromUrl = new URLSearchParams(window.location.search).get("bid");
    let bkId = bookingData.bookingId || String(bookingData.booking_id || "") || bidFromUrl || "";
    if (!bkId) bkId = `LOCAL-${String(queueLabel || '-').replace(/\s+/g, '')}`;

    bookingData.bookingId = bkId;
    await BookingAPI.saveConfirmedBooking(bookingData);

    if (bookingIdText) bookingIdText.textContent = bkId;

    // --- QR ---
    generateQRCode(buildQrPayload(bkId));

    // --- queue status ---
    const isLocalOnlyId = String(bkId).startsWith("LOCAL-");
    const lookupId = bookingData.booking_id || bookingData.booking_no || bkId;
    const queueStatus = isLocalOnlyId
      ? { currentQueue: queueLabel || '-', waitingQueues: 0, estimatedMinutes: 0, averageTimePerQueue: 30 }
      : await BookingAPI.loadQueueStatus(lookupId);
    qlog('loadSuccessData.renderInput', {
      queueLabel,
      bkId,
      lookupId,
      isLocalOnlyId,
      queueStatus,
      bookingQueueNo: bookingData.queueNo || bookingData.queue_no || null,
      bookingPk: bookingData.booking_id || null,
    });
    if (currentQueue) currentQueue.textContent = queueStatus.currentQueue || queueLabel;
    if (aheadCount)   aheadCount.textContent   = `${queueStatus.waitingQueues ?? 0} คิว`;
    if (eta)          eta.textContent           = formatEstimatedTime(queueStatus.estimatedMinutes ?? 0);

    // --- shop info (เธเธทเนเธญเธฅเนเธ + เธ—เธตเนเธญเธขเธนเน) ---
    const shopLabel = bookingData.shopName
      || bookingData.farmerName
      || localStorage.getItem("bookingFarmerName")
      || "-";
    const addrLabel = bookingData.address
      || bookingData.contact?.address
      || "";
    if (shopName)  shopName.textContent  = shopLabel;
    if (shopAddr)  shopAddr.textContent  = addrLabel || "ไม่ระบุที่อยู่";
    if (btnOpenMap) {
      const mapsUrl = addrLabel
        ? `https://maps.google.com/?q=${encodeURIComponent(addrLabel)}`
        : "";
      btnOpenMap.dataset.mapsUrl = mapsUrl;
    }

    // --- detail panel ---
    if (detailPanel) detailPanel.innerHTML = renderDetailPanel(bookingData);

    // Start status polling to verify auto-success (scheduled_time + 5 minutes)
    if (!isLocalOnlyId && lookupId) {
      startBookingStatusPolling(lookupId);
    }
  }

  async function checkBookingStatusOnce(bookingId) {
    if (!_API || !bookingId) return null;
    try {
      const res = await fetch(`${_API}/api/bookings/${bookingId}`, { headers: _aH() });
      if (!res.ok) {
        statusLog('fetch booking failed', { bookingId, status: res.status });
        return null;
      }

      const d = await res.json();
      const scheduledRaw = d?.scheduled_time || d?.data?.scheduled_time || null;
      const status = d?.status || d?.data?.status || null;
      const queueNoValue = d?.queue_no || d?.data?.queue_no || null;

      const nowTs = Date.now();
      const scheduledTs = scheduledRaw ? new Date(scheduledRaw).getTime() : null;
      const dueTs = Number.isFinite(scheduledTs) ? (scheduledTs + 5 * 60 * 1000) : null;

      statusLog('status snapshot', {
        bookingId,
        status,
        queue_no: queueNoValue,
        scheduled_time: scheduledRaw,
        now_iso: new Date(nowTs).toISOString(),
        due_iso: dueTs ? new Date(dueTs).toISOString() : null,
        should_auto_success_now: Number.isFinite(dueTs) ? nowTs >= dueTs : null,
      });

      return { status, queueNo: queueNoValue, scheduledRaw, nowTs, dueTs };
    } catch (e) {
      statusLog('status check error', { bookingId, message: e?.message || e });
      return null;
    }
  }

  function startBookingStatusPolling(bookingId) {
    if (statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }

    checkBookingStatusOnce(bookingId).then((snap) => {
      if (!snap) return;
      if (snap.status === 'success') {
        if (aheadCount) aheadCount.textContent = '0 คิว';
        if (eta) eta.textContent = '0 นาที';
      }
    });

    statusPollTimer = setInterval(async () => {
      const snap = await checkBookingStatusOnce(bookingId);
      if (!snap) return;
      if (snap.status === 'success') {
        if (aheadCount) aheadCount.textContent = '0 คิว';
        if (eta) eta.textContent = '0 นาที';
      }
    }, 15000);
  }

  // ================================
  // Event Handlers
  // ================================
  function handleToggleDetail() {
    if (!detailPanel || !toggleDetailBtn) return;
    const isHidden = detailPanel.hidden;
    detailPanel.hidden = !isHidden;
    toggleDetailBtn.textContent = isHidden ? "ซ่อนรายละเอียดการจอง" : "แสดงรายละเอียดการจอง";
  }

  function handleOpenMap() {
    const mapsUrl = btnOpenMap?.dataset?.mapsUrl;
    if (mapsUrl) window.open(mapsUrl, "_blank");
    else window.appNotify("ไม่สามารถเปิดแผนที่ได้", "error");
  }

  async function handleCancelBooking() {
    const confirmed = await new Promise((resolve) => {
      const message = "คุณต้องการยกเลิกการจองหรือไม่?\n\nการยกเลิกจะไม่สามารถย้อนกลับได้";
      if (window.showConfirm) window.showConfirm(message, resolve);
      else resolve(window.confirm(message));
    });
    if (!confirmed) return;

    try {
      const bkId = bookingIdText?.textContent || "";

      const result = await BookingAPI.cancelBooking(bkId);

      if (result.success) {
        window.appNotify("ยกเลิกการจองสำเร็จ", "success");

        // หลังยกเลิกให้กลับไปหน้ารายการจองพร้อม filter=cancel เสมอ
        const ref = localStorage.getItem("bookingReferrer");
        if (ref && ref.includes("booking.html")) {
          const next = ref.split("?")[0] + "?filter=cancel";
          if (window.navigateWithTransition) window.navigateWithTransition(next); else window.location.href = next;
        } else {
          const next = resolveToRootUrl("pages/farmer/booking/booking.html?filter=cancel");
          if (window.navigateWithTransition) window.navigateWithTransition(next); else window.location.href = next;
        }
      } else {
        window.appNotify(result.message || "เกิดข้อผิดพลาดในการยกเลิกการจอง", "error");
      }
    } catch (error) {
      console.error("Error canceling booking:", error);
      window.appNotify("เกิดข้อผิดพลาดในการยกเลิกการจอง กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  // ================================
  // Event Listeners
  // ================================
  btnBack?.addEventListener("click", () => {
    // โ… เธเธฅเธฑเธเธซเธเนเธฒเธ—เธตเนเธกเธฒเธเนเธญเธเธเธฃเธดเธ (เธเธฒเธเธเธธเนเธกเธเธญเธ/เธเธฒเธเธซเธเนเธฒเธญเธทเนเธ)
    const ref = localStorage.getItem("bookingReferrer");
    if (ref) {
      if (window.navigateWithTransition) window.navigateWithTransition(ref); else window.location.href = ref;
    } else {
      const nextHref = resolveToRootUrl("pages/farmer/booking/booking.html");
      if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
    }
  });

  toggleDetailBtn?.addEventListener("click", handleToggleDetail);
  btnOpenMap?.addEventListener("click", handleOpenMap);
  btnCancelBooking?.addEventListener("click", handleCancelBooking);

  // ================================
  // Initialize
  // ================================
  async function init() {
    let confirmedBooking = localStorage.getItem("confirmedBooking");

    // เธ–เนเธฒเธขเธฑเธเนเธกเนเธกเธต เนเธ•เนเธกเธต bookingId เนเธ query เนเธซเนเธชเธฃเนเธฒเธ object เธเธฑเนเธเธเธทเนเธเธเธฒเธ
    if (!confirmedBooking) {
      const bid = new URLSearchParams(window.location.search).get("bookingId") ||
                  new URLSearchParams(window.location.search).get("bid");
      if (bid) {
        if (DEBUG_BOOKING) console.log("[Step4] no confirmedBooking, but bookingId present", bid);
        // เธชเธฃเนเธฒเธ object เธเธฑเนเธเธเธทเนเธเธเธฒเธ
        const obj = { bookingId: bid, slotId: "--", timeSlot: { time: "--" } };
        confirmedBooking = JSON.stringify(obj);
        localStorage.setItem("confirmedBooking", confirmedBooking);
      }
    }

    if (!confirmedBooking) {
      window.appNotify("ไม่พบข้อมูลการจอง กรุณาทำการจองใหม่", "error");
      if (window.navigateWithTransition) window.navigateWithTransition(resolveToRootUrl("pages/farmer/booking/booking-step1.html")); else window.location.href = resolveToRootUrl("pages/farmer/booking/booking-step1.html");
      return;
    }

    try {
      await loadSuccessData();
      if (DEBUG_BOOKING) console.log("๐€ Booking Step 4 initialized");
    } catch (err) {
      console.error("Error loading success data:", err);
      window.appNotify("เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  init();

  window.addEventListener('beforeunload', () => {
    if (statusPollTimer) {
      clearInterval(statusPollTimer);
      statusPollTimer = null;
    }
  });
});
