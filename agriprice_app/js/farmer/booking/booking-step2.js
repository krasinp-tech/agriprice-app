/**
 * AGRIPRICE - Booking Step 2 JavaScript
 * ฟีเจอร์: ฟอร์มรถหลายคัน, แก้ไขโปรไฟล์, บันทึก localStorage
 * รองรับ: Desktop, Tablet, Mobile
 */

document.addEventListener("DOMContentLoaded", () => {
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

    const bookingStep1Data = getBookingStep1Data();
    const selectedTimeSlot = bookingStep1Data.timeSlot || null;
    const slotQueueAvailable = Number(selectedTimeSlot?.available);
    const maxVehiclesByQueue = Number.isFinite(slotQueueAvailable) && slotQueueAvailable > 0
        ? Math.max(1, Math.min(MAX_VEHICLES, Math.floor(slotQueueAvailable)))
        : MAX_VEHICLES;

    // 🔵 MOCK DATA - รองรับ Database ในอนาคต
    // TODO: Replace with API calls
    let userProfile = {
        name: "สมชาย เกษตรกร",
        phone: "081-234-5678"
    };

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
    // 🔵 DATABASE-READY API LAYER
    // ================================
    const BookingAPI = {
        // TODO: Replace with actual API endpoints

        /**
         * บันทึกข้อมูล Step 2 ไปยัง Database
         * @param {Object} data - ข้อมูล vehicles, productAmount, contact
         * @returns {Promise<Object>} - Response from server
         */
        async saveStep2(data) {
            // TODO: Uncomment when backend is ready
            /*
            const response = await fetch('/api/booking/step2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            return await response.json();
            */

            // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
            localStorage.setItem("bookingStep2", JSON.stringify(data));
            return { success: true, data };
        },

        /**
         * โหลดข้อมูล Step 2 จาก Database
         * @returns {Promise<Object>} - ข้อมูลที่บันทึกไว้
         */
        async loadStep2() {
            // TODO: Uncomment when backend is ready
            /*
            const response = await fetch('/api/booking/step2');
            return await response.json();
            */

            // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
            const data = localStorage.getItem("bookingStep2");
            return data ? JSON.parse(data) : null;
        },

        /**
         * อัปเดตโปรไฟล์ผู้ใช้
         * @param {Object} profile - { name, phone }
         * @returns {Promise<Object>}
         */
        async updateProfile(profile) {
            // TODO: Uncomment when backend is ready
            /*
            const response = await fetch('/api/user/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profile)
            });
            return await response.json();
            */

            // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
            localStorage.setItem("userProfile", JSON.stringify(profile));
            return { success: true, profile };
        },

        /**
         * โหลดโปรไฟล์ผู้ใช้
         * @returns {Promise<Object>}
         */
        async loadProfile() {
            // TODO: Uncomment when backend is ready
            /*
            const response = await fetch('/api/user/profile');
            return await response.json();
            */

            // 🔵 MOCK: ใช้ localStorage แทนตอนนี้
            const data = localStorage.getItem("userProfile");
            return data ? JSON.parse(data) : null;
        }
    };

    // ================================
    // Utility Functions
    // ================================
    function getBookingStep1Data() {
        try {
            return JSON.parse(localStorage.getItem("bookingStep1") || "{}");
        } catch (error) {
            console.error("Error parsing bookingStep1:", error);
            return {};
        }
    }

    function getQueueLimitAlertMessage() {
        if (maxVehiclesByQueue >= MAX_VEHICLES) {
            return `สามารถเพิ่มรถได้สูงสุด ${MAX_VEHICLES} คัน`;
        }

        const slotLabel = selectedTimeSlot?.time ? `ช่วงเวลา ${selectedTimeSlot.time}` : "ช่วงเวลาที่เลือก";
        return `${slotLabel} เหลือ ${maxVehiclesByQueue} คิว จึงเพิ่มข้อมูลรถได้สูงสุด ${maxVehiclesByQueue} คัน`;
    }

    function updateAddVehicleButtonState() {
        if (!btnAddVehicle) return;

        if (vehicleCount >= maxVehiclesByQueue) {
            btnAddVehicle.disabled = true;

            if (maxVehiclesByQueue < MAX_VEHICLES) {
                btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">check_circle</span>
        <span>ครบตามคิวช่วงเวลา ${maxVehiclesByQueue} คันแล้ว</span>
      `;
            } else {
                btnAddVehicle.innerHTML = `
        <span class="material-icons-outlined">check_circle</span>
        <span>เพิ่มรถครบ ${MAX_VEHICLES} คันแล้ว</span>
      `;
            }

            return;
        }

        btnAddVehicle.disabled = false;
        btnAddVehicle.innerHTML = `
      <span class="material-icons-outlined">add_circle</span>
      <span>เพิ่มข้อมูลรถคันที่ ${vehicleCount + 1}</span>
    `;
    }

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
        <label class="form-label">ป้ายทะเบียน</label>
        <input 
          type="text" 
          class="form-input" 
          name="licensePlate${vehicleNum}" 
          placeholder="เช่น กข 1234 กรุงเทพ"
          required
        >
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

    function addVehicle(options = {}) {
        const { silent = false } = options;

        if (vehicleCount >= maxVehiclesByQueue) {
            if (!silent) {
                alert(getQueueLimitAlertMessage());
            }

            updateAddVehicleButtonState();
            return false;
        }

        vehicleCount++;
        const newCard = createVehicleCard(vehicleCount);
        additionalVehicles.appendChild(newCard);

        updateAddVehicleButtonState();

        console.log(`✅ เพิ่มรถคันที่ ${vehicleCount}`);
        return true;
    }

    // Global function for removing vehicle
    window.removeVehicle = function (vehicleNum) {
        const card = document.getElementById(`vehicle${vehicleNum}`);
        if (!card) return;

        card.remove();
        vehicleCount--;

        updateAddVehicleButtonState();

        console.log(`🗑️ ลบรถคันที่ ${vehicleNum}`);
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
            alert("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        // 🔵 บันทึกผ่าน API Layer (รองรับ Database)
        const newProfile = {
            name: newName,
            phone: newPhone
        };

        BookingAPI.updateProfile(newProfile)
            .then(() => {
                userProfile = newProfile;

                // อัปเดต UI
                contactName.textContent = newName;
                contactPhone.textContent = newPhone;

                closeModal();
                console.log("✅ บันทึกโปรไฟล์:", userProfile);
            })
            .catch(error => {
                console.error("Error saving profile:", error);
                alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
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
            const plateInput = card.querySelector(`input[name="licensePlate${i}"]`);

            if (!typeSelect || !plateInput) continue;

            const type = typeSelect.value;
            const plate = plateInput.value.trim();

            if (!type || !plate) {
                throw new Error(`กรุณากรอกข้อมูลรถคันที่ ${i} ให้ครบถ้วน`);
            }

            vehicles.push({
                vehicleNumber: i,
                type: type,
                typeName: vehicleTypes[type]?.name || type,
                weight: vehicleTypes[type]?.weight || "",
                licensePlate: plate
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

            if (vehicles.length > maxVehiclesByQueue) {
                throw new Error(getQueueLimitAlertMessage());
            }

            // Validate product amount
            const amount = productAmount.value.trim() ? parseInt(productAmount.value) : null;

            // ถ้ากรอกมา ต้องมากกว่า 0
            if (amount !== null && amount < 1) {
                throw new Error("ปริมาณผลผลิตต้องมากกว่า 0");
            }

            // productAmount อาจเป็น null ได้
            const step2Data = {
                vehicles: vehicles,
                productAmount: amount, // null ถ้าไม่กรอก
                contact: userProfile
            };
            // 🔵 บันทึกผ่าน API Layer (รองรับ Database)
            BookingAPI.saveStep2(step2Data)
                .then(() => {
                    // รวมข้อมูลจาก step 1
                    const step1Data = JSON.parse(localStorage.getItem("bookingStep1") || "{}");
                    const bookingData = {
                        ...step1Data,
                        ...step2Data
                    };
                    localStorage.setItem("bookingData", JSON.stringify(bookingData));

                    console.log("✅ บันทึกข้อมูล Step 2:", step2Data);
                    console.log("📦 ข้อมูลรวม:", bookingData);

                    // ไปหน้าถัดไป
                    window.location.href = "booking-step3.html";
                })
                .catch(error => {
                    console.error("Error saving step 2:", error);
                    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
                });

        } catch (error) {
            alert(error.message);
        }
    }

    // ================================
    // Event Listeners
    // ================================
    btnBack?.addEventListener("click", () => {
        window.location.href = "booking-step1.html";
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
            // 🔵 โหลดผ่าน API Layer (รองรับ Database)
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
                    const vehiclesToRestore = savedData.vehicles.slice(0, maxVehiclesByQueue);

                    // First vehicle
                    const firstVehicle = vehiclesToRestore[0];
                    if (firstVehicle) {
                        const select1 = document.querySelector('select[name="vehicleType1"]');
                        const plate1 = document.querySelector('input[name="licensePlate1"]');

                        if (select1) select1.value = firstVehicle.type;
                        if (plate1) plate1.value = firstVehicle.licensePlate;

                        if (select1 && weightLimit1) {
                            updateWeightLimit(select1, weightLimit1);
                        }
                    }

                    // Additional vehicles
                    for (let i = 1; i < vehiclesToRestore.length; i++) {
                        const added = addVehicle({ silent: true });
                        if (!added) break;

                        const vehicle = vehiclesToRestore[i];
                        const vehicleNum = i + 1;

                        setTimeout(() => {
                            const select = document.querySelector(`select[name="vehicleType${vehicleNum}"]`);
                            const plate = document.querySelector(`input[name="licensePlate${vehicleNum}"]`);
                            const limit = document.getElementById(`weightLimit${vehicleNum}`);

                            if (select) select.value = vehicle.type;
                            if (plate) plate.value = vehicle.licensePlate;
                            if (select && limit) updateWeightLimit(select, limit);
                        }, 100 * i);
                    }

                    if (savedData.vehicles.length > vehiclesToRestore.length) {
                        console.warn(getQueueLimitAlertMessage());
                    }
                }

                console.log("📥 โหลดข้อมูลเดิม:", savedData);
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
        } finally {
            updateAddVehicleButtonState();
        }
    }

    // ================================
    // Initialize
    // ================================
    async function init() {
        updateAddVehicleButtonState();
        await loadPreviousData();
        console.log("🚀 Booking Step 2 initialized");
    }

    init();
});