/**
 * setbooking-step1.js
 * - UI ตามภาพ: searchable dropdown + grade cards + modal เพิ่มเกรด
 * - รองรับ DB ในอนาคต: สลับใช้ fetch API ได้ (ดู CONFIG)
 */

(function () {
  // ===================== CONFIG =====================
  const CONFIG = {
    USE_API: !!(window.API_BASE_URL || window.api), // auto-enable เมื่อมี API
    getApiBase: () => window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || "").replace(/\/$/, ""),
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
      remove.setAttribute("aria-label", `${window.i18nT ? window.i18nT('delete_grade', 'ลบเกรด') : 'ลบเกรด'} ${item.grade}`);
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
      const unitLabel = window.i18nT ? window.i18nT('baht_per_kg', 'บ./กก.') : 'บ./กก.';
      price.textContent = `${toNumber(item.price)} ${unitLabel}`;

      card.appendChild(remove);
      card.appendChild(letter);
      card.appendChild(price);

      gradeRow.appendChild(card);
    });

    // Add-grade card
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-grade";
    const addText = window.i18nT ? window.i18nT('add_grade_btn', 'เพิ่มเกรด') : 'เพิ่มเกรด';
    add.innerHTML = `<div class="plus">+</div><div class="text">${addText}</div>`;
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
  // รายชื่อสินค้าเกษตรสำรอง (แสดงเมื่อ API ยังไม่มีข้อมูล)
  const PRODUCT_FALLBACK = [
    'ทุเรียน','มะม่วง','มังคุด','ลำไย','เงาะ','กล้วย','สับปะรด',
    'ข้าว','ข้าวโพดเลี้ยงสัตว์','มันสำปะหลัง','อ้อย','ถั่วเหลือง','ถั่วเขียว','ถั่วลิสง',
    'คะน้า','ผักบุ้งจีน','ผักกาดขาว','กะหล่ำปลี','พริก','มะเขือเทศ','แตงกวา','ถั่วฝักยาว','ฟักทอง',
    'ปาล์มน้ำมัน','งา','ทานตะวัน','ยางพารา','ขมิ้นชัน','ขิง','ตะไคร้','กระชาย',
  ].map(n => ({ id: n, name: n }));

  async function loadProducts(query = "") {
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = CONFIG.getApiBase();
    let items = PRODUCT_FALLBACK;

    if (currentBase) {
      try {
        const url = currentBase + '/api/product-types';
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        const res = await fetch(url, token ? { headers: { 'Authorization': 'Bearer ' + token } } : {});
        if (res.ok) {
          const json = await res.json();
          if ((json.data || []).length > 0) {
            items = json.data.map(p => ({
              id: p.product_id || p.fruit_id || p.id || p.name,
              fruit_id: p.product_id || p.fruit_id || p.id,
              name: p.name || p.product_name
            }));
          }
        }
      } catch (e) {
        if (window.AGRIPRICE_DEBUG) console.warn('[setbooking-step1] products API failed, using fallback:', e.message);
      }
    }

    // กรองตามคำค้น
    const q = (query || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(p => {
      const orig = p.name.toLowerCase();
      const trans = (window.i18nT ? window.i18nT(p.name, p.name) : p.name).toLowerCase();
      return orig.includes(q) || trans.includes(q);
    });
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
    if (!fruitId) return [];
    if (window.APP_CONFIG_READY) await window.APP_CONFIG_READY;
    const currentBase = CONFIG.getApiBase();
    let items = [];

    if (currentBase) {
      try {
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token') || '';
        // Send both name and fruit_id to support different backend versions
        const params = new URLSearchParams({ 
          name: fruitId,
          fruit_id: fruitId,
          q: query || ''
        });
        
        const res = await fetch(currentBase + '/api/fruit-varieties?' + params.toString(),
          token ? { headers: { 'Authorization': 'Bearer ' + token } } : {});
        
        if (res.ok) {
          const result = await res.json();
          if (result && result.success && Array.isArray(result.data)) {
            items = result.data.map(v => ({ 
              id: v.variety_id || v.id, 
              variety_id: v.variety_id || v.id, 
              name: v.name || v.variety 
            }));
          }
        }
      } catch (e) {
        if (window.AGRIPRICE_DEBUG) console.warn('[setbooking-step1] loadVarieties API failed:', e.message);
      }
    }

    // --- SMART FALLBACK ---
    // If API returns nothing, try to guess from local VARIETY_FALLBACK
    if (items.length === 0) {
      const q = (query || '').trim().toLowerCase();
      const fruitKey = Object.keys(VARIETY_FALLBACK).find(k => fruitId.includes(k) || k.includes(fruitId));
      if (fruitKey) {
        const fallbackList = VARIETY_FALLBACK[fruitKey].map(n => ({ id: n, name: n }));
        items = q ? fallbackList.filter(v => {
          const orig = v.name.toLowerCase();
          const trans = (window.i18nT ? window.i18nT(v.name, v.name) : v.name).toLowerCase();
          return orig.includes(q) || trans.includes(q);
        }) : fallbackList;
      }
    } else if (query) {
      const q = query.trim().toLowerCase();
      items = items.filter(v => {
        const orig = v.name.toLowerCase();
        const trans = (window.i18nT ? window.i18nT(v.name, v.name) : v.name).toLowerCase();
        return orig.includes(q) || trans.includes(q);
      });
    }

    return items;
  }

  // ===================== COMBO RENDER =====================
  function renderMenu(menuEl, items, onPick) {
    menuEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "combo-item";
      const notFoundText = window.i18nT ? window.i18nT('not_found', 'ไม่พบรายการ') : 'ไม่พบรายการ';
      const tryOtherText = window.i18nT ? window.i18nT('try_other_words', 'ลองพิมพ์คำอื่น') : 'ลองพิมพ์คำอื่น';
      empty.innerHTML = `<strong>${notFoundText}</strong><small>${tryOtherText}</small>`;
      empty.addEventListener("click", () => {});
      menuEl.appendChild(empty);
      return;
    }

    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "combo-item";
      row.setAttribute("role", "option");
      const displayName = window.i18nT ? window.i18nT(it.name, it.name) : it.name;
      row.innerHTML = `<strong>${sanitizeText(displayName)}</strong>${it.hint ? `<small>${sanitizeText(it.hint)}</small>` : `<small>&nbsp;</small>`}`;
      row.addEventListener("click", () => onPick(it));
      menuEl.appendChild(row);
    });
  }

  // ===================== PRODUCT COMBO EVENTS =====================
  async function refreshProductMenu() {
    const items = await loadProducts(productInput.value || "");
    renderMenu(productMenu, items, (it) => {
      state.selectedProduct = { id: it.id, fruit_id: it.fruit_id, name: it.name };
      const displayName = window.i18nT ? window.i18nT(it.name, it.name) : it.name;
      productInput.value = displayName;
      closeCombo(productCombo);

      // enable variety
      enableVariety();
      // reset variety selection
      state.selectedVariety = null;
      varietyInput.value = "";
      varietyInput.placeholder = window.i18nT ? window.i18nT('variety_placeholder', 'ค้นหาหรือกรอกสายพันธุ์') : 'ค้นหาหรือกรอกสายพันธุ์';
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
    if (!state.selectedProduct?.name) return;
    const productKey = state.selectedProduct.fruit_id || state.selectedProduct.id || state.selectedProduct.name;
    const items = await loadVarieties(String(productKey), varietyInput.value || "");
    renderMenu(varietyMenu, items, (it) => {
      state.selectedVariety = { id: it.id, variety_id: it.variety_id || it.id, name: it.name };
      const displayName = window.i18nT ? window.i18nT(it.name, it.name) : it.name;
      varietyInput.value = displayName;
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
      window.appNotify(window.i18nT ? window.i18nT('please_select_grade', 'กรุณาเลือกหรือกรอกเกรด') : 'กรุณาเลือกหรือกรอกเกรด', "error");
      return;
    }
    if (price <= 0) {
      window.appNotify(window.i18nT ? window.i18nT('please_enter_price', 'กรุณากรอกราคาให้มากกว่า 0') : 'กรุณากรอกราคาให้มากกว่า 0', "error");
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
      window.appNotify(window.i18nT ? window.i18nT('please_select_product', 'กรุณาเลือกผลผลิต') : 'กรุณาเลือกผลผลิต', "error");
      return;
    }
    if (!state.grades.length) {
      window.appNotify(window.i18nT ? window.i18nT('please_add_at_least_one_grade', 'กรุณาเพิ่มเกรดและราคาอย่างน้อย 1 รายการ') : 'กรุณาเพิ่มเกรดและราคาอย่างน้อย 1 รายการ', "error");
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
  async function init() {
    renderGradeGrid();
    renderGradeCards();
    disableVariety();

    // ── Tier Limit Guard ──
    // ป้องกัน user พิมพ์ URL โดยตรงเข้าหน้านี้เมื่อเกิน limit
    try {
      const currentBase = CONFIG.getApiBase();
      const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token');

      // ดึง tier จาก localStorage ก่อน (instant)
      let tier = 'free';
      try {
        const raw = localStorage.getItem('user_data');
        if (raw) {
          const u = JSON.parse(raw);
          if (u && u.tier) tier = u.tier.toLowerCase();
        }
      } catch (_) {}

      const tierLimit = tier === 'pro' ? 10 : 3;

      // ดึง active product count
      if (currentBase && token) {
        const userDataRaw = localStorage.getItem('user_data');
        const userId = userDataRaw ? JSON.parse(userDataRaw).profile_id || JSON.parse(userDataRaw).id : null;
        if (userId) {
          const r = await fetch(`${currentBase}/api/products?user_id=${userId}&limit=1`, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (r.ok) {
            const json = await r.json();
            const activeCount = json.total || (json.data || []).filter(p => p.is_active !== false).length;
            if (activeCount >= tierLimit) {
              const t = (k, f) => window.i18nT ? window.i18nT(k, f) : f;
              if (tier === 'free') {
                const confirmMsg = t('error_free_limit', 'บัญชี FREE จำกัดการสร้างรายการรับซื้อสูงสุด 3 รายการ ต้องการอัปเกรดเป็น PRO เพื่อรับสิทธิ์เพิ่มรายการได้สูงสุด 10 รายการหรือไม่?');
                if (window.showConfirm) {
                  window.showConfirm(confirmMsg, (agreed) => {
                    if (agreed) {
                      window.location.href = '../../../pages/account/subscription.html';
                    } else {
                      window.location.href = '../myprofile.html';
                    }
                  });
                } else {
                  window.showAlert?.(confirmMsg, 'info');
                  window.location.href = '../myprofile.html';
                }
              } else {
                window.showAlert?.(t('error_pro_limit', 'ขออภัย บัญชี PRO จำกัดการสร้างรายการรับซื้อสูงสุด 10 รายการเท่านั้น'), 'warning');
                window.location.href = '../myprofile.html';
              }
              return; // หยุดการแสดงผล step1
            }
          }
        }
      }
    } catch (guardErr) {
      // ถ้าตรวจสอบไม่ได้ แสดงหน้าปกติไปเลย (fail open)
      console.warn('[setbooking-step1] Tier guard failed, proceeding:', guardErr.message);
    }
    // ────────────────────

    // try to restore previous step1 inputs when returning from step2
    try {
      const raw = sessionStorage.getItem("setbooking_step1");
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload.product) {
          state.selectedProduct = payload.product;
          productInput.value = window.i18nT ? window.i18nT(payload.product.name, payload.product.name) : (payload.product.name || "");
          enableVariety();
        }
        if (payload.variety) {
          state.selectedVariety = payload.variety;
          varietyInput.value = window.i18nT ? window.i18nT(payload.variety.name, payload.variety.name) : (payload.variety.name || "");
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
