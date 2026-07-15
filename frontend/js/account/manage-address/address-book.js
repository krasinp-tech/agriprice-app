(function () {
  "use strict";

  const api = window.api || {};

  let currentEditId = null;
  let currentTag = 'Home';
  let geographyData = null;
  let geographyLoadPromise = null;

  // ── Element refs ──────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function getAuthHeader() {
    const token = api.getToken ? api.getToken() : localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  function getBase() {
    return window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
  }

  function loadGeography() {
    if (geographyData) return Promise.resolve(geographyData);
    if (!geographyLoadPromise) {
      geographyLoadPromise = fetch('../../../assets/data/thai-geography.json')
        .then(response => {
          if (!response.ok) throw new Error('Unable to load Thai geography data');
          return response.json();
        })
        .then(data => (geographyData = Array.isArray(data) ? data : []))
        .catch(error => {
          geographyLoadPromise = null;
          console.error('[AddressBook] Geography load failed:', error);
          return [];
        });
    }
    return geographyLoadPromise;
  }

  function setupAddressAutocomplete(input) {
    if (!input) return;
    let activeIndex = -1;

    const normalize = value => String(value || '')
      .toLocaleLowerCase('th-TH')
      .replace(/(ตำบล|ต\.|แขวง|อำเภอ|อ\.|เขต|จังหวัด|จ\.)/g, '')
      .replace(/\s+/g, '')
      .trim();

    const closeSuggestions = () => {
      input.parentElement.querySelector('.address-suggestions')?.remove();
      input.setAttribute('aria-expanded', 'false');
      activeIndex = -1;
    };

    const selectSuggestion = row => {
      const subdistrictPrefix = row.provinceCode === 10 ? 'แขวง' : 'ตำบล';
      const districtPrefix = row.provinceCode === 10 ? 'เขต' : 'อำเภอ';
      input.value = `${subdistrictPrefix}${row.subdistrictNameTh} ${districtPrefix}${row.districtNameTh} จังหวัด${row.provinceNameTh} ${row.postalCode}`;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      closeSuggestions();
    };

    const renderSuggestions = async () => {
      const query = normalize(input.value);
      closeSuggestions();
      if (!query) return;

      const data = await loadGeography();
      if (normalize(input.value) !== query) return;

      const matches = data.map(row => {
        const fields = [
          normalize(row.subdistrictNameTh),
          normalize(row.districtNameTh),
          normalize(row.provinceNameTh),
          String(row.postalCode || '')
        ];
        const exactField = fields.findIndex(value => value === query);
        const prefixField = fields.findIndex(value => value.startsWith(query));
        const combined = fields.join('');
        const score = exactField >= 0 ? exactField : (prefixField >= 0 ? 10 + prefixField : (combined.includes(query) ? 30 : 999));
        return { row, score };
      })
        .filter(item => item.score < 999)
        .sort((a, b) => a.score - b.score || a.row.subdistrictNameTh.localeCompare(b.row.subdistrictNameTh, 'th'))
        .slice(0, 20);

      if (!matches.length) return;
      const list = document.createElement('div');
      list.className = 'address-suggestions';
      list.setAttribute('role', 'listbox');

      matches.forEach(({ row }) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'address-suggestion-item';
        option.setAttribute('role', 'option');

        const main = document.createElement('strong');
        main.textContent = `${row.subdistrictNameTh}, ${row.districtNameTh}`;
        const detail = document.createElement('small');
        detail.textContent = `${row.provinceNameTh} · ${row.postalCode}`;
        option.append(main, detail);
        option.addEventListener('click', () => selectSuggestion(row));
        list.appendChild(option);
      });

      input.parentElement.appendChild(list);
      input.setAttribute('aria-expanded', 'true');
    };

    input.addEventListener('focus', loadGeography);
    input.addEventListener('input', renderSuggestions);
    input.addEventListener('keydown', event => {
      const options = [...input.parentElement.querySelectorAll('.address-suggestion-item')];
      if (!options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = event.key === 'ArrowDown'
          ? (activeIndex + 1) % options.length
          : (activeIndex - 1 + options.length) % options.length;
        options.forEach((option, index) => option.classList.toggle('active', index === activeIndex));
        options[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        options[activeIndex].click();
      } else if (event.key === 'Escape') {
        closeSuggestions();
      }
    });
    document.addEventListener('click', event => {
      if (!input.parentElement.contains(event.target)) closeSuggestions();
    });
  }

  // ── Toast helper ──────────────────────────────────────
  function toast(msg, type = 'success') {
    if (window.showToast) return window.showToast(msg, type);
    if (window.AGRIPRICE_DEBUG) console.log('[AddressBook]', msg);
  }

  // ── Modal helpers ─────────────────────────────────────
  function openModal(isEdit = false, addr = null) {
    currentEditId = isEdit && addr ? (addr.id || null) : null;

    // Title
    $('addrModalTitle').textContent = isEdit ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่';

    // Reset or fill values
    if (isEdit && addr) {
      $('addrFirstName').value = addr.first_name || '';
      $('addrLastName').value  = addr.last_name  || '';
      $('addrPhone').value     = addr.phone       || '';
      $('addrLine1').value     = addr.address_line1 || '';
      $('addrLine2').value     = addr.address_line2 || '';
      $('addrIsDefault').checked = !!addr.is_default;
      selectTag(addr.tag || 'Home');
    } else {
      $('addrFirstName').value = '';
      $('addrLastName').value  = '';
      $('addrPhone').value     = '';
      $('addrLine1').value     = '';
      $('addrLine2').value     = '';
      $('addrIsDefault').checked = false;
      selectTag('Home');
    }

    $('addrModalBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('addrFirstName').focus(), 350);
  }

  function closeModal() {
    $('addrModalBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    currentEditId = null;
  }

  function selectTag(tag) {
    currentTag = tag;
    document.querySelectorAll('.tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tag === tag);
    });
  }

  // ── Load & render addresses ───────────────────────────
  async function loadAddresses() {
    const list      = $('addressList');
    const empty     = $('emptyState');

    if (!list) return;
    list.innerHTML = `
      <div class="shimmer" style="height:130px;border-radius:20px;margin-bottom:12px;"></div>
      <div class="shimmer" style="height:130px;border-radius:20px;"></div>`;
    if (empty) empty.style.display = 'none';

    try {
      let data = [];
      if (api.getAddresses) {
        const res = await api.getAddresses();
        data = Array.isArray(res) ? res : (res?.data || []);
      } else {
        const res = await fetch(getBase() + '/api/addresses', { headers: getAuthHeader() });
        const json = await res.json();
        data = Array.isArray(json) ? json : (json?.data || []);
      }

      list.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
      }

      data.forEach(addr => list.appendChild(buildCard(addr)));
    } catch (err) {
      list.innerHTML = '';
      console.error('[AddressBook] Load failed:', err);
      toast('โหลดที่อยู่ไม่สำเร็จ', 'error');
    }
  }

  function buildCard(addr) {
    const tagIconMap = { Home: 'home', Work: 'work', Other: 'place' };
    const tag = addr.tag || 'Home';
    const icon = tagIconMap[tag] || 'place';
    const fullName = [addr.first_name, addr.last_name].filter(Boolean).join(' ') || '-';
    const detail = [addr.address_line1, addr.address_line2].filter(Boolean).join(', ');

    const card = document.createElement('div');
    card.className = 'address-card fade-slide';
    card.innerHTML = `
      <div class="address-card-top">
        <div class="address-icon">
          <span class="material-icons-outlined">${icon}</span>
        </div>
        <div class="address-info">
          <div class="address-tag">${tag}${addr.is_default ? '<span class="default-badge">เริ่มต้น</span>' : ''}</div>
          <div class="address-name">${fullName}</div>
          ${addr.phone ? `<div class="address-detail" style="margin-bottom:4px;">${addr.phone}</div>` : ''}
          <div class="address-detail">${detail || '-'}</div>
        </div>
      </div>
      <div class="address-actions">
        <button class="action-btn edit" data-id="${addr.id}" aria-label="แก้ไขที่อยู่">
          <span class="material-icons-outlined" style="font-size:16px;">edit</span> แก้ไข
        </button>
        <button class="action-btn delete" data-id="${addr.id}" aria-label="ลบที่อยู่">
          <span class="material-icons-outlined" style="font-size:16px;">delete</span> ลบ
        </button>
      </div>
    `;

    card.querySelector('.edit').addEventListener('click', () => openModal(true, addr));
    card.querySelector('.delete').addEventListener('click', () => handleDelete(addr.id, card));

    return card;
  }

  // ── Save (add or edit) ────────────────────────────────
  async function handleSave() {
    const saveBtn = $('addrSaveBtn');
    const body = {
      tag:           currentTag,
      first_name:    $('addrFirstName').value.trim(),
      last_name:     $('addrLastName').value.trim(),
      phone:         $('addrPhone').value.trim(),
      address_line1: $('addrLine1').value.trim(),
      address_line2: $('addrLine2').value.trim(),
      is_default:    $('addrIsDefault').checked,
    };

    if (!body.first_name || !body.address_line1) {
      toast('กรุณากรอกชื่อและที่อยู่', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';

    try {
      if (currentEditId) {
        // Edit mode
        if (api.updateAddress) {
          await api.updateAddress(currentEditId, body);
        } else {
          await fetch(getBase() + `/api/addresses/${currentEditId}`, {
            method: 'PATCH',
            headers: getAuthHeader(),
            body: JSON.stringify(body)
          });
        }
        toast('แก้ไขที่อยู่สำเร็จ');
      } else {
        // Add mode
        if (api.createAddress) {
          await api.createAddress(body);
        } else {
          await fetch(getBase() + '/api/addresses', {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify(body)
          });
        }
        toast('เพิ่มที่อยู่สำเร็จ');
      }

      closeModal();
      await loadAddresses();
    } catch (err) {
      console.error('[AddressBook] Save failed:', err);
      toast('บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'บันทึก';
    }
  }

  // ── Delete ────────────────────────────────────────────
  async function handleDelete(id, cardEl) {
    const runDelete = async () => {
      cardEl.style.opacity = '0.5';
      cardEl.style.pointerEvents = 'none';

      try {
        if (api.deleteAddress) {
          await api.deleteAddress(id);
        } else {
          await fetch(getBase() + `/api/addresses/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
          });
        }
        toast('ลบที่อยู่สำเร็จ');
        await loadAddresses();
      } catch (err) {
        console.error('[AddressBook] Delete failed:', err);
        cardEl.style.opacity = '1';
        cardEl.style.pointerEvents = '';
        toast('ลบไม่สำเร็จ กรุณาลองใหม่', 'error');
      }
    };

    const msg = 'ต้องการลบที่อยู่นี้ใช่หรือไม่?';
    if (window.showConfirm) {
      window.showConfirm(msg, (agreed) => {
        if (agreed) runDelete();
      });
    } else {
      window.showAlert?.(msg, 'info');
    }
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    loadAddresses();
    setupAddressAutocomplete($('addrLine2'));

    // Open modal on add button click
    $('addAddressBtn')?.addEventListener('click', () => openModal(false));

    // Tag buttons
    document.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTag(btn.dataset.tag));
    });

    // Save
    $('addrSaveBtn')?.addEventListener('click', handleSave);

    // Cancel & Backdrop click to close
    $('addrCancelBtn')?.addEventListener('click', closeModal);
    $('addrModalBackdrop')?.addEventListener('click', (e) => {
      if (e.target === $('addrModalBackdrop')) closeModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
