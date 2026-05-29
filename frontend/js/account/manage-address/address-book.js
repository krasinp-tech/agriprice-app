document.addEventListener('DOMContentLoaded', () => {
    const addressList = document.getElementById('addressList');
    const emptyState = document.getElementById('emptyState');
    const addAddressBtn = document.getElementById('addAddressBtn');

    // Modal elements
    const addressModal = document.getElementById('addressModal');
    const modalOverlay = document.getElementById('modalOverlay');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const addressForm = document.getElementById('addressForm');
    const modalTitle = document.getElementById('modalTitle');

    // Form inputs
    const addressIdInput = document.getElementById('addressId');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const phoneInput = document.getElementById('phone');
    const addressLine1Input = document.getElementById('addressLine1');
    const addressLine2Input = document.getElementById('addressLine2');
    const isDefaultInput = document.getElementById('isDefault');
    const tagBtns = document.querySelectorAll('.tag-btn');

    let selectedTag = 'Home';
    let loadedAddresses = [];

    const _API = (window.API_BASE_URL || '').replace(/\/$/, '');
    const _TKEY = window.AUTH_TOKEN_KEY || 'token';
    const _aH = () => { const t = localStorage.getItem(_TKEY) || ''; return t ? { 'Authorization': 'Bearer ' + t } : {}; };

    // ── Tag Selection Handler ──
    tagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tagBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTag = btn.dataset.tag;
        });
    });

    // ── Modal Actions ──
    function openModal(mode = 'add', addressData = null) {
        if (mode === 'edit' && addressData) {
            modalTitle.textContent = window.i18nT ? window.i18nT('edit_address', 'แก้ไขที่อยู่') : 'แก้ไขที่อยู่';
            addressIdInput.value = addressData.id;
            firstNameInput.value = addressData.first_name || '';
            lastNameInput.value = addressData.last_name || '';
            phoneInput.value = addressData.phone || '';
            addressLine1Input.value = addressData.address_line1 || '';
            addressLine2Input.value = addressData.address_line2 || '';
            isDefaultInput.checked = !!addressData.is_default;

            // Set tag
            selectedTag = addressData.tag || 'Home';
            tagBtns.forEach(b => {
                if (b.dataset.tag.toLowerCase() === selectedTag.toLowerCase()) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        } else {
            modalTitle.textContent = window.i18nT ? window.i18nT('add_new_address', 'เพิ่มที่อยู่ใหม่') : 'เพิ่มที่อยู่ใหม่';
            addressIdInput.value = '';
            addressForm.reset();
            isDefaultInput.checked = false;

            // Reset tag to Home
            selectedTag = 'Home';
            tagBtns.forEach(b => {
                if (b.dataset.tag === 'Home') {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
        }

        addressModal.classList.add('show');
    }

    function closeModal() {
        addressModal.classList.remove('show');
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

    // ── Function to render addresses ──
    async function loadAddresses() {
        try {
            // 1. Show skeletons
            if (addressList) addressList.innerHTML = `
                <div class="shimmer" style="height: 120px; border-radius: 20px; margin-bottom: 12px;"></div>
                <div class="shimmer" style="height: 120px; border-radius: 20px; margin-bottom: 12px;"></div>
            `;

            // 2. Fetch from API
            const fetchUrl = `${_API}/api/addresses`;
            console.log('[Address] Fetching from:', fetchUrl);
            const res = await fetch(fetchUrl, { headers: _aH() });
            const result = await res.json();
            
            // 3. Clear skeletons
            if (addressList) addressList.innerHTML = '';

            loadedAddresses = result.success ? result.data : [];

            if (loadedAddresses && loadedAddresses.length > 0) {
                loadedAddresses.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'address-card fade-slide show';
                    
                    const isWork = item.tag && item.tag.toLowerCase() === 'work';
                    const icon = isWork ? 'work_outline' : (item.tag && item.tag.toLowerCase() === 'home' ? 'home' : 'place');
                    
                    const tagLabel = isWork 
                        ? (window.i18nT ? window.i18nT('work_tag', 'ที่ทำงาน') : 'ที่ทำงาน') 
                        : (item.tag && item.tag.toLowerCase() === 'home' 
                            ? (window.i18nT ? window.i18nT('home_tag', 'บ้าน') : 'บ้าน')
                            : (item.tag || 'อื่นๆ'));
                    
                    const defaultBadge = item.is_default 
                        ? `<span class="address-tag default" style="background:#e8f5e9; color:var(--primary); margin-left:8px; border: 1px solid var(--primary);">${window.i18nT ? window.i18nT('default_address', 'เริ่มต้น') : 'เริ่มต้น'}</span>` 
                        : '';
                    
                    card.innerHTML = `
                        <div class="address-icon"><span class="material-icons-outlined">${icon}</span></div>
                        <div class="address-info">
                            <div style="display:flex; align-items:center;">
                                <span class="address-tag">${tagLabel}</span>
                                ${defaultBadge}
                            </div>
                            <h3 class="address-name" style="margin-top: 4px;">${item.first_name} ${item.last_name}</h3>
                            <p class="address-detail">
                                ${item.address_line1} ${item.address_line2 || ''}
                                <br>${window.i18nT ? window.i18nT('phone_abbr', 'โทร') : 'โทร'}: ${item.phone}
                            </p>
                            <div class="address-actions">
                                <button class="btn-action edit-btn" data-id="${item.id}">${window.i18nT ? window.i18nT('edit', 'แก้ไข') : 'แก้ไข'}</button>
                                <button class="btn-action delete" data-id="${item.id}">${window.i18nT ? window.i18nT('delete', 'ลบ') : 'ลบ'}</button>
                            </div>
                        </div>
                    `;
                    addressList.appendChild(card);
                });
                addressList.style.display = 'flex';
                emptyState.style.display = 'none';
            } else {
                if (addressList) addressList.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
            if (addressList) addressList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        }
    }

    // ── Handle Actions (Delete/Edit) ─────────────────────────────
    addressList?.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete');
        const editBtn = e.target.closest('.edit-btn');

        if (deleteBtn) {
            const addrId = deleteBtn.dataset.id;
            const card = deleteBtn.closest('.address-card');
            const confirmMsg = window.i18nT ? window.i18nT('confirm_delete_address', 'คุณต้องการลบที่อยู่นี้ใช่หรือไม่?') : 'คุณต้องการลบที่อยู่นี้ใช่หรือไม่?';
            
            if (card && confirm(confirmMsg)) {
                if (window.showLoading) window.showLoading(true);
                try {
                    const res = await fetch(`${_API}/api/addresses/${addrId}`, { 
                        method: 'DELETE',
                        headers: _aH() 
                    });
                    const result = await res.json();

                    if (result.success) {
                        if (window.showAlert) window.showAlert(window.i18nT ? window.i18nT('delete_success', 'ลบที่อยู่สำเร็จ') : 'ลบที่อยู่สำเร็จ', 'success');
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(20px)';
                        setTimeout(() => {
                            card.remove();
                            if (addressList.querySelectorAll('.address-card').length === 0) {
                                addressList.style.display = 'none';
                                emptyState.style.display = 'block';
                            }
                        }, 300);
                    } else {
                        console.error('Error deleting address:', result.message);
                        if (window.showAlert) window.showAlert(result.message || 'เกิดข้อผิดพลาด', 'error');
                    }
                } catch (err) {
                    console.error('Delete error:', err);
                    if (window.showAlert) window.showAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
                } finally {
                    if (window.showLoading) window.showLoading(false);
                }
            }
        }

        if (editBtn) {
            const addrId = editBtn.dataset.id;
            const addressData = loadedAddresses.find(item => String(item.id) === String(addrId));
            if (addressData) {
                openModal('edit', addressData);
            }
        }
    });

    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', () => {
            openModal('add');
        });
    }

    // ── Form Submission Handler ──
    if (addressForm) {
        addressForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const addrId = addressIdInput.value;
            const firstName = firstNameInput.value.trim();
            const lastName = lastNameInput.value.trim();
            const phone = phoneInput.value.trim();
            const addressLine1 = addressLine1Input.value.trim();
            const addressLine2 = addressLine2Input.value.trim();
            const isDefault = isDefaultInput.checked;

            if (!firstName || !lastName || !phone || !addressLine1) {
                if (window.showAlert) window.showAlert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
                return;
            }

            const bodyData = {
                tag: selectedTag,
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                address_line1: addressLine1,
                address_line2: addressLine2,
                is_default: isDefault
            };

            if (window.showLoading) window.showLoading(true);

            try {
                const method = addrId ? 'PUT' : 'POST';
                const endpoint = addrId ? `${_API}/api/addresses/${addrId}` : `${_API}/api/addresses`;

                const res = await fetch(endpoint, {
                    method: method,
                    headers: {
                        ..._aH(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bodyData)
                });

                const result = await res.json();

                if (result.success) {
                    const msg = addrId 
                        ? (window.i18nT ? window.i18nT('update_success', 'อัปเดตที่อยู่สำเร็จ') : 'อัปเดตที่อยู่สำเร็จ')
                        : (window.i18nT ? window.i18nT('add_success', 'เพิ่มที่อยู่สำเร็จ') : 'เพิ่มที่อยู่สำเร็จ');
                    
                    if (window.showAlert) window.showAlert(msg, 'success');
                    closeModal();
                    await loadAddresses();
                } else {
                    console.error('Error saving address:', result.message);
                    if (window.showAlert) window.showAlert(result.message || 'เกิดข้อผิดพลาด', 'error');
                }
            } catch (err) {
                console.error('Save address error:', err);
                if (window.showAlert) window.showAlert('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
            } finally {
                if (window.showLoading) window.showLoading(false);
            }
        });
    }

    // Initial Load
    loadAddresses();
});