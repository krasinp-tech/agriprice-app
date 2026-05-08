/**
 * setbooking-step1.js
 * - UI ตามภาพ: searchable dropdown + grade cards + modal เพิ่มเกรด
 * - รองรับ DB ในอนาคต: สลับใช้ fetch API ได้ (ดู CONFIG)
 */

(function () {
  // ===================== CONFIG =====================
  const CONFIG = {
    USE_API: false, // เปลี่ยนเป็น true เมื่อมี backend จริง
    API_BASE: (window.API_BASE_URL || "").replace(/\/$/, ""), // รองรับ config.js ในอนาคต
    ENDPOINTS: {
      products: "/api/products",         // GET ?q=
      varieties: "/api/varieties",       // GET ?productId=&q=
    },
  };

  // ===================== MOCK DATA =====================
  const MOCK_PRODUCTS = [
    { id: "p1", name: "ทุเรียน", hint: "เช่น หมอนทอง ก้านยาว" },
    { id: "p2", name: "มังคุด", hint: "คัดตามขนาด/เกรด" },
    { id: "p3", name: "เงาะ", hint: "โรงเรียน / สีทอง" },
    { id: "p4", name: "ลองกอง", hint: "ผลใหญ่ ผลเล็ก" },
    { id: "p5", name: "ลำไย", hint: "อีดอ / สีทอง" },
  ];

  const MOCK_VARIETIES = {
    p1: [
      { id: "v1", name: "หมอนทอง" },
      { id: "v2", name: "ก้านยาว" },
      { id: "v3", name: "ชะนี" },
      { id: "v4", name: "พวงมณี" },
    ],
    p2: [
      { id: "v5", name: "มังคุดคัดพิเศษ" },
      { id: "v6", name: "มังคุดทั่วไป" },
    ],
    p3: [
      { id: "v7", name: "เงาะโรงเรียน" },
      { id: "v8", name: "เงาะสีทอง" },
    ],
    p4: [
      { id: "v9", name: "ลองกองใหญ่" },
      { id: "v10", name: "ลองกองเล็ก" },
    ],
    p5: [
      { id: "v11", name: "อีดอ" },
      { id: "v12", name: "สีทอง" },
    ],
  };

  // ===================== STATE =====================
  const state = {
    selectedProduct: null,   // {id,name}
    selectedVariety: null,   // {id,name} or {custom:true,name}
    details: "",
    grades: [
      { grade: "A", price: 140 },
      { grade: "B", price: 140 },
    ],
    editSource: null,
  };

  // ===================== ELEMENTS =====================
  const productCombo = document.querySelector('[data-combo="product"]');
  const productInput = document.getElementById("productInput");
  const productMenu = productCombo.querySelector(".combo-menu");
  const productBtn = productCombo.querySelector(".combo-btn");

  const varietyCombo = document.querySelector('[data-combo="variety"]');
  const varietyInput = document.getElementById("varietyInput");
  const varietyMenu = varietyCombo.querySelector(".combo-menu");
  const varietyBtn = varietyCombo.querySelector(".combo-btn");

  const detailsEl = document.getElementById("details");

  const gradeRow = document.getElementById("gradeRow");

  const modalOverlay = document.getElementById("gradeModal");
  const cancelModalBtn = document.getElementById("cancelModalBtn");
  const saveModalBtn = document.getElementById("saveModalBtn");
  const gradeGrid = document.getElementById("gradeGrid");
  const customGrade = document.getElementById("customGrade");
  const unitPrice = document.getElementById("unitPrice");

  const nextBtn = document.getElementById("nextBtn");
  const debugBox = document.getElementById("debugBox");

  // ===================== HELPERS =====================
  function openCombo(comboEl) {
    comboEl.classList.add("open");
  }
  function closeCombo(comboEl) {
    comboEl.classList.remove("open");
  }
  function isOpen(comboEl) {
    return comboEl.classList.contains("open");
  }

  function sanitizeText(s) {
    return String(s || "").replace(/[<>]/g, "");
  }

  function uniqGrades(grades) {
    const seen = new Set();
    return grades.filter((g) => {
      const key = String(g.grade).trim().toUpperCase();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeGrade(s) {
    return String(s || "").trim();
  }

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function showModal() {
    modalOverlay.classList.add("show");
    modalOverlay.setAttribute("aria-hidden", "false");
    // default selection: A
    setSelectedGradeButton("A");
    customGrade.value = "";
    unitPrice.value = "";
    setTimeout(() => unitPrice.focus(), 50);
  }

  function hideModal() {
    modalOverlay.classList.remove("show");
    modalOverlay.setAttribute("aria-hidden", "true");
  }

  function renderGradeCards() {
    gradeRow.innerHTML = "";

    state.grades = uniqGrades(state.grades);

    state.grades.forEach((item, idx) => {
      const card = document.createElement("div");
      card.className = "grade-card";

      const remove = document.createElement("button");
      remove.className = "grade-remove";
      remove.type = "button";
      remove.setAttribute("aria-label", `ลบเกรด ${item.grade}`);
      remove.innerHTML = `<span class="material-icons-outlined">close</span>`;
      remove.addEventListener("click", () => {
        state.grades.splice(idx, 1);
        renderGradeCards();
      });

      const letter = document.createElement("div");
      letter.className = "grade-letter";
      letter.textContent = item.grade;

      const price = document.createElement("div");
      price.className = "grade-price";
      price.textContent = `${toNumber(item.price)} บ./กก.`;

      card.appendChild(remove);
      card.appendChild(letter);
      card.appendChild(price);

      gradeRow.appendChild(card);
    });

    // Add-grade card
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-grade";
    add.innerHTML = `<div class="plus">+</div><div class="text">เพิ่มเกรด</div>`;
    add.addEventListener("click", showModal);
    gradeRow.appendChild(add);
  }

  // ===================== GRADE GRID (MODAL) =====================
  const GRADE_BUTTONS = ["A", "B", "C", "D", "E", "F", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

  let selectedGradeBtn = "A";

  function setSelectedGradeButton(val) {
    selectedGradeBtn = val;
    const btns = gradeGrid.querySelectorAll(".pill");
    btns.forEach((b) => {
      const g = b.getAttribute("data-grade");
      b.classList.toggle("selected", g === selectedGradeBtn);
    });
  }

  function renderGradeGrid() {
    gradeGrid.innerHTML = "";
    GRADE_BUTTONS.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill" + (g === "A" ? " selected" : "");
      btn.textContent = g;
      btn.setAttribute("data-grade", g);
      btn.addEventListener("click", () => {
        setSelectedGradeButton(g);
        customGrade.value = "";
      });
      gradeGrid.appendChild(btn);
    });
  }

  // ===================== DATA LOADERS (MOCK / API) =====================
  async function apiGet(path, params = {}) {
    const url = new URL((CONFIG.API_BASE || "") + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  }

  async function loadProducts(query = "") {
    if (CONFIG.USE_API) {
      // expected: { items: [{id,name, hint?}] }
      const json = await apiGet(CONFIG.ENDPOINTS.products, { q: query });
      return Array.isArray(json.items) ? json.items : [];
    }
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_PRODUCTS;
    return MOCK_PRODUCTS.filter((p) => p.name.toLowerCase().includes(q));
  }

  async function loadVarieties(productId, query = "") {
    if (!productId) return [];
    if (CONFIG.USE_API) {
      // expected: { items: [{id,name}] }
      const json = await apiGet(CONFIG.ENDPOINTS.varieties, { productId, q: query });
      return Array.isArray(json.items) ? json.items : [];
    }
    const list = MOCK_VARIETIES[productId] || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) => v.name.toLowerCase().includes(q));
  }

  // ===================== COMBO RENDER =====================
  function renderMenu(menuEl, items, onPick) {
    menuEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "combo-item";
      empty.innerHTML = `<strong>ไม่พบรายการ</strong><small>ลองพิมพ์คำอื่น</small>`;
      empty.addEventListener("click", () => {});
      menuEl.appendChild(empty);
      return;
    }

    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "combo-item";
      row.setAttribute("role", "option");
      row.innerHTML = `<strong>${sanitizeText(it.name)}</strong>${it.hint ? `<small>${sanitizeText(it.hint)}</small>` : `<small>&nbsp;</small>`}`;
      row.addEventListener("click", () => onPick(it));
      menuEl.appendChild(row);
    });
  }

  // ===================== PRODUCT COMBO EVENTS =====================
  async function refreshProductMenu() {
    const items = await loadProducts(productInput.value || "");
    renderMenu(productMenu, items, (it) => {
      state.selectedProduct = { id: it.id, name: it.name };
      productInput.value = it.name;
      closeCombo(productCombo);

      // enable variety
      enableVariety();
      // reset variety selection
      state.selectedVariety = null;
      varietyInput.value = "";
      varietyInput.placeholder = "ค้นหาหรือกรอกสายพันธุ์";
    });
  }

  function enableVariety() {
    varietyCombo.classList.remove("disabled");
    varietyCombo.setAttribute("aria-disabled", "false");
    varietyInput.disabled = false;
    varietyBtn.disabled = false;
  }

  function disableVariety() {
    varietyCombo.classList.add("disabled");
    varietyCombo.setAttribute("aria-disabled", "true");
    varietyInput.disabled = true;
    varietyBtn.disabled = true;
    closeCombo(varietyCombo);
  }

  productInput.addEventListener("focus", async () => {
    openCombo(productCombo);
    await refreshProductMenu();
  });

  productInput.addEventListener("input", async () => {
    if (!isOpen(productCombo)) openCombo(productCombo);
    await refreshProductMenu();
  });

  productBtn.addEventListener("click", async () => {
    if (isOpen(productCombo)) {
      closeCombo(productCombo);
      return;
    }
    productInput.focus();
    openCombo(productCombo);
    await refreshProductMenu();
  });

  // ===================== VARIETY COMBO EVENTS =====================
  async function refreshVarietyMenu() {
    if (!state.selectedProduct?.id) return;
    const items = await loadVarieties(state.selectedProduct.id, varietyInput.value || "");
    renderMenu(varietyMenu, items, (it) => {
      state.selectedVariety = { id: it.id, name: it.name };
      varietyInput.value = it.name;
      closeCombo(varietyCombo);
    });
  }

  varietyInput.addEventListener("focus", async () => {
    if (varietyInput.disabled) return;
    openCombo(varietyCombo);
    await refreshVarietyMenu();
  });

  varietyInput.addEventListener("input", async () => {
    if (varietyInput.disabled) return;
    if (!isOpen(varietyCombo)) openCombo(varietyCombo);
    await refreshVarietyMenu();
  });

  varietyBtn.addEventListener("click", async () => {
    if (varietyBtn.disabled) return;
    if (isOpen(varietyCombo)) {
      closeCombo(varietyCombo);
      return;
    }
    varietyInput.focus();
    openCombo(varietyCombo);
    await refreshVarietyMenu();
  });

  // Allow custom variety typed
  varietyInput.addEventListener("blur", () => {
    const val = normalizeGrade(varietyInput.value);
    if (!val) return;
    if (!state.selectedVariety || state.selectedVariety.name !== val) {
      state.selectedVariety = { custom: true, name: val };
    }
  });

  // ===================== DETAILS =====================
  detailsEl.addEventListener("input", () => {
    state.details = detailsEl.value || "";
  });

  // ===================== MODAL EVENTS =====================
  cancelModalBtn.addEventListener("click", hideModal);

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalOverlay.classList.contains("show")) hideModal();
  });

  customGrade.addEventListener("input", () => {
    if (customGrade.value.trim().length) {
      // unselect button visually (keep state, but save uses custom)
      setSelectedGradeButton(selectedGradeBtn);
    }
  });

  saveModalBtn.addEventListener("click", () => {
    const custom = normalizeGrade(customGrade.value);
    const grade = custom || selectedGradeBtn;
    const price = toNumber(unitPrice.value);

    if (!grade) {
      alert("กรุณาเลือกหรือกรอกเกรด");
      return;
    }
    if (price <= 0) {
      alert("กรุณากรอกราคาให้มากกว่า 0");
      return;
    }

    // update or add
    const key = grade.toUpperCase();
    const found = state.grades.findIndex((g) => String(g.grade).toUpperCase() === key);
    if (found >= 0) {
      state.grades[found].price = price;
    } else {
      state.grades.push({ grade, price });
    }

    renderGradeCards();
    hideModal();
  });

  // ===================== NEXT BUTTON =====================
  nextBtn.addEventListener("click", () => {
    // validation minimal แบบใช้งานจริง
    if (!state.selectedProduct?.id) {
      alert("กรุณาเลือกผลผลิต");
      return;
    }
    if (!state.grades.length) {
      alert("กรุณาเพิ่มเกรดและราคาอย่างน้อย 1 รายการ");
      return;
    }

    // เก็บเพื่อส่ง step2 / ส่ง backend ในอนาคต
    const payload = {
      product: state.selectedProduct,
      variety: state.selectedVariety, // optional
      details: state.details,
      grades: state.grades,
      createdAt: new Date().toISOString(),
      editSource: state.editSource || null,
    };

    // เก็บลง sessionStorage เพื่อไป step2
    try {
      sessionStorage.setItem("setbooking_step1", JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to save step1 payload", err);
    }

    // แสดง debug และไปหน้าถัดไป
    debugBox.hidden = false;
    debugBox.textContent = JSON.stringify(payload, null, 2);
    // ไปยัง step2 (same folder)
    window.location.href = "./setbooking-step2.html";
  });

  // ===================== GLOBAL CLICK CLOSE MENUS =====================
  document.addEventListener("click", (e) => {
    const t = e.target;

    if (!productCombo.contains(t)) closeCombo(productCombo);
    if (!varietyCombo.contains(t)) closeCombo(varietyCombo);
  });

  // ===================== INIT =====================
  function init() {
    renderGradeGrid();
    renderGradeCards();
    disableVariety();

    // try to restore previous step1 inputs when returning from step2
    try {
      const raw = sessionStorage.getItem("setbooking_step1");
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload.product) {
          state.selectedProduct = payload.product;
          productInput.value = payload.product.name || "";
          enableVariety();
        }
        if (payload.variety) {
          state.selectedVariety = payload.variety;
          varietyInput.value = payload.variety.name || "";
        }
        if (payload.details) {
          state.details = payload.details;
          detailsEl.value = payload.details;
        }
        if (Array.isArray(payload.grades) && payload.grades.length) {
          state.grades = payload.grades;
          renderGradeCards();
        }
        if (payload.editSource) {
          state.editSource = payload.editSource;
        }
      }
    } catch (err) {
      console.error("Failed to restore step1 payload", err);
    }
  }

  init();
})();
