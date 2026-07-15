/**
 * AGRIPRICE - Chat Page JS (Upgraded)
 * 100% Functional with Real-Time Polling, Image Uploads, and Search
 */
(function () {
  "use strict";

  const DEBUG_CHAT = !!window.AGRIPRICE_DEBUG;
  const api = window.api || {};
  let ALL_ROOMS = [];
  let ACTIVE_ROOM_ID = null;
  let ACTIVE_TARGET_ID = null;
  let MESSAGES = [];
  let LAST_RENDER_KEY = '';
  let POLLING_INTERVAL = null;
  let SWIPE_GLOBAL_CLEANUPS = [];

  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function esc(s) {
    if (window.AgriPriceUI) return window.AgriPriceUI.escapeHtml(s);
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw || /^(javascript|data):/i.test(raw)) return fallback;
    return raw;
  }

  // DOM Elements
  const listMount = document.getElementById("chatListMount");
  const emptyState = document.getElementById("chatEmptyState");
  const roomHeader = document.getElementById("roomHeader");
  const roomMessages = document.getElementById("roomMessages");
  const roomComposer = document.getElementById("chatComposer");
  const msgInput = document.getElementById("chatMessageInput");
  const imgInput = document.getElementById("chatImageInput");
  const roomName = document.getElementById("roomName");
  const roomAvatarContainer = document.getElementById("roomAvatar");
  const chatSearchInput = document.getElementById("chatSearchInput");
  const roomBackBtn = document.getElementById("roomBackBtn");
  const composerPreview = document.getElementById("composerPreview");
  const previewImage = document.getElementById("previewImage");
  const previewRemoveBtn = document.getElementById("previewRemoveBtn");

  /* =========================
     Conversation List
  ========================= */
  async function loadConversations() {
    if (!api.getChats) return;
    try {
      const res = await api.getChats();
      ALL_ROOMS = (res.data || res || []);
      renderChatList(ALL_ROOMS);
    } catch (err) {
      console.error('[Chat] List load failed:', err);
    }
  }

  let prevRoomsStr = '';
  function renderChatList(rooms) {
    if (!listMount) return;

    if (rooms.length === 0) {
      listMount.innerHTML = `<div style="text-align:center; padding:40px; color:#999; font-size:14px;">${t('no_chats', 'ยังไม่มีรายการแชท')}</div>`;
      return;
    }

    const currentStr = JSON.stringify(rooms.map(r => ({
      room_id: r.room_id,
      unread_count: r.unread_count,
      last_message: r.last_message,
      last_message_type: r.last_message_type,
      last_message_at: r.last_message_at,
      other_user: r.other_user
    })));

    if (currentStr === prevRoomsStr) {
      // Update active state in-place to avoid flicker
      listMount.querySelectorAll('.chat-item').forEach(el => {
        const id = el.dataset.id;
        if (String(id) === String(ACTIVE_ROOM_ID)) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
      return;
    }
    prevRoomsStr = currentStr;

    listMount.innerHTML = rooms.map(r => {
      const other = r.other_user || {};
      const name = `${other.first_name || ''} ${other.last_name || ''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ');
      const lastMsg = r.last_message || (r.last_message_type === 'image' ? '🖼️ [ส่งรูปภาพ]' : '');
      const avatar = safeUrl(other.avatar, '../../assets/images/avatar-guest.svg');
      const isUnread = r.unread_count > 0;
      const isActive = String(r.room_id) === String(ACTIVE_ROOM_ID);

      let timeStr = '';
      if (r.last_message_at) {
        const d = new Date(r.last_message_at);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
          timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        } else {
          timeStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        }
      }

      return `
        <div class="chat-item-wrapper" data-id="${r.room_id}">
          <!-- Underlay buttons -->
          <div class="chat-item-underlay-left" style="background: #22c55e;">
            <span class="material-icons-outlined">done_all</span>
            <span>${isUnread ? t('mark_read', 'อ่านแล้ว') : t('mark_unread', 'ยังไม่อ่าน')}</span>
          </div>
          <div class="chat-item-underlay-right" style="background: #ef4444;">
            <span class="material-icons-outlined">delete</span>
            <span>${t('delete', 'ลบ')}</span>
          </div>
          <!-- Main Chat Item -->
          <div class="chat-item ${isActive ? 'active' : ''} ${isUnread ? 'is-unread' : ''}" data-id="${r.room_id}" data-target-id="${other.id || other.profile_id}">
            <div class="chat-item-avatar"><img src="${esc(avatar)}" onerror="this.src='../../assets/images/avatar-guest.svg'" alt=""></div>
            <div class="chat-item-body">
              <div class="chat-item-top">
                <div class="chat-item-name">${esc(name)}</div>
                <div class="chat-item-time">${esc(timeStr)}</div>
              </div>
              <div class="chat-item-meta">
                <div class="chat-item-snippet">${esc(lastMsg)}</div>
                ${isUnread ? `<div class="chat-item-unread">${esc(r.unread_count)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listMount.querySelectorAll('.chat-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const targetId = el.dataset.targetId;
        const room = ALL_ROOMS.find(r => String(r.room_id) === String(id));
        openChat(id, targetId, room);
      };
    });

    bindSwipeActions();
  }

  function bindSwipeActions() {
    if (!listMount) return;
    SWIPE_GLOBAL_CLEANUPS.forEach(cleanup => cleanup());
    SWIPE_GLOBAL_CLEANUPS = [];

    listMount.querySelectorAll('.chat-item-wrapper').forEach(wrapper => {
      const item = wrapper.querySelector('.chat-item');
      const underlayLeft = wrapper.querySelector('.chat-item-underlay-left');
      const underlayRight = wrapper.querySelector('.chat-item-underlay-right');

      function updateUnderlays(x) {
        if (underlayLeft) underlayLeft.style.display = x > 0 ? 'flex' : 'none';
        if (underlayRight) underlayRight.style.display = x < 0 ? 'flex' : 'none';
      }

      function resetSwipe() {
        currentX = 0;
        activeSwipe = 0;
        item.style.transform = 'translateX(0)';
        item.dataset.swipeOpen = 'false';
        updateUnderlays(0);
      }

      function settleSwipe() {
        let nextX = 0;
        if (currentX > 40) nextX = 76;
        else if (currentX < -40) nextX = -76;

        currentX = nextX;
        activeSwipe = nextX;
        item.style.transform = `translateX(${nextX}px)`;
        item.dataset.swipeOpen = nextX !== 0 ? 'true' : 'false';
        updateUnderlays(nextX);
      }

      function suppressNextClick() {
        item.dataset.swipeSuppress = 'true';
        setTimeout(() => {
          if (item.dataset.swipeSuppress === 'true') item.dataset.swipeSuppress = '';
        }, 350);
      }

      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let isDragging = false;
      let isHorizontal = false;
      let movedDuringGesture = false;
      let activeSwipe = 0; // -76 for left (delete), 76 for right (read)

      item.addEventListener('click', (e) => {
        if (item.dataset.swipeSuppress === 'true' || activeSwipe !== 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          item.dataset.swipeSuppress = '';
          item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          resetSwipe();
        }
      }, true);

      // Touch events for mobile
      item.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = activeSwipe;
        isDragging = true;
        isHorizontal = false;
        movedDuringGesture = false;
        item.style.transition = 'none';
      }, { passive: true });

      item.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        // Detect horizontal swipe
        if (!isHorizontal && Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
          isHorizontal = true;
        }

        if (isHorizontal) {
          movedDuringGesture = true;
          currentX = diffX + activeSwipe;
          // Clamp swipe distance
          if (currentX > 84) currentX = 84;
          if (currentX < -84) currentX = -84;
          item.style.transform = `translateX(${currentX}px)`;
          updateUnderlays(currentX);
        }
      }, { passive: true });

      item.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        settleSwipe();
        if (movedDuringGesture) suppressNextClick();
      });

      // Mouse drag events for testing / desktop
      let isMouseDragging = false;
      item.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        currentX = activeSwipe;
        isMouseDragging = true;
        movedDuringGesture = false;
        item.style.transition = 'none';
      });

      const handleMouseMove = (e) => {
        if (!isMouseDragging) return;
        const diffX = e.clientX - startX;
        if (Math.abs(diffX) > 4) movedDuringGesture = true;
        currentX = diffX + activeSwipe;
        if (currentX > 84) currentX = 84;
        if (currentX < -84) currentX = -84;
        item.style.transform = `translateX(${currentX}px)`;
        updateUnderlays(currentX);
      };
      window.addEventListener('mousemove', handleMouseMove);
      SWIPE_GLOBAL_CLEANUPS.push(() => window.removeEventListener('mousemove', handleMouseMove));

      const handleMouseUp = () => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        settleSwipe();
        if (movedDuringGesture) suppressNextClick();
      };
      window.addEventListener('mouseup', handleMouseUp);
      SWIPE_GLOBAL_CLEANUPS.push(() => window.removeEventListener('mouseup', handleMouseUp));

      // Close swiped state on body interaction elsewhere
      const handleDocumentClick = (e) => {
        if (!wrapper.contains(e.target) && activeSwipe !== 0) {
          item.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          resetSwipe();
        }
      };
      document.addEventListener('click', handleDocumentClick);
      SWIPE_GLOBAL_CLEANUPS.push(() => document.removeEventListener('click', handleDocumentClick));

      // Left Action: Toggle Read/Unread
      wrapper.querySelector('.chat-item-underlay-left')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomId = wrapper.dataset.id;
        const room = ALL_ROOMS.find(r => String(r.room_id) === String(roomId));
        if (room) {
          try {
            const isUnread = room.unread_count > 0;
            if (isUnread) {
              if (api.markChatRead) await api.markChatRead(roomId);
              else await api.call('PATCH', `/api/chats/${roomId}/read`);
              room.unread_count = 0;
            } else {
              const result = api.markChatUnread
                ? await api.markChatUnread(roomId)
                : await api.call('PATCH', `/api/chats/${roomId}/unread`);
              room.unread_count = result?.data?.updated ? 1 : 0;
            }
            resetSwipe();
            renderChatList(ALL_ROOMS);
          } catch(err) {
            console.error('[Chat] Mark read/unread failed:', err);
          }
        }
      });

      // Right Action: Delete Chat
      wrapper.querySelector('.chat-item-underlay-right')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = wrapper.dataset.id;
        const confirmMsg = t('confirm_delete_chat', 'คุณต้องการลบการสนทนานี้ใช่หรือไม่?');
        const showConfirm = window.showConfirm || ((msg, cb) => cb(confirm(msg)));

        showConfirm(confirmMsg, async (confirmed) => {
          if (confirmed) {
            try {
              if (api.deleteChat) await api.deleteChat(roomId);
              else await api.call('DELETE', `/api/chats/${roomId}`);
              // Animation height collapse
              wrapper.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
              wrapper.style.height = '0';
              wrapper.style.margin = '0';
              wrapper.style.opacity = '0';
              wrapper.style.padding = '0';
              setTimeout(() => {
                loadConversations();
              }, 350);
            } catch(err) {
              console.error('[Chat] Delete failed:', err);
              if (window.showToast) window.showToast(t('error_delete_chat', 'ลบการสนทนาไม่สำเร็จ'), 'error');
            }
          } else {
            resetSwipe();
          }
        });
      });
    });
  }

  /* =========================
     Chat Room Detail
  ========================= */
  async function openChat(roomId, targetId, roomInfo) {
    ACTIVE_ROOM_ID = roomId;
    ACTIVE_TARGET_ID = targetId;

    // Mobile UI: show room, hide list
    document.querySelector('.chat-shell').classList.add('room-active');
    document.body.classList.add('chat-room-open');

    // UI State
    if (emptyState) emptyState.style.display = 'none';
    if (roomHeader) roomHeader.style.display = 'flex';
    if (roomMessages) roomMessages.style.display = 'block';
    if (roomComposer) roomComposer.style.display = 'flex';

    // Header Info
    const other = roomInfo?.other_user || {};
    if (roomName) roomName.textContent = `${other.first_name || ''} ${other.last_name || ''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ');
    if (roomAvatarContainer) {
      const avatarUrl = safeUrl(other.avatar, '../../assets/images/avatar-guest.svg');
      roomAvatarContainer.innerHTML = `<img src="${esc(avatarUrl)}" onerror="this.src='../../assets/images/avatar-guest.svg'" alt="">`;
    }

    // Call Action Handler
    const callBtn = document.querySelector('[data-action="call"]');
    if (callBtn) {
      callBtn.onclick = async () => {
        let phone = other.phone || other.telephone || other.phone_number;
        if (!phone && targetId) {
          try {
            const profile = await api.getProfileById?.(targetId);
            phone = profile?.phone || profile?.telephone || profile?.phone_number;
          } catch (err) {
            console.error('[Chat] Fetching phone from profile failed:', err);
          }
        }
        if (phone) {
          window.location.href = 'tel:' + String(phone).replace(/[^\d+]/g, '');
        } else {
          const msg = t('no_phone_number', 'ไม่พบเบอร์โทรศัพท์ของผู้ใช้งานรายนี้');
          if (window.showToast) window.showToast(msg, 'error');
          else if (window.appNotify) window.appNotify(msg, 'error');
          else alert(msg);
        }
      };
    }

    // Load Messages
    await loadMessages(roomId);
    // Start Polling
    startPolling(roomId);
    // Refresh list to clear unread marker locally
    renderChatList(ALL_ROOMS);
  }

  async function loadMessages(chatId) {
    if (!api.getChatMessages || chatId !== ACTIVE_ROOM_ID) return;
    try {
      const res = await api.getChatMessages(chatId);
      const items = res.data || res || [];
      const renderKey = [
        String(chatId),
        ...items.map((m) => [
          m.message_id || m.id || '',
          m.sender_id || '',
          m.created_at || '',
          m.message || '',
          m.image_url || ''
        ].join('~'))
      ].join('|');
      // Re-render when switching rooms or when message content changes.
      if (renderKey !== LAST_RENDER_KEY) {
        MESSAGES = items;
        LAST_RENDER_KEY = renderKey;
        renderMessages(MESSAGES);
      }
      if (api.markChatRead) await api.markChatRead(chatId);
    } catch (err) {
      console.error('[Chat] Messages failed:', err);
    }
  }

  function renderMessages(items) {
    if (!roomMessages) return;
    const me = api.getUser()?.id;

    roomMessages.innerHTML = items.map(m => {
      const isMe = String(m.sender_id) === String(me);
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
      let contentHtml = '';
      if (m.message_type === 'image' || m.image_url) {
        const imageUrl = safeUrl(m.image_url);
        contentHtml = imageUrl
          ? `<img src="${esc(imageUrl)}" class="bubble-image" data-image-url="${esc(imageUrl)}" alt="">`
          : `<div class="bubble">${esc(t('image_unavailable', 'Image unavailable'))}</div>`;
      } else {
        contentHtml = `<div class="bubble">${esc(m.message)}</div>`;
      }

      return `
        <div class="msg ${isMe ? 'me' : 'them'}">
          <div>
            ${contentHtml}
            <div class="msg-time">${esc(time)}</div>
          </div>
        </div>
      `;
    }).join('');

    roomMessages.querySelectorAll('.bubble-image[data-image-url]').forEach((img) => {
      img.addEventListener('click', () => window.open(img.dataset.imageUrl, '_blank', 'noopener'));
    });
    roomMessages.scrollTop = roomMessages.scrollHeight;
  }

  /* =========================
     Real-Time & Search
  ========================= */
  function startPolling(chatId) {
    stopPolling();
    POLLING_INTERVAL = setInterval(() => {
      if (ACTIVE_ROOM_ID === chatId) {
        loadMessages(chatId);
        loadConversations(); // Update list unreads
      }
    }, 4000);
  }

  function stopPolling() {
    if (POLLING_INTERVAL) {
      clearInterval(POLLING_INTERVAL);
      POLLING_INTERVAL = null;
    }
  }

  function handleSearch(q) {
    const term = q.trim().toLowerCase();
    if (!term) {
      renderChatList(ALL_ROOMS);
      return;
    }
    const filtered = ALL_ROOMS.filter(r => {
      const name = `${r.other_user?.first_name || ''} ${r.other_user?.last_name || ''}`.toLowerCase();
      return name.includes(term) || (r.last_message && r.last_message.toLowerCase().includes(term));
    });
    renderChatList(filtered);
  }

  /* =========================
     Actions & Composers
  ========================= */
  async function handleSend(e) {
    if (e) e.preventDefault();
    if (!ACTIVE_ROOM_ID) return;

    const text = msgInput.value.trim();
    const imageFile = imgInput.files[0];

    if (!text && !imageFile) return;

    // UI feedback
    msgInput.value = '';
    hidePreview();

    try {
      await api.sendMessage(ACTIVE_ROOM_ID, text, imageFile);
      imgInput.value = ''; // clear file
      await loadMessages(ACTIVE_ROOM_ID);
      await loadConversations();
    } catch (err) {
      console.error('[Chat] Send failed:', err);
      if (window.showToast) window.showToast(t('error_send_chat', 'ส่งข้อความไม่สำเร็จ'), 'error');
    }
  }

  function showPreview(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      composerPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  function hidePreview() {
    composerPreview.style.display = 'none';
    imgInput.value = '';
  }

  /* =========================
     Init
  ========================= */
  function init() {
    loadConversations();

    // Event Listeners
    if (roomComposer) roomComposer.onsubmit = handleSend;

    document.querySelector('[data-action="attach"]')?.addEventListener('click', () => imgInput.click());

    imgInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) showPreview(file);
    });

    previewRemoveBtn?.addEventListener('click', hidePreview);

    chatSearchInput?.addEventListener('input', (e) => handleSearch(e.target.value));

    roomBackBtn?.addEventListener('click', () => {
      stopPolling();
      ACTIVE_ROOM_ID = null;
      document.querySelector('.chat-shell').classList.remove('room-active');
      document.body.classList.remove('chat-room-open');
    });

    // Deep link from URL (?chatId=...)
    const params = new URLSearchParams(window.location.search);
    const qChatId = params.get('chatId');
    const qTargetId = params.get('targetId');
    if (qChatId && qTargetId) {
       setTimeout(() => {
         const room = ALL_ROOMS.find(r => String(r.room_id) === String(qChatId));
         openChat(qChatId, qTargetId, room);
       }, 500);
    } else if (qTargetId) {
       setTimeout(() => {
         const room = ALL_ROOMS.find(r => r.other_user && String(r.other_user.id || r.other_user.profile_id) === String(qTargetId));
         if (room) {
           openChat(room.room_id, qTargetId, room);
         } else if (window.api && window.api.startChat) {
           window.api.startChat(qTargetId).then(res => {
             const newRoomId = res.data?.room_id || res.room_id || res.id;
             if (newRoomId) {
               loadConversations().then(() => {
                 const newRoom = ALL_ROOMS.find(r => String(r.room_id) === String(newRoomId));
                 openChat(newRoomId, qTargetId, newRoom);
               });
             }
           }).catch(err => console.error("[Chat] Deep-link startChat failed:", err));
         }
       }, 600);
    }

    // Open Profile Action
    document.getElementById('btnOpenProfile')?.addEventListener('click', () => {
      if (ACTIVE_TARGET_ID) {
        window.location.href = `profile.html?uid=${ACTIVE_TARGET_ID}`;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
