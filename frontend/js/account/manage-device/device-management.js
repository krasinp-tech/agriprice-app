(function() {
  "use strict";

  const api = window.api || {};

  async function loadSessions() {
    const list = document.getElementById('deviceList');
    if (!list) return;

    try {
      let data = [];
      if (api.getDeviceSessions) {
        data = await api.getDeviceSessions();
      } else {
        const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
        const token = localStorage.getItem('token');
        const res = await fetch(currentBase + '/api/device-sessions', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        data = await res.json();
      }

      list.innerHTML = "";
      (data || []).forEach(s => {
        const div = document.createElement('div');
        div.className = 'device-item fade-slide';
        div.innerHTML = `
          <div class="device-icon"><span class="material-icons-outlined">${s.isCurrent ? 'smartphone' : 'devices'}</span></div>
          <div class="device-info">
            <div class="device-name">${s.deviceName || 'อุปกรณ์นิรนาม'} ${s.isCurrent ? '<span class="current-badge">เครื่องนี้</span>' : ''}</div>
            <div class="device-meta">${s.location || 'ไม่ทราบตำแหน่ง'} • ${window.AgriPriceUI ? window.AgriPriceUI.formatTimeAgo(s.lastActive) : s.lastActive}</div>
          </div>
          ${!s.isCurrent ? `<button class="logout-device-btn" data-id="${s.id}">ออกจากระบบ</button>` : ''}
        `;
        list.appendChild(div);
      });

      list.querySelectorAll('.logout-device-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const runLogout = async () => {
            try {
              const sid = btn.dataset.id;
              if (api.logoutDevice) {
                await api.logoutDevice(sid);
              } else {
                const currentBase = window.getAgriPriceApiUrl ? window.getAgriPriceApiUrl() : (window.API_BASE_URL || '').replace(/\/$/, '');
                const token = localStorage.getItem('token');
                await fetch(currentBase + '/api/device-sessions/' + encodeURIComponent(sid) + '/logout', {
                  method: 'POST',
                  headers: { 'Authorization': 'Bearer ' + token }
                });
              }
              loadSessions();
            } catch (err) {
              console.error('[DeviceMgmt] Logout failed:', err);
            }
          };

          const msg = 'ต้องการให้อุปกรณ์นี้ออกจากระบบใช่หรือไม่?';
          if (window.showConfirm) {
            window.showConfirm(msg, (agreed) => {
              if (agreed) runLogout();
            });
          } else {
            if (confirm(msg)) {
              runLogout();
            }
          }
        });
      });

    } catch (err) {
      console.error('[DeviceMgmt] Load failed:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', loadSessions);
})();
