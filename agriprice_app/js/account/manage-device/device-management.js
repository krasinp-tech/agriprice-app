
(function(){
  // Example device data (replace with real API in production)
  const devices = [
    {
      id: 'dev1',
      name: 'Vivo V27 5G',
      icon: 'smartphone',
      time: 'วันนี้ เวลา 00:33',
      location: 'Bangkok, Thailand',
      current: true
    },
    {
      id: 'dev2',
      name: 'iPad Air (2022)',
      icon: 'tablet_mac',
      time: 'เมื่อวานนี้ เวลา 13:41',
      location: 'Ban Tha Mai Ruak, Thailand',
      current: false
    },
    {
      id: 'dev3',
      name: 'พีซีที่ใช้ Windows',
      icon: 'computer',
      time: 'วันนี้ เวลา 05:58',
      location: 'Ban Tha Mai Ruak, Thailand',
      current: false
    },
    {
      id: 'dev4',
      name: 'อุปกรณ์ที่ไม่ทราบประเภท',
      icon: 'devices_other',
      time: '30 ธันวาคม 2025',
      location: 'Surat Thani, Thailand',
      current: false
    }
  ];

  const deviceCurrent = document.getElementById('deviceCurrent');
  const deviceOther = document.getElementById('deviceOther');
  const modal = document.getElementById('logoutModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalLogoutBtn = document.getElementById('modalLogoutBtn');
  const modalPassword = document.getElementById('modalPassword');
  const modalError = document.getElementById('modalError');
  let logoutDeviceId = null;

  function renderDeviceItem(device) {
    const item = document.createElement('div');
    item.className = 'device-item';
    const icon = document.createElement('span');
    icon.className = 'material-icons-outlined device-icon';
    icon.textContent = device.icon;

    const info = document.createElement('div');
    info.className = 'device-info';
    info.innerHTML = `
      <div class="device-name">${device.name}</div>
      <div class="device-meta">${device.location} • ${device.time}</div>
    `;

    const ellipsis = document.createElement('span');
    ellipsis.className = 'device-ellipsis';
    ellipsis.innerHTML = '<span class="material-icons-outlined">more_vert</span>';
    ellipsis.onclick = function() {
      logoutDeviceId = device.id;
      modal.classList.add('show');
      modalPassword.value = '';
      modalError.textContent = '';
    };

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(ellipsis);
    return item;
  }

  function renderDevices() {
    deviceCurrent.innerHTML = '';
    deviceOther.innerHTML = '';
    // Current device
    devices.filter(d => d.current).forEach(device => {
      deviceCurrent.appendChild(renderDeviceItem(device));
    });
    // Other devices
    devices.filter(d => !d.current).forEach(device => {
      deviceOther.appendChild(renderDeviceItem(device));
    });
  }

  modalCloseBtn.onclick = function() {
    modal.classList.remove('show');
    logoutDeviceId = null;
  };

  modalLogoutBtn.onclick = function() {
    const pwd = modalPassword.value.trim();
    if (!pwd) {
      modalError.textContent = 'กรุณาใส่รหัสผ่าน';
      return;
    }
    // Simulate password check
    if (pwd !== '1234') {
      modalError.textContent = 'รหัสผ่านไม่ถูกต้อง';
      return;
    }
    // Remove device
    const idx = devices.findIndex(d => d.id === logoutDeviceId);
    if (idx !== -1) devices.splice(idx, 1);
    renderDevices();
    modal.classList.remove('show');
    logoutDeviceId = null;
  };

  // Close modal on outside click
  window.onclick = function(e) {
    if (e.target === modal) {
      modal.classList.remove('show');
      logoutDeviceId = null;
    }
  };

  renderDevices();
  if (window.i18nInit) window.i18nInit();

  // Animate main content and sections
  setTimeout(() => {
    document.querySelectorAll('.ud-page, .device-card, .ud-card, .acc-content, .profile-card').forEach(el => {
      el.classList.add('show');
    });
  }, 60);
})();