/**
 * setbooking-step2.js
 * - UI ตามรูป: ช่วงวันที่ + ตารางรอบคิว + toggle + ลบ + modal เพิ่มรอบ
 * - รองรับ DB: รวม payload จาก step1 แล้วเตรียมส่ง API ในอนาคต
 */

(function () {
  // ===== CONFIG (ต่อ API ในอนาคต) =====
  const CONFIG = {
    USE_API: false,
    API_BASE: (window.API_BASE_URL || "").replace(/\/$/, ""),
    ENDPOINTS: {
      save: "/api/setbooking", // POST payload
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
    rounds: [
      { id: cryptoId(), name: "รอบที่1", start: "08:00", end: "10:00", capacity: 5, enabled: true },
      { id: cryptoId(), name: "รอบที่2", start: "11:00", end: "13:00", capacity: 5, enabled: true },
      { id: cryptoId(), name: "รอบที่3", start: "13:00", end: "15:00", capacity: 5, enabled: true },
      { id: cryptoId(), name: "รอบที่4", start: "15:00", end: "17:00", capacity: 5, enabled: false },
    ],
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
    modal.setAttribute("aria-hidden", "false");

    // reset fields (ตามภาพ)
    roundName.value = "";
    timeStart.value = "";
    timeEnd.value = "";
    capacity.value = "";

    setTimeout(() => roundName.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
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
        window.location.href = "./setbooking-step1.html";
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
    const url = new URL((CONFIG.API_BASE || "") + path, window.location.origin);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("API error");
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
          ${grades.map(g => `<div style="background:#f3f6f4;padding:6px 8px;border-radius:10px;font-weight:700">${escapeHtml(String(g.grade))} — ${escapeHtml(String(g.price))} บ./กก.</div>`).join("")}
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
      alert("กรุณากรอกเวลาเริ่มต้นและเวลาสิ้นสุด");
      return;
    }
    const sm = parseTimeToMinutes(s);
    const em = parseTimeToMinutes(e);
    if (!Number.isFinite(sm) || !Number.isFinite(em) || em <= sm) {
      alert("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
      return;
    }
    if (!Number.isFinite(cap) || cap <= 0) {
      alert("กรุณากรอกจำนวนคิวให้มากกว่า 0");
      return;
    }

    // กันซ้อนเวลาแบบง่าย: ถ้าทับช่วงกับรอบที่เปิดใช้อยู่
    const overlap = state.rounds.some((r) => {
      const rsm = parseTimeToMinutes(r.start);
      const rem = parseTimeToMinutes(r.end);
      // overlap: start < otherEnd && end > otherStart
      return sm < rem && em > rsm;
    });
    if (overlap) {
      // ตามจริงคุณอาจอยากให้ซ้อนได้ แต่ในระบบคิวส่วนใหญ่ไม่ให้ซ้อน
      // ถ้าอยากให้ซ้อนได้ ลบบล็อกนี้ออก
      alert("เวลารอบคิวซ้อนกับรอบเดิม กรุณาเลือกช่วงเวลาใหม่");
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
      alert("กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด");
      return;
    }
    if (new Date(end) < new Date(start)) {
      alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return;
    }
    if (!state.rounds.length) {
      alert("กรุณาเพิ่มรอบคิวอย่างน้อย 1 รอบ");
      return;
    }

    const payload = {
      step1: state.step1, // อาจเป็น null ถ้าเข้าหน้านี้ตรงๆ
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
      createdAt: new Date().toISOString(),
    };

    // เก็บรวมไว้ (ใช้ต่อ/ส่ง backend ภายหลัง)
    sessionStorage.setItem("setbooking_payload", JSON.stringify(payload));

    // If this booking was editing from myprofile, navigate back so profile can refresh
    try {
      if (payload && payload.step1 && payload.step1.editSource && payload.step1.editSource.page === "myprofile") {
        // pages/setbooking/ -> pages/myprofile.html is ../myprofile.html
        alert("บันทึกข้อมูลแล้ว");
        window.location.href = "../myprofile.html";
        return;
      }
    } catch (e) {}

    // ถ้ามี backend แล้วค่อยเปิดใช้
    try {
      if (CONFIG.USE_API) {
        const res = await apiPost(CONFIG.ENDPOINTS.save, payload);
        alert("บันทึกสำเร็จ");
        // ไปหน้าถัดไป/หน้าสรุปได้
      } else {
        debugBox.hidden = false;
        debugBox.textContent = JSON.stringify(payload, null, 2);
        alert("บันทึกข้อมูลแล้ว (เก็บใน sessionStorage: setbooking_payload)");
      }
    } catch (err) {
      console.error(err);
      alert("บันทึกไม่สำเร็จ กรุณาลองใหม่");
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
