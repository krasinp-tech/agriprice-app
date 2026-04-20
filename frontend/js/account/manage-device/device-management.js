 (function(){
  const AUTH_TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';
  const API_BASE = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN = localStorage.getItem(AUTH_TOKEN_KEY) || '';
  const devices = [];

  const deviceCurrent = document.getElementById('deviceCurrent');
  const deviceOther = document.getElementById('deviceOther');
  const modal = document.getElementById('logoutModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalLogoutBtn = document.getElementById('modalLogoutBtn');
  const modalPassword = document.getElementById('modalPassword');
  const modalError = document.getElementById('modalError');
  let logoutDeviceId = null;

  function getCurrentDeviceFallback() {
    const ua = navigator.userAgent || '';
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    const signal = (platform + ' ' + ua).toLowerCase();
    const isWindows = signal.includes('win');
    const isAndroid = signal.includes('android');
    const isIphone = signal.includes('iphone') || signal.includes('ipod');
    const isIpad = signal.includes('ipad');
    const isAppleMobile = isIphone || isIpad;
    const isMacDesktop =
      (signal.includes('macintosh') || signal.includes('macintel') || signal.includes('mac os x')) &&
      !isAppleMobile &&
      !isWindows &&
      !isAndroid;
    let icon = 'devices_other';
    let name = 'อุปกรณ์ปัจจุบัน';

    // Prefer desktop platform detection first to avoid false mobile labels.
    if (isWindows) {
      icon = 'computer';
      name = 'Windows PC';
    } else if (isAndroid) {
      icon = 'smartphone';
      name = 'Android Device';
    } else if (isIpad) {
      icon = 'tablet_mac';
      name = 'iPad';
    } else if (isIphone) {
      icon = 'phone_iphone';
      name = 'iPhone';
    } else if (isMacDesktop) {
      icon = 'laptop_mac';
      name = 'Mac';
    }

    return {
      id: 'current-local',
      name,
      icon,
      time: 'กำลังใช้งานอยู่',
      location: 'Unknown location',
      current: true,
    };
  }

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
      if (!modal) return;
      modal.classList.add('show');
      if (modalPassword) modalPassword.value = '';
      if (modalError) modalError.textContent = '';
    };

    item.appendChild(icon);
    item.appendChild(info);
    item.appendChild(ellipsis);
    return item;
  }

  function renderEmpty(target, message) {
    if (!target) return;
    const empty = document.createElement('div');
    empty.className = 'device-item';
    empty.innerHTML = '<div class="device-info"><div class="device-name">' + message + '</div><div class="device-meta">-</div></div>';
    target.appendChild(empty);
  }

  function renderDevices() {
    if (!deviceCurrent || !deviceOther) return;
    deviceCurrent.innerHTML = '';
    deviceOther.innerHTML = '';

    // Always trust local runtime for current device identity.
    const current = [getCurrentDeviceFallback()];
    const other = devices.filter(d => d.id !== 'current-local');

    current.forEach(device => deviceCurrent.appendChild(renderDeviceItem(device)));

    if (other.length === 0) {
      renderEmpty(deviceOther, 'ยังไม่พบประวัติอุปกรณ์อื่น');
    } else {
      other.forEach(device => deviceOther.appendChild(renderDeviceItem(device)));
    }
  }

  async function loadDevicesFromApi() {
    if (!API_BASE || !TOKEN) return;

    try {
      const res = await fetch(API_BASE + '/api/device-sessions', {
        headers: {
          Authorization: 'Bearer ' + TOKEN,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return;

      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      if (!list.length) return;

      devices.splice(0, devices.length, ...list.map((d, i) => {
        return {
          id: String(d.id || d.session_id || ('session-' + i)),
          // Current device row is rendered locally in renderDevices().
          name: d.device_name || d.name || 'Unknown device',
          icon: d.icon || 'devices_other',
          time: d.last_active_text || d.time || 'ไม่ระบุเวลา',
          location: d.location || 'Unknown location',
          current: false,
        };
      }));
    } catch (_) {
      // Keep local fallback when API is unavailable.
    }
  }

  if (modalCloseBtn && modal) {
    modalCloseBtn.onclick = function() {
      modal.classList.remove('show');
      logoutDeviceId = null;
    };
  }

  if (modalLogoutBtn) {
    modalLogoutBtn.onclick = async function() {
      const pwd = modalPassword ? modalPassword.value.trim() : '';
      if (!pwd) {
        if (modalError) modalError.textContent = 'กรุณาใส่รหัสผ่าน';
        return;
      }

      const idx = devices.findIndex(d => d.id === logoutDeviceId);
      const target = idx !== -1 ? devices[idx] : null;

      if (!target) {
        if (modalError) modalError.textContent = 'ไม่พบข้อมูลอุปกรณ์';
        return;
      }

      if (API_BASE && TOKEN && target.id !== 'current-local') {
        try {
          const res = await fetch(API_BASE + '/api/device-sessions/' + encodeURIComponent(target.id) + '/logout', {
            method: 'POST',
            headers: {
              Authorization: 'Bearer ' + TOKEN,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ password: pwd }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (modalError) modalError.textContent = err?.message || 'ไม่สามารถออกจากระบบอุปกรณ์นี้ได้';
            return;
          }
        } catch (_) {
          if (modalError) modalError.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ';
          return;
        }
      }

      if (idx !== -1) devices.splice(idx, 1);
      renderDevices();
      if (modal) modal.classList.remove('show');
      logoutDeviceId = null;
    };
  }

  // Close modal on outside click
  window.onclick = function(e) {
    if (modal && e.target === modal) {
      modal.classList.remove('show');
      logoutDeviceId = null;
    }
  };

  (async function init() {
    try {
      await loadDevicesFromApi();
      renderDevices();
      if (window.i18nInit) window.i18nInit();
    } catch (_) {
      renderDevices();
    }
  })();

  // Animate main content and sections
  setTimeout(() => {
    document.querySelectorAll('.ud-page, .device-card, .ud-card, .acc-content, .profile-card').forEach(el => {
      el.classList.add('show');
    });
  }, 60);
})();