/**
 * setbooking-step2.js
 * - UI ตามรูป: ช่วงวันที่ + ตารางรอบคิว + toggle + ลบ + modal เพิ่มรอบ
 * - รองรับ DB: รวม payload จาก step1 แล้วเตรียมส่ง API
 * - ใช้ /api/buyer/products สำหรับ flow ของ Buyer
 */

(function () {
  // ===== CONFIG (ต่อ API ในอนาคต) =====
  const CONFIG = {
    USE_API: !!(window.API_BASE_URL),
    getApiBase: () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, ""),
    ENDPOINTS: {
      save: "/api/buyer/products", // POST [FIXED Bug1: Buyer-specific endpoint, not Farmer/Admin /api/products]
    },
  };

  // ===== Elements =====
  const dateStart = document.getElementById("dateStart");
  const dateEnd = document.getElementById("dateEnd");
  const roundList = document.getElementById("roundList");
  const addRoundBtn = document.getElementById("addRoundBtn");
  const saveAllBtn = document.getElementById("saveAllBtn");
  const debugBox = document.getElementById("debugBox");

  const modal = document.getElementById("roundModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const saveRoundBtn = document.getElementById("saveRoundBtn");

  const roundName = document.getElementById("roundName");
  const timeStart = document.getElementById("timeStart");
  const timeEnd = document.getElementById("timeEnd");
  const capacity = document.getElementById("capacity");

  // ===== State =====
  const state = {
    // date range
    startDate: "",
    endDate: "",
    // rounds
    rounds: [], // ไม่มี default ให้ผู้ใช้เพิ่มเองผ่านปุ่ม + เพิ่มรอบ
    // step1 payload
    step1: null,
  };

  // ===== Helpers =====
  function cryptoId() {
    try {
      return crypto.randomUUID();
    } catch {
      return "id_" + Math.random().toString(16).slice(2);
    }
  }

  function openModal() {
    modal.classList.add("show");
    modal.removeAttribute("inert");

    // reset fields
    roundName.value = "";
    timeStart.value = "";
    timeEnd.value = "";
    capacity.value = "";

    setTimeout(() => roundName.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("inert", "");
  }

  function parseTimeToMinutes(t) {
    if (!t || typeof t !== "string") return NaN;
    // accept H:MM or HH:MM
    const parts = t.split(":");
    if (parts.length !== 2) return NaN;
    let hh = Number(parts[0]);
    let mm = Number(parts[1]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return NaN;
    return hh * 60 + mm;
  }

  // Back button: try step1 if we have saved payload, else history.back()
  function goBackToStep1() {
    try {
      const raw = sessionStorage.getItem("setbooking_step1");
      // If we arrived here from step1, prefer history.back() to avoid creating a duplicate entry
      const ref = document.referrer || "";
      if (ref.includes("setbooking-step1.html")) {
        history.back();
        return;
      }

      // Otherwise, if we have saved step1 payload, navigate there
      if (raw) {
        if (window.navigateWithTransition) window.navigateWithTransition("./setbooking-step1.html"); else window.location.href = "./setbooking-step1.html";
        return;
      }
    } catch (err) {
      // ignore and fallback to history
    }
    history.back();
  }

  function renderRounds() {
    if (!roundList) return;
    roundList.innerHTML = "";

    if (state.rounds.length === 0) {
      const noRoundsText = window.i18nT ? window.i18nT('no_rounds_hint', 'ยังไม่มีรอบคิว กรุณากดปุ่ม "เพิ่มรอบ"') : 'ยังไม่มีรอบคิว กรุณากดปุ่ม "เพิ่มรอบ"';
      roundList.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted); font-size: 14px;">${noRoundsText}</div>`;
      return;
    }

    state.rounds.forEach((r) => {
      const card = document.createElement("div");
      card.className = "round-card";

      card.innerHTML = `
        <div class="round-card-header">
          <div class="round-card-title">${escapeHtml(r.name)}</div>
          <div class="round-card-status">
            ${r.enabled ? (window.i18nT ? window.i18nT('open_for_booking', 'เปิดรับ') : 'เปิดรับ') : (window.i18nT ? window.i18nT('temporarily_closed', 'ปิดชั่วคราว') : 'ปิดชั่วคราว')}
            <button class="toggle ${r.enabled ? "on" : ""}" type="button" aria-label="${window.i18nT ? window.i18nT('change_status', 'เปลี่ยนสถานะ') : 'เปลี่ยนสถานะ'}"></button>
          </div>
        </div>
        <div class="round-card-details">
          <div><span class="material-icons-outlined">schedule</span> ${window.i18nT ? window.i18nT('time_label', 'เวลา') : 'เวลา'}: <span>${escapeHtml(r.start)} - ${escapeHtml(r.end)}</span></div>
          <div><span class="material-icons-outlined">people</span> ${window.i18nT ? window.i18nT('capacity_label', 'จำนวนคิว') : 'จำนวนคิว'}: <span>${Number(r.capacity)}</span></div>
        </div>
        <div class="round-card-actions">
          <button class="icon-btn" type="button" aria-label="${window.i18nT ? window.i18nT('delete_round', 'ลบรอบ') : 'ลบรอบ'}">
            <span class="material-icons-outlined">delete</span>
          </button>
        </div>
      `;

      // toggle
      const toggleBtn = card.querySelector(".toggle");
      toggleBtn.addEventListener("click", () => {
        r.enabled = !r.enabled;
        renderRounds();
      });

      // delete
      const delBtn = card.querySelector(".icon-btn");
      delBtn.addEventListener("click", () => {
        state.rounds = state.rounds.filter(x => x.id !== r.id);
        renderRounds();
      });

      roundList.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function apiCall(method, path, body) {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const base = CONFIG.getApiBase() || "";
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    const authHeader = token ? { "Authorization": "Bearer " + token } : {};

    const isGet = (method || "").toUpperCase() === "GET";

    // /api/products ใช้ multer (multipart/form-data) ต้องส่ง FormData
    if (path.startsWith("/api/buyer/products") && !isGet) {
      const fd = new FormData();
      Object.entries(body || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, String(v));
      });
      const res = await fetch(base + path, {
        method: method,
        headers: authHeader,
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || (method === "POST" ? (window.i18nT ? window.i18nT('save_error', 'สร้างสินค้าไม่สำเร็จ') : 'สร้างสินค้าไม่สำเร็จ') : (window.i18nT ? window.i18nT('save_error', 'แก้ไขสินค้าไม่สำเร็จ') : 'แก้ไขสินค้าไม่สำเร็จ')));
      }
      return await res.json();
    }

    // routes อื่น ๆ ส่ง JSON
    const opts = {
      method: method,
      headers: { ...authHeader }
    };
    if (!isGet && body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(base + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "API error");
    }
    return await res.json();
  }

  // ===== Load step1 from sessionStorage =====
  function loadStep1() {
    try {
      const raw = sessionStorage.getItem("setbooking_step1");
      if (raw) state.step1 = JSON.parse(raw);
    } catch {}
  }

  function renderStep1Summary() {
    const container = document.getElementById("step1Summary");
    if (!container) return;
    if (!state.step1) {
      container.style.display = "none";
      return;
    }

    const p = state.step1.product || {};
    const v = state.step1.variety || null;
    const details = state.step1.details || "";
    const grades = state.step1.grades || [];

    container.innerHTML = `
      <div class="summary-card-inner">
        <div class="summary-title">${window.i18nT ? window.i18nT('summary_title', 'สรุปการรับซื้อที่เลือก') : 'สรุปการรับซื้อที่เลือก'}</div>
        <div class="summary-info">
          <div class="summary-label">${window.i18nT ? window.i18nT('summary_product', 'ผลผลิต') : 'ผลผลิต'}: <strong>${escapeHtml(p.name || "-")}</strong></div>
          <div class="summary-label">${window.i18nT ? window.i18nT('summary_variety', 'สายพันธุ์') : 'สายพันธุ์'}: <strong>${escapeHtml(v?.name || "-")}</strong></div>
        </div>
        <div class="summary-desc">${window.i18nT ? window.i18nT('summary_desc', 'คำอธิบาย') : 'คำอธิบาย'}: ${escapeHtml(details || "-")}</div>
        <div class="summary-pills">
          ${grades.map(g => `<div class="grade-pill">${escapeHtml(String(g.grade))} - ${escapeHtml(String(g.price))} ${window.i18nT ? window.i18nT('baht_per_kg', 'บ./กก.') : 'บ./กก.'}</div>`).join("")}
        </div>
      </div>
    `;
    container.style.display = "block";
  }

  // ===== Events =====
  addRoundBtn.addEventListener("click", openModal);

  closeModalBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) closeModal();
  });

  // save round from modal
  saveRoundBtn.addEventListener("click", () => {
    const defaultRoundName = window.i18nT ? window.i18nT('new_round', 'รอบใหม่') : 'รอบใหม่';
    const name = (roundName.value || "").trim() || defaultRoundName;
    const s = (timeStart.value || "").trim();
    const e = (timeEnd.value || "").trim();
    const cap = Number(capacity.value);

    if (!s || !e) {
      window.appNotify(window.i18nT ? window.i18nT('please_enter_times', 'กรุณากรอกเวลาเริ่มต้นและเวลาสิ้นสุด') : 'กรุณากรอกเวลาเริ่มต้นและเวลาสิ้นสุด', "error");
      return;
    }
    const sm = parseTimeToMinutes(s);
    const em = parseTimeToMinutes(e);
    if (!Number.isFinite(sm) || !Number.isFinite(em) || em <= sm) {
      window.appNotify(window.i18nT ? window.i18nT('end_time_must_be_after_start', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น') : 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น', "error");
      return;
    }
    if (!Number.isFinite(cap) || cap <= 0) {
      window.appNotify(window.i18nT ? window.i18nT('please_enter_capacity', 'กรุณากรอกจำนวนคิวให้มากกว่า 0') : 'กรุณากรอกจำนวนคิวให้มากกว่า 0', "error");
      return;
    }

    // กันซ้อนเวลา: ถ้าทับช่วงกับรอบที่เปิดใช้อยู่
    const overlap = state.rounds.some((r) => {
      if (r.enabled === false) return false;
      const rsm = parseTimeToMinutes(r.start);
      const rem = parseTimeToMinutes(r.end);
      // overlap: start < otherEnd && end > otherStart
      return sm < rem && em > rsm;
    });
    if (overlap) {
      window.appNotify(window.i18nT ? window.i18nT('overlap_time_error', 'เวลารอบคิวซ้อนกับรอบเดิม กรุณาเลือกช่วงเวลาใหม่') : 'เวลารอบคิวซ้อนกับรอบเดิม กรุณาเลือกช่วงเวลาใหม่', "error");
      return;
    }

    state.rounds.push({
      id: cryptoId(),
      name,
      start: s,
      end: e,
      capacity: cap,
      enabled: true,
    });

    renderRounds();
    closeModal();
  });

  dateStart.addEventListener("change", () => state.startDate = dateStart.value || "");
  dateEnd.addEventListener("change", () => state.endDate = dateEnd.value || "");

  // save all
  saveAllBtn.addEventListener("click", async () => {
    const start = dateStart.value;
    const end = dateEnd.value;

    if (!start || !end) {
      window.appNotify(window.i18nT ? window.i18nT('please_select_dates', 'กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด') : 'กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด', "error");
      return;
    }
    if (new Date(end) < new Date(start)) {
      window.appNotify(window.i18nT ? window.i18nT('end_date_must_be_after_start', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น') : 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น', "error");
      return;
    }
    if (!state.rounds.length) {
      window.appNotify(window.i18nT ? window.i18nT('please_add_at_least_one_round', 'กรุณาเพิ่มรอบคิวอย่างน้อย 1 รอบ') : 'กรุณาเพิ่มรอบคิวอย่างน้อย 1 รอบ', "error");
      return;
    }

    // ต้องมีข้อมูล step1
    if (!state.step1 || !state.step1.product) {
      window.appNotify(window.i18nT ? window.i18nT('no_product_data_error', 'ไม่พบข้อมูลผลผลิต กรุณากลับไปขั้นตอนที่ 1') : 'ไม่พบข้อมูลผลผลิต กรุณากลับไปขั้นตอนที่ 1', "error");
      return;
    }

    try {
      saveAllBtn.disabled = true;
      saveAllBtn.textContent = window.i18nT ? window.i18nT('saving_btn', 'กำลังบันทึก...') : 'กำลังบันทึก...';

      // สร้าง product พร้อม variety + grades ทั้งหมด
      const gradesArr = Array.isArray(state.step1.grades) ? state.step1.grades : [];
      const productData = {
        name:        state.step1.product.name,
        description: state.step1.details || `${window.i18nT ? window.i18nT('buying_label', 'รับซื้อ') : 'รับซื้อ'} ${state.step1.product.name}${state.step1.variety?.name ? ' ' + state.step1.variety.name : ''}`,
        category:    state.step1.product.name,
        variety:     state.step1.variety?.name || state.step1.variety?.variety || null,
        unit:        window.i18nT ? window.i18nT('kg_unit', 'กก.') : 'กก.',
        quantity:    999999,
        // ส่งราคาและเกรดตัวแรกไปเป็นค่าหลัก
        price:       gradesArr[0]?.price || 0,
        grade:       gradesArr[0]?.grade || (window.i18nT ? window.i18nT('mixed_grade', 'คละ') : 'คละ'),
        // [NORMALIZED] Since we removed product_grades table, we only store the primary price/grade in products
        grades:      JSON.stringify(gradesArr),
      };

      // ตรวจสอบว่าเป็นอาการแก้ไข (Update) หรือสร้างใหม่ (Create)
      const offerIdFromStep1 =
        state.step1.product?.offer_id ||
        state.step1.product?.offerId ||
        state.step1.editSource?.offer_id ||
        state.step1.editSource?.offerId ||
        state.step1.product?.id ||
        state.step1.editSource?.product_id;
      // [FIXED] ตรวจสอบว่าเป็นหมายเลข ID จริงหรือไม่ (กันกรณีเป็นชื่อสินค้าจาก Fallback)
      const isNumericId = (id) => id && !isNaN(id) && Number.isSafeInteger(Number(id));
      const isEdit = state.step1.editSource?.isEdit && isNumericId(offerIdFromStep1);
      
      let productResult;
      if (isEdit) {
        // [UPDATE] แก้ไขสินค้าเดิม [FIXED Bug1: ใช้ /api/buyer/products]
        productResult = await apiCall('PATCH', `/api/buyer/products/${offerIdFromStep1}`, productData);
      } else {
        // [CREATE] สร้างสินค้าใหม่ [FIXED Bug1: ใช้ /api/buyer/products]
        productResult = await apiCall('POST', '/api/buyer/products', productData);
      }
      
      const offerId =
        productResult.data?.offer_id ||
        productResult.offer_id ||
        productResult.data?.product_id ||
        productResult.product_id ||
        productResult.id ||
        offerIdFromStep1;

      if (!offerId) {
        console.error('Failed to get offerId from response:', productResult);
        throw new Error('ไม่สามารถรับหมายเลขสินค้าได้ กรุณาลองใหม่อีกครั้ง');
      }

      // สร้าง slots แบบ batch
      const slotsPayload = {
        offer_id: offerId,
        product_id: offerId,
        start_date: start,
        end_date: end,
        rounds: state.rounds.filter(r => r.enabled).map(r => ({
          name: r.name,
          start: r.start,
          end: r.end,
          capacity: r.capacity,
          enabled: r.enabled,
        })),
      };

      await apiCall('POST', '/api/product-slots/batch', slotsPayload);

      const successMsg = isEdit 
        ? (window.i18nT ? window.i18nT('update_success', 'อัปเดตการรับซื้อสำเร็จ!') : 'อัปเดตการรับซื้อสำเร็จ!')
        : (window.i18nT ? window.i18nT('save_success', 'ลงทะเบียนรับซื้อสำเร็จ!') : 'ลงทะเบียนรับซื้อสำเร็จ!');
      
      window.appNotify(successMsg, "success");
      
      // ล้าง sessionStorage
      sessionStorage.removeItem("setbooking_step1");
      sessionStorage.removeItem("setbooking_step2");
      sessionStorage.removeItem("setbooking_payload");
      sessionStorage.removeItem("setbooking_complete");

      // Redirect ไปหน้าโปรไฟล์ของผู้ใช้หลังจาก 1.5 วินาที
      // [FIXED Bug2] ใช้ navigateWithTransition ถ้ามี และ path สัมพัทธ์จาก pages/buyer/setbooking/ → pages/buyer/myprofile.html
      setTimeout(() => {
        const dest = '../myprofile.html'; // setbooking/ → buyer/myprofile.html
        if (window.navigateWithTransition) window.navigateWithTransition(dest);
        else window.location.href = dest;
      }, 1500);

    } catch (error) {
      console.error("Error saving:", error);
      const errorMsg = window.i18nT ? window.i18nT('save_error', 'เกิดข้อผิดพลาด: ไม่สามารถบันทึกได้') : 'เกิดข้อผิดพลาด: ไม่สามารถบันทึกได้';
      window.appNotify(errorMsg + ": " + (error.message || ""), "error");
      saveAllBtn.disabled = false;
      saveAllBtn.textContent = window.i18nT ? window.i18nT('save_btn', 'บันทึก') : 'บันทึก';
    }
  });

  // ===== Init =====
  async function init() {
    loadStep1();
    renderStep1Summary();
    renderRounds();

    // [FIXED] ตรวจสอบว่าเป็นหมายเลข ID จริงหรือไม่ (กันกรณีเป็นชื่อสินค้าจาก Fallback)
    const isNumericId = (id) => id && !isNaN(id) && Number.isSafeInteger(Number(id));

    // หากเป็นการแก้ไข (Edit) ให้ดึงข้อมูลรอบเดิมมาจาก DB
    const offerId =
      state.step1?.product?.offer_id ||
      state.step1?.product?.offerId ||
      state.step1?.editSource?.offer_id ||
      state.step1?.editSource?.offerId ||
      state.step1?.product?.id ||
      state.step1?.editSource?.product_id;
    const isEdit = state.step1?.editSource?.isEdit && isNumericId(offerId);

    if (isEdit) {
        try {
            const res = await apiCall('GET', `/api/product-slots?offer_id=${offerId}&product_id=${offerId}`);
            const slots = res.data || [];
            if (slots.length > 0) {
                // ดึงวันเริ่มต้น-สิ้นสุดจากรอบแรก (ปกติเซตเดียวกันทุกรอบใน Batch)
                const first = slots[0];
                const sDate = first.start_date ? first.start_date.split('T')[0] : '';
                const eDate = first.end_date ? first.end_date.split('T')[0] : '';
                
                state.startDate = sDate;
                state.endDate = eDate;
                dateStart.value = sDate;
                dateEnd.value = eDate;
                
                // แมปข้อมูลเข้าสู่ตารางรอบคิว
                state.rounds = slots.map(s => ({
                    id: s.slot_id || cryptoId(),
                    name: s.slot_name || "รอบคิว",
                    start: (s.time_start || "").substring(0, 5), // เอาแค่ HH:mm
                    end: (s.time_end || "").substring(0, 5),     // เอาแค่ HH:mm
                    capacity: s.capacity,
                    enabled: s.is_active !== false
                }));
                
                renderRounds();
            }
        } catch (err) {
            console.error("Failed to fetch existing slots for pre-fill:", err);
        }
    }

    // wire back button
    const btnBack = document.getElementById("btnBack");
    if (btnBack) btnBack.addEventListener("click", goBackToStep1);
  }

  init();
})();
