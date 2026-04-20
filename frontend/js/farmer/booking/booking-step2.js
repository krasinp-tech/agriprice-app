/**
 * AGRIPRICE - Booking Step 2 JavaScript
 * ฟีเจอร์: ฟอร์มรถหลายคัน, แก้ไขโปรไฟล์, บันทึก localStorage
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
    const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;
    // ================================
    // Elements
    // ================================
    const btnBack = document.getElementById("btnBack");
    const btnSubmit = document.getElementById("btnSubmit");
    const btnAddVehicle = document.getElementById("btnAddVehicle");
    const additionalVehicles = document.getElementById("additionalVehicles");
    const productAmount = document.getElementById("productAmount");

    // Contact elements
    const contactName = document.getElementById("contactName");
    const contactPhone = document.getElementById("contactPhone");
    const btnEditProfile = document.getElementById("btnEditProfile");

    // Modal elements
    const modalOverlay = document.getElementById("modalOverlay");
    const btnCloseModal = document.getElementById("btnCloseModal");
    const btnCancelModal = document.getElementById("btnCancelModal");
    const btnSaveModal = document.getElementById("btnSaveModal");
    const editName = document.getElementById("editName");
    const editPhone = document.getElementById("editPhone");

    // ================================
    // State
    // ================================
    let vehicleCount = 1;
    const MAX_VEHICLES = 5;

    // โหลดจาก API จริงใน init() ด้านล่าง
    let userProfile = { name: '', phone: '', address: '' };

    const vehicleTypes = {
        "pickup-4": { name: "รถกระบะทั่วไป (4 ล้อ)", weight: "9.5" },
        "pickup-cage-4": { name: "รถพ่วง/เทรลเลอร์", weight: "9.5" },
        "truck-6": { name: "รถ 6 ล้อ", weight: "15" },
        "truck-10": { name: "รถ 10 ล้อ", weight: "25" },
        "trailer": { name: "รถพ่วง/เทรลเลอร์ (6 เพลา 22 ล้อ)", weight: "50.5" },
        "motorcycle": { name: "มอเตอร์ไซค์พ่วงข้าง", weight: "0.5" },
        "other": { name: "อื่นๆ", weight: "" }
    };

    // ================================
    // DATABASE-READY API LAYER
    // ================================
    const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
    const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
    function authHeaders() {
        const t = localStorage.getItem(TOKEN_KEY) || '';
        return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }

    const BookingAPI = {
        async saveStep2(data) {
            // บันทึกใน localStorage เพื่อส่งต่อ step3 (ข้อมูลรถ/ผลผลิต)
            localStorage.setItem('bookingStep2', JSON.stringify(data));
            return { success: true, data };
        },

        async loadStep2() {
            const data = localStorage.getItem('bookingStep2');
            return data ? JSON.parse(data) : null;
        },

        async updateProfile(profile) {
            if (API_BASE) {
                try {
                    const res = await fetch(API_BASE + '/api/profile', {
                        method: 'PATCH',
                        headers: authHeaders(),
                        body: JSON.stringify({
                                                        first_name: (() => {
                                                            const arr = (profile.name || '').trim().split(' ');
                                                            if (arr.length === 1) return arr[0];
                                                            if (arr.length === 2) return arr[0];
                                                            if (arr.length > 2) return arr.slice(0, arr.length-1).join(' ');
                                                            return profile.name || '';
                                                        })(),
                                                        last_name: (() => {
                                                            const arr = (profile.name || '').trim().split(' ');
                                                            if (arr.length === 1) return '';
                                                            if (arr.length === 2) return arr[1];
                                                            if (arr.length > 2) return arr[arr.length-1];
                                                            return '';
                                                        })(),
                            phone:      profile.phone,
                        }),
                    });
                    if (!res.ok) throw new Error('update profile failed');
                } catch (e) {
                        if (DEBUG_BOOKING) console.warn('[step2] updateProfile API failed:', e.message);
                }
            }
            localStorage.setItem('userProfile', JSON.stringify(profile));
            return { success: true, profile };
        },

        async loadProfile() {
            if (API_BASE) {
                try {
                    const res = await fetch(API_BASE + '/api/profile', { headers: authHeaders() });
                    if (res.ok) {
                        const d = await res.json();
                        const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
                        const phone = d.phone || '';
                        const address = [d.address_line1, d.address_line2]
                            .filter(Boolean)
                            .join(' ')
                            .trim();
                        return { name: name || 'ไม่ทราบชื่อ', phone, address };
                    }
                } catch (e) {
                    if (DEBUG_BOOKING) console.warn('[step2] loadProfile API failed:', e.message);
                }
            }
            // fallback localStorage
            const raw = localStorage.getItem('userProfile');
            if (raw) {
                const saved = JSON.parse(raw);
                return {
                    name: saved.name || 'ไม่ทราบชื่อ',
                    phone: saved.phone || '',
                    address: saved.address || ''
                };
            }
            // fallback auth user
            try {
                const u = JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null');
                if (u) return { name: u.name || 'ไม่ทราบชื่อ', phone: u.phone || '', address: '' };
            } catch (_) {}
            return null;
        }
    };

    // ================================
    // Utility Functions
    // ================================
    function updateWeightLimit(selectElement, limitElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const weight = selectedOption.dataset.weight;

        if (weight) {
            limitElement.textContent = `ไม่เกิน ${weight} ตัน`;
            limitElement.style.display = "block";
        } else {
            limitElement.style.display = "none";
        }
    }

    // ================================
    // Vehicle Management
    // ================================
    function createVehicleCard(vehicleNum) {
        const card = document.createElement("div");
        card.className = "vehicle-card";
        card.id = `vehicle${vehicleNum}`;

        card.innerHTML = `
      <div class="vehicle-header">
        <h3 class="vehicle-title">รถคันที่ ${vehicleNum}</h3>
        <button class="btn-remove-vehicle" onclick="removeVehicle(${vehicleNum})">
          <span class="material-icons-outlined">delete_outline</span>
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">ประเภทรถ</label>
        <div class="select-wrapper">
          <select class="form-select" name="vehicleType${vehicleNum}" required>
                        <option value="">เลือกประเภทรถ</option>
                        <option value="pickup-4" data-weight="9.5">รถกระบะทั่วไป (4 ล้อ)</option>
                        <option value="pickup-cage-4" data-weight="9.5">รถพ่วง/เทรลเลอร์</option>
                        <option value="truck-6" data-weight="15">รถ 6 ล้อ</option>
                        <option value="truck-10" data-weight="25">รถ 10 ล้อ</option>
                        <option value="trailer" data-weight="50.5">รถพ่วง/เทรลเลอร์ (6 เพลา 22 ล้อ)</option>
                        <option value="motorcycle" data-weight="0.5">มอเตอร์ไซค์พ่วงข้าง</option>
                        <option value="other" data-weight="">อื่นๆ</option>
          </select>
          <span class="select-arrow material-icons-outlined">expand_more</span>
        </div>
                <div class="weight-limit" id="weightLimit${vehicleNum}">ไม่เกิน 9.5 ตัน</div>
      </div>

            <div class="form-group">
                <label class="form-label">ข้อมูลป้ายทะเบียน</label>
                <div class="plate-inputs">
                    <div class="plate-group no">
                        <label class="plate-sub-label">เลขทะเบียน</label>
                        <input 
                            type="text" 
                            class="form-input plate-no" 
                            name="plateNo${vehicleNum}" 
                            placeholder="1กข 1234"
                            required
                        >
                    </div>
                    <div class="plate-group prov">
                        <label class="plate-sub-label">จังหวัด</label>
                        <input 
                            type="text" 
                            class="form-input plate-prov" 
                            name="plateProv${vehicleNum}" 
                            placeholder="จังหวัด"
                            required
                        >
                    </div>
                </div>
            </div>
    `;

                // เพิ่ม event listener สำหรับ select
        const select = card.querySelector("select");
        const limitEl = card.querySelector(`#weightLimit${vehicleNum}`);

        select.addEventListener("change", () => {
            updateWeightLimit(select, limitEl);
        });

        return card;
    }

    function addVehicle() {
        if (vehicleCount >= MAX_VEHICLES) {
            window.appNotify(`สามารถเพิ่มรถได้สูงสุด ${MAX_VEHICLES} คัน`, "error");
            return;
        }

        vehicleCount++;
        const newCard = createVehicleCard(vehicleCount);
        additionalVehicles.appendChild(newCard);

        // อัปเดตข้อความปุ่ม
        if (vehicleCount >= MAX_VEHICLES) {
            btnAddVehicle.disabled = true;
            btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">check_circle</span>
                <span>เพิ่มรถครบ ${MAX_VEHICLES} คันแล้ว</span>
      `;
        } else {
            btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">add_circle</span>
                <span>เพิ่มข้อมูลรถคันที่ ${vehicleCount + 1}</span>
      `;
        }

                if (DEBUG_BOOKING) console.log(`เพิ่มรถคันที่ ${vehicleCount}`);
    }

    // Global function for removing vehicle
    window.removeVehicle = function (vehicleNum) {
        const card = document.getElementById(`vehicle${vehicleNum}`);
        if (!card) return;

        const askRemove = (done) => {
            const message = `ต้องการลบข้อมูลรถคันที่ ${vehicleNum} หรือไม่?`;
            if (window.showConfirm) window.showConfirm(message, done);
            else done(false);
        };

        askRemove((accepted) => {
          if (!accepted) return;
            card.remove();
            vehicleCount--;

            // Re-enable add button
            btnAddVehicle.disabled = false;
            btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">add_circle</span>
        <span>เพิ่มข้อมูลรถคันที่ ${vehicleCount + 1}</span>
      `;

            if (DEBUG_BOOKING) console.log(`ลบรถคันที่ ${vehicleNum}`);
        });
    };

    // ================================
    // Profile Modal
    // ================================
    function openModal() {
        // โหลดข้อมูลปัจจุบัน
        editName.value = userProfile.name;
        editPhone.value = userProfile.phone;

        modalOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modalOverlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    function saveProfile() {
        const newName = editName.value.trim();
        const newPhone = editPhone.value.trim();

        if (!newName || !newPhone) {
            window.appNotify("กรุณากรอกข้อมูลให้ครบถ้วน", "error");
            return;
        }

        // บันทึกผ่าน API Layer (รองรับ Database)
        const newProfile = {
            name: newName,
            phone: newPhone,
            address: userProfile.address || ''
        };

        BookingAPI.updateProfile(newProfile)
            .then(() => {
                userProfile = newProfile;

                // อัปเดต UI
                contactName.textContent = newName;
                contactPhone.textContent = newPhone;

                closeModal();
                if (DEBUG_BOOKING) console.log("บันทึกโปรไฟล์:", userProfile);
            })
                .catch(error => {
                console.error("Error saving profile:", error);
                window.appNotify("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
            });
    }

    // ================================
    // Form Validation & Submit
    // ================================
    function getVehicleData() {
        const vehicles = [];

        for (let i = 1; i <= MAX_VEHICLES; i++) {
            const card = document.getElementById(`vehicle${i}`);
            if (!card) continue;

            const typeSelect = card.querySelector(`select[name="vehicleType${i}"]`);
            const plateNoInput = card.querySelector(`input[name="plateNo${i}"]`);
            const plateProvInput = card.querySelector(`input[name="plateProv${i}"]`);

            if (!typeSelect || !plateNoInput || !plateProvInput) continue;

            const type = typeSelect.value;
            const plateNo = plateNoInput.value.trim();
            const plateProv = plateProvInput.value.trim();

            if (!type || !plateNo || !plateProv) {
                throw new Error(`กรุณากรอกข้อมูลรถคันที่ ${i} ให้ครบถ้วน`);
            }

            vehicles.push({
                type: type,
                typeName: vehicleTypes[type]?.name || type,
                weight: vehicleTypes[type]?.weight || "",
                plate: `${plateNo} (${plateProv})`
            });
        }

        if (vehicles.length === 0) {
            throw new Error("กรุณากรอกข้อมูลรถอย่างน้อย 1 คัน");
        }

        return vehicles;
    }

    function submitForm() {
        try {
            // Validate vehicles
            const vehicles = getVehicleData();

            // Validate product amount
            const amount = productAmount.value.trim() ? parseInt(productAmount.value) : null;

            // ถ้ากรอกมา ต้องมากกว่า 0
            if (amount !== null && amount < 1) {
                throw new Error("ปริมาณผลผลิตต้องมากกว่า 0");
            }

            // productAmount อาจเป็น null ได้
            const step2Data = {
                vehicles: vehicles,
                productAmount: amount, // null ถ้าไม่ได้กรอก
                contact: userProfile
            };
            // บันทึกผ่าน API Layer (รองรับ Database)
            BookingAPI.saveStep2(step2Data)
                .then(() => {
                    // รวมข้อมูลจาก step 1
                    const step1Data = JSON.parse(localStorage.getItem("bookingStep1") || "{}");
                    const bookingData = {
                        ...step1Data,
                        ...step2Data
                    };
                    localStorage.setItem("bookingData", JSON.stringify(bookingData));

                    if (DEBUG_BOOKING) console.log("บันทึกข้อมูล Step 2:", step2Data);
                    if (DEBUG_BOOKING) console.log("ข้อมูลรวม:", bookingData);

                    // ไปหน้าถัดไป
                    if (window.navigateWithTransition) window.navigateWithTransition("booking-step3.html"); else window.location.href = "booking-step3.html";
                })
                .catch(error => {
                    console.error("Error saving step 2:", error);
                    window.appNotify("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
                });

        } catch (error) {
            window.appNotify(error.message, "error");
        }
    }

    // ================================
    // Event Listeners
    // ================================
    btnBack?.addEventListener("click", () => {
        if (window.navigateWithTransition) window.navigateWithTransition("booking-step1.html"); else window.location.href = "booking-step1.html";
    });

    btnSubmit?.addEventListener("click", submitForm);

    btnAddVehicle?.addEventListener("click", addVehicle);

    btnEditProfile?.addEventListener("click", openModal);
    btnCloseModal?.addEventListener("click", closeModal);
    btnCancelModal?.addEventListener("click", closeModal);
    btnSaveModal?.addEventListener("click", saveProfile);

    // Close modal on overlay click
    modalOverlay?.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Weight limit for vehicle 1
    const vehicle1Select = document.querySelector('select[name="vehicleType1"]');
    const weightLimit1 = document.getElementById("weightLimit1");

    if (vehicle1Select && weightLimit1) {
        vehicle1Select.addEventListener("change", () => {
            updateWeightLimit(vehicle1Select, weightLimit1);
        });
    }

    // ================================
    // Load Previous Data (ถ้ามี)
    // ================================
    async function loadPreviousData() {
        try {
            // โหลดผ่าน API Layer (รองรับ Database)
            const savedData = await BookingAPI.loadStep2();

            if (savedData) {
                // Restore product amount
                if (savedData.productAmount) {
                    productAmount.value = savedData.productAmount;
                }

                // Restore contact
                if (savedData.contact) {
                    userProfile = savedData.contact;
                    contactName.textContent = userProfile.name;
                    contactPhone.textContent = userProfile.phone;
                }

                // Restore vehicles
                if (savedData.vehicles && savedData.vehicles.length > 0) {
                    // First vehicle
                    const firstVehicle = savedData.vehicles[0];
                    if (firstVehicle) {
                        const select1 = document.querySelector('select[name="vehicleType1"]');
                        const plateNo1 = document.querySelector('input[name="plateNo1"]');
                        const plateProv1 = document.querySelector('input[name="plateProv1"]');

                        if (select1) select1.value = firstVehicle.type;
                        if (firstVehicle.plate) {
                            const [no, prov] = firstVehicle.plate.split(' (').map(s => s.replace(')', '').trim());
                            if (plateNo1) plateNo1.value = no || firstVehicle.plate;
                            if (plateProv1) plateProv1.value = prov || '';
                        }

                        if (select1 && weightLimit1) {
                            updateWeightLimit(select1, weightLimit1);
                        }
                    }

                    // Additional vehicles
                    for (let i = 1; i < savedData.vehicles.length; i++) {
                        addVehicle();

                        const vehicle = savedData.vehicles[i];
                        const vehicleNum = i + 1;

                        setTimeout(() => {
                            const select = document.querySelector(`select[name="vehicleType${vehicleNum}"]`);
                            const plateNo = document.querySelector(`input[name="plateNo${vehicleNum}"]`);
                            const plateProv = document.querySelector(`input[name="plateProv${vehicleNum}"]`);
                            const limit = document.getElementById(`weightLimit${vehicleNum}`);

                            if (select) select.value = vehicle.type;
                            if (vehicle.plate) {
                                const [no, prov] = vehicle.plate.split(' (').map(s => s.replace(')', '').trim());
                                if (plateNo) plateNo.value = no || vehicle.plate;
                                if (plateProv) plateProv.value = prov || '';
                            }
                            if (select && limit) updateWeightLimit(select, limit);
                        }, 100 * i);
                    }
                }

                if (DEBUG_BOOKING) console.log("โหลดข้อมูลเดิม:", savedData);
            }

            // Load user profile
            const savedProfile = await BookingAPI.loadProfile();
            if (savedProfile) {
                userProfile = savedProfile;
                contactName.textContent = userProfile.name;
                contactPhone.textContent = userProfile.phone;
            }

        } catch (error) {
            console.error("Error loading previous data:", error);
        }
    }

    // ================================
    // Initialize
    // ================================
    function init() {
        // อัปเดตชื่อ header จาก localStorage
        const headerTitle = document.getElementById("headerTitle");
        if (headerTitle) {
            const name = localStorage.getItem("bookingFarmerName") || "";
            if (name) headerTitle.textContent = name;
        }

        // ดึง avatar ของ farmer มาแสดงแทนรูปค่าเริ่มต้น
        const productIcon = document.getElementById("productIcon");
        if (productIcon) {
            const farmerId = localStorage.getItem("bookingFarmerId") || "";
            const API_BASE  = (window.API_BASE_URL || "").replace(/\/$/, "");
            const TOKEN_KEY = window.AUTH_TOKEN_KEY || "token";
            const token     = localStorage.getItem(TOKEN_KEY) || "";

            if (farmerId && API_BASE) {
                fetch(API_BASE + "/api/profiles/" + encodeURIComponent(farmerId), {
                    headers: token ? { "Authorization": "Bearer " + token } : {},
                })
                .then(r => r.ok ? r.json() : null)
                .then(profile => {
                    if (profile && profile.avatar) {
                        productIcon.src = profile.avatar;
                        productIcon.alt = profile.first_name || "เกษตรกร";
                    } else {
                        productIcon.style.display = "none";
                        const parent = productIcon.parentElement;
                        if (parent) {
                            const name = (profile && profile.first_name) || headerTitle?.textContent || "?";
                            const fallback = document.createElement("div");
                            fallback.textContent = name.charAt(0).toUpperCase();
                            fallback.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;background:rgba(255,255,255,0.3);border-radius:inherit;";
                            parent.appendChild(fallback);
                        }
                    }
                })
                .catch(() => {});
            }
        }

        loadPreviousData();
    }

    init();
});
