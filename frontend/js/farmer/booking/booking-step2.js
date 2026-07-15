/**
 * AGRIPRICE - Booking Step 2 JavaScript
 * ฟีเจอร์: ฟอร์มรถหลายคัน, แก้ไขโปรไฟล์, บันทึก localStorage
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {

    const DEBUG_BOOKING = !!window.AGRIPRICE_DEBUG;

    // ================================
    // Thai Provinces List for Autocomplete
    // ================================
    const THAI_PROVINCES = [
        "กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "พังงา", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"
    ];

    // ================================
    // Autocomplete for Province Input
    // ================================
    function setupProvinceAutocomplete(input) {
        let currentFocus;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-expanded', 'false');

        const normalize = value => String(value || '')
            .trim()
            .replace(/^จ(?:ังหวัด)?\.?\s*/i, '')
            .replace(/\s+/g, '')
            .toLocaleLowerCase('th-TH');

        function renderSuggestions() {
            const val = input.value;
            const query = normalize(val);
            closeAllLists();
            currentFocus = -1;

            const matches = THAI_PROVINCES
                .map(province => {
                    const normalizedProvince = normalize(province);
                    const matchIndex = normalizedProvince.indexOf(query);
                    return { province, matchIndex };
                })
                .filter(item => !query || item.matchIndex !== -1)
                .sort((a, b) => {
                    // Prefix matches are the strongest prediction, followed by
                    // matches found elsewhere in the province name.
                    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
                    return a.province.localeCompare(b.province, 'th');
                })
                .slice(0, 12);

            if (!matches.length) {
                input.setAttribute('aria-expanded', 'false');
                return;
            }

            const list = document.createElement('div');
            list.setAttribute('class', 'autocomplete-items');
            list.setAttribute('role', 'listbox');
            input.parentNode.appendChild(list);
            input.setAttribute('aria-expanded', 'true');

            matches.forEach(({ province }) => {
                const item = document.createElement('div');
                item.setAttribute('role', 'option');
                item.textContent = province;
                item.addEventListener('pointerdown', event => event.preventDefault());
                item.addEventListener('click', () => {
                    input.value = province;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    closeAllLists();
                });
                list.appendChild(item);
            });
        }

        input.addEventListener('input', renderSuggestions);
        input.addEventListener('focus', renderSuggestions);
        input.addEventListener('keydown', function(e) {
            let x = this.parentNode.querySelector('.autocomplete-items');
            if (x) x = x.getElementsByTagName('div');
            if (e.keyCode === 40) {
                currentFocus++;
                addActive(x);
            } else if (e.keyCode === 38) {
                currentFocus--;
                addActive(x);
            } else if (e.keyCode === 13) {
                e.preventDefault();
                if (currentFocus > -1 && x) x[currentFocus].click();
            }
        });
        function addActive(x) {
            if (!x) return false;
            removeActive(x);
            if (currentFocus >= x.length) currentFocus = 0;
            if (currentFocus < 0) currentFocus = x.length - 1;
            x[currentFocus].classList.add('autocomplete-active');
        }
        function removeActive(x) {
            for (let i = 0; i < x.length; i++) x[i].classList.remove('autocomplete-active');
        }
        function closeAllLists(elmnt) {
            const items = document.querySelectorAll('.autocomplete-items');
            for (let i = 0; i < items.length; i++) {
                if (elmnt !== items[i] && elmnt !== input) items[i].parentNode.removeChild(items[i]);
            }
            if (!input.parentNode.querySelector('.autocomplete-items')) {
                input.setAttribute('aria-expanded', 'false');
            }
        }
        document.addEventListener('click', function (e) { closeAllLists(e.target); });
    }

    function t(key, fallback) {
        if (window.i18nT) return window.i18nT(key, fallback);
        return fallback || key;
    }
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
    const BookingAPI = {
        async saveStep2(data) {
            localStorage.setItem('bookingStep2', JSON.stringify(data));
            return { success: true, data };
        },

        async loadStep2() {
            const data = localStorage.getItem('bookingStep2');
            return data ? JSON.parse(data) : null;
        },

        async updateProfile(profile) {
            if (!window.api) return { success: false };
            try {
                const arr = (profile.name || '').trim().split(' ');
                const payload = {
                    first_name: arr.length > 0 ? arr[0] : '',
                    last_name: arr.length > 1 ? arr.slice(1).join(' ') : '',
                    phone: profile.phone
                };
                await window.api.updateProfile(payload);
            } catch (e) {
                if (DEBUG_BOOKING) console.warn('[step2] updateProfile API failed:', e.message);
            }
            localStorage.setItem('userProfile', JSON.stringify(profile));
            return { success: true, profile };
        },

        async loadProfile() {
            if (!window.api) return null;
            try {
                const d = await window.api.getProfile();
                if (d) {
                    const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
                    const phone = d.phone || '';
                    const address = [d.address_line1, d.address_line2].filter(Boolean).join(' ').trim();
                    return { name: name || t('booking_unknown_name', 'ไม่ทราบชื่อ'), phone, address };
                }
            } catch (e) {
                if (DEBUG_BOOKING) console.warn('[step2] loadProfile API failed:', e.message);
            }
            // fallback
            const raw = localStorage.getItem('userProfile');
            if (raw) return JSON.parse(raw);
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
            limitElement.textContent = t('not_exceed_n_tons', 'ไม่เกิน {n} ตัน').replace('{n}', weight);
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
        <h3 class="vehicle-title" data-i18n="vehicle_no" data-i18n-n="${vehicleNum}">${t('vehicle_no', 'รถคันที่ {n}').replace('{n}', vehicleNum)}</h3>
        <button class="btn-remove-vehicle" onclick="removeVehicle(${vehicleNum})">
          <span class="material-icons-outlined">delete_outline</span>
        </button>
      </div>

      <div class="form-group">
        <label class="form-label" data-i18n="vehicle_type">${t('vehicle_type', 'ประเภทรถ')}</label>
        <div class="select-wrapper">
          <select class="form-select" name="vehicleType${vehicleNum}" required>
                        <option value="" data-i18n="select_vehicle_type">${t('select_vehicle_type', 'เลือกประเภทรถ')}</option>
                        <option value="pickup-4" data-weight="9.5" data-i18n="pickup_4">${t('pickup_4', 'รถกระบะทั่วไป (4 ล้อ)')}</option>
                        <option value="pickup-cage-4" data-weight="9.5" data-i18n="pickup_cage_4">${t('pickup_cage_4', 'รถพ่วง/เทรลเลอร์')}</option>
                        <option value="truck-6" data-weight="15" data-i18n="truck_6">${t('truck_6', 'รถ 6 ล้อ')}</option>
                        <option value="truck-10" data-weight="25" data-i18n="truck_10">${t('truck_10', 'รถ 10 ล้อ')}</option>
                        <option value="trailer" data-weight="50.5" data-i18n="trailer_large">${t('trailer_large', 'รถพ่วง/เทรลเลอร์ (6 เพลา 22 ล้อ)')}</option>
                        <option value="motorcycle" data-weight="0.5" data-i18n="motorcycle_sidecar">${t('motorcycle_sidecar', 'มอเตอร์ไซค์พ่วงข้าง')}</option>
                        <option value="other" data-weight="" data-i18n="other_vehicle">${t('other_vehicle', 'อื่นๆ')}</option>
          </select>
          <span class="select-arrow material-icons-outlined">expand_more</span>
        </div>
                <div class="weight-limit" id="weightLimit${vehicleNum}" data-i18n="not_exceed_n_tons" data-i18n-n="9.5">${t('not_exceed_n_tons', 'ไม่เกิน {n} ตัน').replace('{n}', '9.5')}</div>
      </div>

            <div class="form-group">
                <label class="form-label" data-i18n="license_plate_info">${t('license_plate_info', 'ข้อมูลป้ายทะเบียน')}</label>
                <div class="plate-inputs">
                    <div class="plate-group no">
                        <label class="plate-sub-label" data-i18n="license_plate_no">${t('license_plate_no', 'เลขทะเบียน')}</label>
                        <input 
                            type="text" 
                            class="form-input plate-no" 
                            name="plateNo${vehicleNum}" 
                            placeholder="1กข 1234"
                            data-i18n-placeholder="plate_placeholder"
                            required
                        >
                    </div>
                    <div class="plate-group prov">
                        <label class="plate-sub-label" data-i18n="province">${t('province', 'จังหวัด')}</label>
                        <input 
                            type="text" 
                            class="form-input plate-prov" 
                            name="plateProv${vehicleNum}" 
                            placeholder="${t('province', 'จังหวัด')}"
                            data-i18n-placeholder="province_placeholder"
                            required
                            autocomplete="off"
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

        // Setup autocomplete for province input
        const provInput = card.querySelector('.plate-prov');
        if (provInput) setupProvinceAutocomplete(provInput);
        return card;
    }

    function addVehicle() {
        if (vehicleCount >= MAX_VEHICLES) {
            window.appNotify(t('max_vehicle_alert', `สามารถเพิ่มรถได้สูงสุด ${MAX_VEHICLES} คัน`).replace('{n}', MAX_VEHICLES), "error");
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
                <span data-i18n="added_all_vehicles" data-i18n-n="${MAX_VEHICLES}">${t('added_all_vehicles', `เพิ่มรถครบ ${MAX_VEHICLES} คันแล้ว`).replace('{n}', MAX_VEHICLES)}</span>
      `;
        } else {
            btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">add_circle</span>
                <span data-i18n="add_vehicle_no" data-i18n-n="${vehicleCount + 1}">${t('add_vehicle_no', `เพิ่มข้อมูลรถคันที่ ${vehicleCount + 1}`).replace('{n}', vehicleCount + 1)}</span>
      `;
        }

                if (DEBUG_BOOKING) console.log(`เพิ่มรถคันที่ ${vehicleCount}`);
    }

    // Global function for removing vehicle
    window.removeVehicle = function (vehicleNum) {
        const card = document.getElementById(`vehicle${vehicleNum}`);
        if (!card) return;

        const askRemove = (done) => {
            const message = t('confirm_remove_vehicle', `ต้องการลบข้อมูลรถคันที่ ${vehicleNum} หรือไม่?`).replace('{n}', vehicleNum);
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
        <span data-i18n="add_vehicle_no" data-i18n-n="${vehicleCount + 1}">${t('add_vehicle_no', `เพิ่มข้อมูลรถคันที่ ${vehicleCount + 1}`).replace('{n}', vehicleCount + 1)}</span>
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
            window.appNotify(t('fill_all_fields', "กรุณากรอกข้อมูลให้ครบถ้วน"), "error");
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
                window.appNotify(t('error_occurred', "เกิดข้อผิดพลาดในการบันทึกข้อมูล"), "error");
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
                throw new Error(t('fill_vehicle_info_complete', `กรุณากรอกข้อมูลรถคันที่ ${i} ให้ครบถ้วน`).replace('{n}', i));
            }

            vehicles.push({
                type: type,
                typeName: vehicleTypes[type]?.name || type,
                weight: vehicleTypes[type]?.weight || "",
                plate: `${plateNo} (${plateProv})`
            });
        }

        if (vehicles.length === 0) {
            throw new Error(t('at_least_one_vehicle', "กรุณากรอกข้อมูลรถอย่างน้อย 1 คัน"));
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
                throw new Error(t('amount_must_be_positive', "ปริมาณผลผลิตต้องมากกว่า 0"));
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
                    window.appNotify(t('error_occurred', "เกิดข้อผิดพลาดในการบันทึกข้อมูล"), "error");
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
    // Province autocomplete for vehicle 1
    const plateProv1 = document.querySelector('input[name="plateProv1"]');
    if (plateProv1) setupProvinceAutocomplete(plateProv1);

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
            const currentBase = window.api ? window.api.getBase() : "";

            // [FIX] เพิ่มตัวตรวจจับรูปเสีย
            productIcon.onerror = function() {
                if (this.dataset.fallbackApplied) return;
                this.dataset.fallbackApplied = "true";
                this.style.display = "none";
                const name = headerTitle?.textContent || "P";
                const parent = this.parentElement;
                if (parent) {
                    const fallback = document.createElement("div");
                    fallback.textContent = name.trim().charAt(0).toUpperCase();
                    fallback.style.cssText = "width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#fff;background:linear-gradient(135deg, #0B853C, #22c55e);border-radius:inherit;";
                    parent.appendChild(fallback);
                }
            };

            if (farmerId && window.api) {
                window.api.getProfileById(farmerId)
                .then(profile => {
                    if (profile && profile.avatar) {
                        let avatarUrl = profile.avatar;
                        if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
                            avatarUrl = currentBase + (avatarUrl.startsWith('/') ? '' : '/') + avatarUrl;
                        }
                        productIcon.src = avatarUrl;
                        productIcon.alt = profile.first_name || t('farmer', 'เกษตรกร');
                    } else {
                        productIcon.onerror(); 
                    }
                })
                .catch(() => {
                    productIcon.onerror();
                });
            }
        }
        
        const style = document.createElement('style');
        style.innerHTML = `.container-form { max-width: 100%; padding: 0 28px; margin: 0 auto; }`;
        document.head.appendChild(style);

        loadPreviousData();
    }

    init();
});
