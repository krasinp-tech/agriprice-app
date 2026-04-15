/**
 * setbooking-step1.js
 * - UI ตามภาพ: searchable dropdown + grade cards + modal เพิ่มเกรด
 * - รองรับ DB ในอนาคต: สลับใช้ fetch API ได้ (ดู CONFIG)
 */

(function () {
  // ===================== CONFIG =====================
  const CONFIG = {
    USE_API: !!(window.API_BASE_URL || window.api), // auto-enable เมื่อมี API
    API_BASE: (window.API_BASE_URL || "").replace(/\/$/, ""),
  };

  // ===================== STATE =====================
  const state = {
    selectedProduct: null,   // {id,name}
    selectedVariety: null,   // {id,name} or {custom:true,name}
    details: "",
    grades: [], // ไม่มี default ให้ผู้ใช้กรอกเอง
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
    modalOverlay.removeAttribute("inert");
    // default selection: A
    setSelectedGradeButton("A");
    customGrade.value = "";
    unitPrice.value = "";
    setTimeout(() => unitPrice.focus(), 50);
  }

  function hideModal() {
    modalOverlay.classList.remove("show");
    modalOverlay.setAttribute("inert", "");
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

  // ===================== DATA LOADERS (API) =====================
  // รายชื่อผลไม้สำรอง (แสดงเมื่อ API ยังไม่มีข้อมูล)
  const FRUIT_FALLBACK = [
    'กล้วย','ชมพู่','ทุเรียน','ฝรั่ง','พุทรา','ฟักทอง',
    'มะนาว','มะพร้าว','มะม่วง','มะละกอ','มังคุด','ลองกอง',
    'ลำไย','ลิ้นจี่','เงาะ','ส้ม','สตรอว์เบอร์รี','สับปะรด',
    'องุ่น','อ้อย',
  ].map(n => ({ id: n, name: n }));

  async function loadProducts(query = "") {
    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    let items = FRUIT_FALLBACK;

    if (API_BASE) {
      try {
        const url = API_BASE + '/api/fruits';
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        const res = await fetch(url, token ? { headers: { 'Authorization': 'Bearer ' + token } } : {});
        if (res.ok) {
          const json = await res.json();
          if ((json.data || []).length > 0) {
            items = json.data.map(p => ({ id: p.fruit_id || p.name, fruit_id: p.fruit_id, name: p.name }));
          }
        }
      } catch (e) {
        if (window.AGRIPRICE_DEBUG) console.warn('[setbooking-step1] fruits API failed, using fallback:', e.message);
      }
    }

    // กรองตามคำค้น
    const q = (query || '').trim().toLowerCase();
    return q ? items.filter(p => p.name.toLowerCase().includes(q)) : items;
  }

  const VARIETY_FALLBACK = {
    'ทุเรียน':      ['หมอนทอง','ชะนี','กระดุม','พวงมณี','ก้านยาว','กบ'],
    'มังคุด':       ['พื้นเมือง','คัดพิเศษ','ส่งออก'],
    'ลองกอง':       ['ธรรมดา','ดาวเรือง'],
    'เงาะ':         ['โรงเรียน','สีชมพู','พื้นเมือง'],
    'สับปะรด':      ['ปัตตาเวีย','อินทรชิต','ภูเก็ต'],
    'ลำไย':         ['อีดอ','บีเอ็นเอส','สีชมพู','เบี้ยวเขียว'],
    'มะม่วง':       ['น้ำดอกไม้','มหาชนก','อกร่อง','เขียวเสวย','แรด'],
    'กล้วย':        ['หอมทอง','น้ำว้า','ไข่','หักมุก'],
    'มะพร้าว':      ['น้ำหอม','มะพร้าวแก่','มะพร้าวอ่อน'],
    'ส้ม':          ['โชกุน','สายน้ำผึ้ง','เขียวหวาน'],
    'มะละกอ':       ['แขกดำ','ฮอลแลนด์','พันธุ์ท่าพระ'],
    'ฝรั่ง':        ['แป้นสีทอง','กลมสาลี่'],
    'มะนาว':        ['ไข่','แป้น'],
    'ชมพู่':        ['ทับทิมจันทร์','มะเหมี่ยว'],
    'สตรอว์เบอร์รี': ['329','พระราชทาน 80'],
    'องุ่น':        ['ไชน์มัสแคท','แดงหวาน','เขียวหวาน'],
    'ลิ้นจี่':      ['ฮงฮวย','จักรพรรดิ์','กิมเจ็ง'],
  };

  async function loadVarieties(fruitId, query = "") {
    if (!fruitId) return []; เธเนเธญเธ
    let items = [];

    const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
    if (API_BASE) {
      try {
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        const params = new URLSearchParams({ fruit_id: fruitId });
        if (query) params.set('q', query);
        const res = await fetch(API_BASE + '/api/fruit-varieties?' + params.toString(),
          token ? { headers: { 'Authorization': 'Bearer ' + token } } : {});
        if (res.ok) {
          const result = await res.json();
          if ((result.data || []).length > 0) {
            items = result.data.map(v => ({ id: v.variety_id || v.id, variety_id: v.variety_id || v.id, name: v.name || v.variety }));
          }
        }
      } catch (e) {
        if (window.AGRIPRICE_DEBUG) console.warn('[setbooking-step1] loadVarieties API failed, using fallback:', e.message);
      }
    }

    const q = (query || '').trim().toLowerCase();
    return q ? items.filter(v => v.name.toLowerCase().includes(q)) : items;
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
      state.selectedProduct = { id: it.id, fruit_id: it.fruit_id, name: it.name };
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
    if (!state.selectedProduct?.fruit_id) return;
    const items = await loadVarieties(state.selectedProduct.fruit_id, varietyInput.value || "");
    renderMenu(varietyMenu, items, (it) => {
      state.selectedVariety = { id: it.id, variety_id: it.variety_id || it.id, name: it.name };
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
      window.appNotify("กรุณาเลือกหรือกรอกเกรด", "error");
      return;
    }
    if (price <= 0) {
      window.appNotify("กรุณากรอกราคาให้มากกว่า 0", "error");
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
    // validation ขั้นต่ำสำหรับใช้งานจริง
    if (!state.selectedProduct?.id) {
      window.appNotify("กรุณาเลือกผลผลิต", "error");
      return;
    }
    if (!state.grades.length) {
      window.appNotify("กรุณาเพิ่มเกรดและราคาอย่างน้อย 1 รายการ", "error");
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
    if (window.navigateWithTransition) window.navigateWithTransition("./setbooking-step2.html"); else window.location.href = "./setbooking-step2.html";
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
