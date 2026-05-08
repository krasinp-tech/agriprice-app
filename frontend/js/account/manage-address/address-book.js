document.addEventListener('DOMContentLoaded', () => {
    const addressList = document.getElementById('addressList');
    const emptyState = document.getElementById('emptyState');
    const addAddressBtn = document.getElementById('addAddressBtn');

    const _API = (window.API_BASE_URL || '').replace(/\/$/, '');
    const _TKEY = window.AUTH_TOKEN_KEY || 'token';
    const _aH = () => { const t = localStorage.getItem(_TKEY) || ''; return t ? { 'Authorization': 'Bearer ' + t } : {}; };

    // ── Function to render addresses ──
    async function loadAddresses() {
        try {
            // 1. Show skeletons (already in HTML)
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

            const data = result.success ? result.data : [];

            if (data && data.length > 0) {
                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'address-card fade-slide';
                    const icon = item.tag === 'Work' ? 'work_outline' : 'home';
                    const tagLabel = item.tag === 'Work' ? (window.i18nT ? window.i18nT('work_tag', 'ที่ทำงาน') : 'ที่ทำงาน') : (window.i18nT ? window.i18nT('home_tag', 'บ้าน') : 'บ้าน');
                    
                    card.innerHTML = `
                        <div class="address-icon"><span class="material-icons-outlined">${icon}</span></div>
                        <div class="address-info">
                            <span class="address-tag">${tagLabel}</span>
                            <h3 class="address-name">${item.first_name} ${item.last_name}</h3>
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
                try {
                    const res = await fetch(`${_API}/api/addresses/${addrId}`, { 
                        method: 'DELETE',
                        headers: _aH() 
                    });
                    const result = await res.json();

                    if (result.success) {
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
                    }
                } catch (err) {
                    console.error('Delete error:', err);
                }
            }
        }

        if (editBtn) {
             console.log('Edit clicked for ID:', editBtn.dataset.id);
        }
    });

    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', () => {
            console.log('Add address clicked');
        });
    }

    // Initial Load
    loadAddresses();
});