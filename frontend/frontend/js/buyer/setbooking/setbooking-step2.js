/**
 * setbooking-step2.js
 * - UI เธ•เธฒเธกเธฃเธนเธ: เธเนเธงเธเธงเธฑเธเธ—เธตเน + เธ•เธฒเธฃเธฒเธเธฃเธญเธเธเธดเธง + toggle + เธฅเธ + modal เน€เธเธดเนเธกเธฃเธญเธ
 * - เธฃเธญเธเธฃเธฑเธ DB: เธฃเธงเธก payload เธเธฒเธ step1 เนเธฅเนเธงเน€เธ•เธฃเธตเธขเธกเธชเนเธ API เนเธเธญเธเธฒเธเธ•
 * NOTE: เธชเธฃเนเธฒเธ product เนเธ /api/products เน€เธเนเธ flow เธเธญเธ Farmer เนเธกเนเนเธเน Buyer
 * เธ–เนเธฒ token เธเธญเธ buyer เธ–เธนเธเนเธเนเธชเธฃเนเธฒเธ product server เธเธฐเธเธเธดเน€เธชเธ (role เนเธกเนเธ–เธนเธเธ•เนเธญเธ)
 * เธเธงเธฃเธขเนเธฒเธขเนเธเธฅเนเธซเธฃเธทเธญเธเธฃเธฑเธ flow เนเธซเนเธ•เธฃเธเธเธฑเธเธเธ—เธเธฒเธ—
 */

(function () {
  // ===== CONFIG (ต่อ API ในอนาคต) =====
  const CONFIG = {
    USE_API: !!(window.API_BASE_URL),
    API_BASE: (window.API_BASE_URL || "").replace(/\/$/, ""),
    ENDPOINTS: {
      save: "/api/products", // POST เธชเธฃเนเธฒเธเธชเธดเธเธเนเธฒ
    },
  };

  // ===== Elements =====
  const dateStart = document.getElementById("dateStart");
  const dateEnd = document.getElementById("dateEnd");
  const roundTbody = document.getElementById("roundTbody");
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
    roundTbody.innerHTML = "";

    state.rounds.forEach((r) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.start)}</td>
        <td>${escapeHtml(r.end)}</td>
        <td>${Number(r.capacity)}</td>
        <td>
          <button class="toggle ${r.enabled ? "on" : ""}" type="button" aria-label="เปลี่ยนสถานะ"></button>
        </td>
        <td>
          <button class="icon-btn" type="button" aria-label="ลบรอบ">
            <span class="material-icons-outlined">delete</span>
          </button>
        </td>
      `;

      // toggle
      const toggleBtn = tr.querySelector(".toggle");
      toggleBtn.addEventListener("click", () => {
        r.enabled = !r.enabled;
        renderRounds();
      });

      // delete
      const delBtn = tr.querySelector(".icon-btn");
      delBtn.addEventListener("click", () => {
        state.rounds = state.rounds.filter(x => x.id !== r.id);
        renderRounds();
      });

      roundTbody.appendChild(tr);
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

  async function apiPost(path, body) {
    const base = CONFIG.API_BASE || "";
    const token = localStorage.getItem(window.AUTH_TOKEN_KEY || "token") || "";
    const authHeader = token ? { "Authorization": "Bearer " + token } : {};

    // /api/products ใช้ multer (multipart/form-data) ต้องส่ง FormData
    if (path === "/api/products") {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => {
        if (v !== undefined && v !== null) fd.append(k, String(v));
      });
      const res = await fetch(base + path, {
        method: "POST",
        headers: authHeader,   // ห้ามใส่ Content-Type เอง (browser จัดการ boundary เอง)
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "สร้างสินค้าไม่สำเร็จ");
      }
      return await res.json();
    }

    // routes อื่น ๆ ส่ง JSON
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify(body),
    });
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
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:800;font-size:15px;color:#111827">สรุปการรับซื้อที่เลือก</div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="font-size:14px;color:#444">ผลผลิต: <strong>${escapeHtml(p.name || "-")}</strong></div>
          <div style="font-size:14px;color:#444">สายพันธุ์: <strong>${escapeHtml(v?.name || "-")}</strong></div>
        </div>
        <div style="font-size:13px;color:#666">คำอธิบาย: ${escapeHtml(details || "-")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          ${grades.map(g => `<div style="background:#f3f6f4;padding:6px 8px;border-radius:10px;font-weight:700">${escapeHtml(String(g.grade))} - ${escapeHtml(String(g.price))} บ./กก.</div>`).join("")}
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
    const name = (roundName.value || "").trim() || "รอบใหม่";
    const s = (timeStart.value || "").trim();
    const e = (timeEnd.value || "").trim();
    const cap = Number(capacity.value);

    if (!s || !e) {
      window.appNotify("กรุณากรอกเวลาเริ่มต้นและเวลาสิ้นสุด", "error");
      return;
    }
    const sm = parseTimeToMinutes(s);
    const em = parseTimeToMinutes(e);
    if (!Number.isFinite(sm) || !Number.isFinite(em) || em <= sm) {
      window.appNotify("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น", "error");
      return;
    }
    if (!Number.isFinite(cap) || cap <= 0) {
      window.appNotify("กรุณากรอกจำนวนคิวให้มากกว่า 0", "error");
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
      window.appNotify("เวลารอบคิวซ้อนกับรอบเดิม กรุณาเลือกช่วงเวลาใหม่", "error");
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
      window.appNotify("กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด", "error");
      return;
    }
    if (new Date(end) < new Date(start)) {
      window.appNotify("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น", "error");
      return;
    }
    if (!state.rounds.length) {
      window.appNotify("กรุณาเพิ่มรอบคิวอย่างน้อย 1 รอบ", "error");
      return;
    }

    // ต้องมีข้อมูล step1
    if (!state.step1 || !state.step1.product) {
      window.appNotify("ไม่พบข้อมูลผลผลิต กรุณากลับไปขั้นตอนที่ 1", "error");
      return;
    }

    try {
      saveAllBtn.disabled = true;
      saveAllBtn.textContent = "กำลังบันทึก...";

      // สร้าง product พร้อม variety + grades ทั้งหมด
      const gradesArr = Array.isArray(state.step1.grades) ? state.step1.grades : [];
      const productData = {
        name:        state.step1.product.name,
        description: state.step1.details || `รับซื้อ ${state.step1.product.name}${state.step1.variety?.name ? ' ' + state.step1.variety.name : ''}`,
        category:    state.step1.product.name,
        variety_id:  state.step1.variety?.variety_id || state.step1.variety?.id || null, // [NORMALIZED] ส่ง variety_id แทน variety text
        unit:        'กก.',
        quantity:    999999,
        // [NORMALIZED] ส่งแค่ grades array โดย server จะ insert ลง product_grades ให้
        // ไม่ส่ง price และ grade แยกอีกต่อไป (column ถูก drop แล้ว)
        grades:      JSON.stringify(gradesArr),
      };

      const productResult = await apiPost('/api/products', productData);
      const productId = productResult.id || productResult.data?.id;

      if (!productId) {
        throw new Error('ไม่สามารถสร้างผลผลิตได้');
      }

      // สร้าง slots แบบ batch
      const slotsPayload = {
        product_id: productId,
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

      await apiPost('/api/product-slots/batch', slotsPayload);

      // เก็บข้อมูลไว้ใน sessionStorage
      const payload = {
        step1: state.step1,
        step2: {
          startDate: start,
          endDate: end,
          rounds: state.rounds.map(r => ({
            name: r.name,
            start: r.start,
            end: r.end,
            capacity: r.capacity,
            enabled: r.enabled,
          })),
        },
      };
      sessionStorage.setItem("setbooking_payload", JSON.stringify(payload));
      sessionStorage.setItem("setbooking_complete", JSON.stringify({ product_id: productId, ...payload }));

      window.appNotify("สร้างรายการรับซื้อสำเร็จ!", "success");
      // ล้าง sessionStorage
      sessionStorage.removeItem("setbooking_step1");
      sessionStorage.removeItem("setbooking_step2");
      sessionStorage.removeItem("setbooking_payload");
      sessionStorage.removeItem("setbooking_complete");

      // Redirect ไปหน้าโปรไฟล์ของผู้ใช้หลังจาก 1.5 วินาที
      setTimeout(() => {
        window.location.href = '../../buyer/myprofile.html';
      }, 1500);

    } catch (error) {
      console.error("Error saving:", error);
      window.appNotify("เกิดข้อผิดพลาด: " + (error.message || "ไม่สามารถบันทึกได้"), "error");
      saveAllBtn.disabled = false;
      saveAllBtn.textContent = "บันทึก";
    }
  });

  // ===== Init =====
  function init() {
    loadStep1();
    renderStep1Summary();
    renderRounds();
    // wire back button
    const btnBack = document.getElementById("btnBack");
    if (btnBack) btnBack.addEventListener("click", goBackToStep1);
  }

  init();
})();
