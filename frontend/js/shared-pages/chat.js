/**
 * AGRIPRICE - Chat Page JS
 * Ready for DB: replace ChatAPI methods with real fetch calls later.
 */
document.addEventListener("DOMContentLoaded", () => {
  const DEBUG_CHAT = !!window.AGRIPRICE_DEBUG;
  function t(key, fallback) {
    if (window.i18nT) return window.i18nT(key, fallback);
    return fallback || key;
  }

  function localeByLang() {
    const lang = (localStorage.getItem('lang') || 'th').toLowerCase();
    if (lang === 'en') return 'en-US';
    if (lang === 'zh') return 'zh-CN';
    return 'th-TH';
  }

  const listMount = document.getElementById("chatListMount");
  const searchInput = document.getElementById("chatSearchInput");
  const refreshBtn = document.getElementById("chatRefreshBtn");

  const emptyState = document.getElementById("chatEmptyState");
  const roomHeader = document.getElementById("roomHeader");
  const roomMessages = document.getElementById("roomMessages");
  const composer = document.getElementById("chatComposer");
  const msgInput = document.getElementById("chatMessageInput");
  const imgInput = document.getElementById("chatImageInput");
  const composerPreview = document.getElementById("composerPreview");
  const previewImage = document.getElementById("previewImage");
  const previewRemoveBtn = document.getElementById("previewRemoveBtn");

  const roomBackBtn = document.getElementById("roomBackBtn");
  const roomName = document.getElementById("roomName");
  const roomSub = document.getElementById("roomSub");
  const roomAvatar = document.getElementById("roomAvatar");

  let pendingImage = null;

  // ----------------------------
  // API layer - เชื่อม server จริง
  // ----------------------------
  const API_BASE  = (window.API_BASE_URL || '').replace(/\/$/, '');
  const TOKEN_KEY = window.AUTH_TOKEN_KEY || 'token';

  function authHeaders() {
    const t = localStorage.getItem(TOKEN_KEY) || '';
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  function resolveAssetPath(p) {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    const dir = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    const idx = dir.lastIndexOf('/pages/');
    if (idx === -1) return String(p || '').replace(/^\/+/, '');
    const afterPages = dir.substring(idx + '/pages/'.length);
    const depth = afterPages.split('/').filter(Boolean).length;
    return '../' + '../'.repeat(depth) + String(p || '').replace(/^\/+/, '');
  }

  function myUserId() {
    try { return JSON.parse(localStorage.getItem(window.AUTH_USER_KEY || 'user') || 'null')?.id || null; }
    catch (_) { return null; }
  }

  function normalizeProfileImageUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (/^(https?:\/\/|data:|blob:)/i.test(value)) return value;
    if (value.startsWith('/uploads/')) return API_BASE ? (API_BASE + value) : value;
    if (value.startsWith('/assets/')) return resolveAssetPath(value.replace(/^\//, ''));
    if (value.startsWith('assets/')) return resolveAssetPath(value);
    return value;
  }

  const ChatAPI = {
    async listConversations() {
      if (!API_BASE) {
        if (DEBUG_CHAT) console.warn('[chat] API_BASE not configured');
        return [];
      }
      try {
        const token = localStorage.getItem(window.AUTH_TOKEN_KEY || 'token');
        if (DEBUG_CHAT) console.log('[chat] Fetching conversations with token:', token ? 'present' : 'MISSING');
        const res = await fetch(API_BASE + '/api/chats', { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const convos = (json.data || []).map(r => ({
          chatId:      r.chatId,
          sellerId:    r.other_id,
          sellerName:  `${r.first_name||''} ${r.last_name||''}`.trim() || t('booking_unknown_name', 'ไม่ทราบชื่อ'),
          sellerSub:   '',
          avatar:      normalizeProfileImageUrl(r.avatar || ''),
          phone:       r.phone  || '',
          lastMessage: r.lastMessage || '',
          lastTime:    r.lastTime ? new Date(r.lastTime).getTime() : Date.now(),
          unread:      r.unread || 0,
        }));
        if (DEBUG_CHAT) console.log('[chat] Loaded conversations:', convos.length, convos);
        return convos;
      } catch (e) {
        console.error('[chat] listConversations failed:', e);
        return [];
      }
    },

    async getMessages(chatId) {
      if (!API_BASE) {
        if (DEBUG_CHAT) console.warn('[chat] API_BASE not configured');
        return [];
      }
      try {
        const res = await fetch(API_BASE + '/api/chats/' + chatId + '/messages', { headers: authHeaders() });
        if (!res.ok) throw new Error(res.status);
        const json = await res.json();
        const me = myUserId();
        return (json.data || []).map(m => ({
          id:          String(m.message_id || m.id),
          sender_id:   m.sender_id || null,
          from:        m.sender_id === me ? 'me' : 'them',
          contentType: m.image_url ? 'image' : 'text',
          text:        m.message || '',
          imageUrl:    m.image_url || null,
          time:        new Date(m.created_at).getTime(),
          status:      'sent',
        }));
      } catch (e) {
        if (DEBUG_CHAT) console.warn('[chat] getMessages failed:', e.message);
        return [];
      }
    },

    async sendMessage(chatId, { text, contentType, imageData, imageFile }) {
      if (!API_BASE) {
        return { id: 'm'+Math.random().toString(16).slice(2), from:'me', contentType: contentType||'text', text, time: Date.now(), status:'sent' };
      }
      try {
        let body, headers = authHeaders();
        if (contentType === 'image' && imageFile) {
          const fd = new FormData();
          if (text) fd.append('message', text);
          fd.append('image', imageFile);
          body = fd;
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify({ message: text });
        }
        const res = await fetch(API_BASE + '/api/chats/' + chatId + '/messages', { method:'POST', headers, body });
        if (!res.ok) throw new Error(res.status);
        const json = await res.json();
        const m = json.data || {};
        return { id: String(m.id||Date.now()), from:'me', contentType: m.image_url?'image':'text', text: m.message||text, imageUrl: m.image_url||null, time: Date.now(), status:'sent' };
      } catch (e) {
        if (DEBUG_CHAT) console.warn('[chat] sendMessage failed:', e.message);
        return { id: 'm'+Math.random().toString(16).slice(2), from:'me', contentType: contentType||'text', text, time: Date.now(), status:'failed' };
      }
    },

    async markRead(chatId) {
      if (!API_BASE || !chatId) return;
      try {
        // server mark read ทุกครั้งที่ GET messages อยู่แล้ว
        // แต่หน้าแชทนี้ไม่ได้เรียกซ้ำ จึง mark read แบบ inline ที่นี่
        await fetch(API_BASE + '/api/chats/' + chatId + '/messages?mark_read=1', {
          headers: authHeaders(),
        });
      } catch (_) {}
    },

    async uploadImage(file) {
      // รูปถูก upload พร้อม sendMessage ใน FormData อยู่แล้ว
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve({ imageData: e.target.result, imageFile: file });
        reader.readAsDataURL(file);
      });
    },
  };

  // ----------------------------
  // State
  // ----------------------------
  let conversations = [];
  let activeChatId = null;
  let activeConversation = null;
  let messagesByChat = new Map();

  // ----------------------------
  // Utils
  // ----------------------------
  const TH_TZ = "Asia/Bangkok";

  function isValidTimestamp(ts) {
    return Number.isFinite(Number(ts));
  }

  function isSameCalendarDay(dateA, dateB) {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  }

  function listTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    const target = new Date(Number(ts));
    const now = new Date();

    if (isSameCalendarDay(target, now)) {
      return new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: TH_TZ,
      }).format(target);
    }

    return new Intl.DateTimeFormat(localeByLang(), {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      timeZone: TH_TZ,
    }).format(target);
  }

  function dateTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    const target = new Date(Number(ts));

    return new Intl.DateTimeFormat(localeByLang(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TH_TZ,
    }).format(target);
  }

  function messageTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    const target = new Date(Number(ts));

    return new Intl.DateTimeFormat(localeByLang(), {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: TH_TZ,
    }).format(target);
  }

  function getDateKeyInTimeZone(ts, timeZone) {
    if (!isValidTimestamp(ts)) return "";
    const target = new Date(Number(ts));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(target);

    const year = parts.find((p) => p.type === "year")?.value || "0000";
    const month = parts.find((p) => p.type === "month")?.value || "00";
    const day = parts.find((p) => p.type === "day")?.value || "00";
    return `${year}-${month}-${day}`;
  }

  function messageDateSeparatorLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    const target = new Date(Number(ts));

    return new Intl.DateTimeFormat(localeByLang(), {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: TH_TZ,
    }).format(target);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function isDesktop() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function setMobileRoomMode(isOpen) {
    if (isDesktop()) {
      document.body.classList.remove("chat-room-open");
      return;
    }
    document.body.classList.toggle("chat-room-open", !!isOpen);
  }

  // ----------------------------
  // Render: list
  // ----------------------------
  function renderList(list) {
    const avatarFallback = resolveAssetPath('assets/images/avatar-guest.svg');
    listMount.innerHTML = "";

    // Toggle empty state based on whether there are chats.
    if (emptyState) {
      emptyState.style.display = list.length ? "none" : "block";
    }

    if (!list.length) {
      listMount.innerHTML = `
        <div style="padding:16px;color:#666;font-size:14px;">
          ${escapeHtml(t('chat_no_result', 'ไม่พบแชทที่ตรงกับคำค้นหา'))}
        </div>`;
      return;
    }

    list.forEach((c) => {
      const active = c.chatId === activeChatId ? " active" : "";
      const unread = c.unread > 0 ? `<div class="chat-item-unread">${c.unread}</div>` : "";
      const avatarImg = c.avatar
        ? `<img src="${escapeHtml(c.avatar)}" alt="" onerror="this.onerror=null;this.src='${avatarFallback}'">`
        : '<span class="material-icons-outlined" aria-hidden="true">person</span>';

      const el = document.createElement("div");
      el.className = "chat-item" + active;
      el.dataset.chatId = c.chatId;
      el.dataset.sellerId = c.sellerId;
      el.dataset.sellerName = c.sellerName;

      el.innerHTML = `
        <div class="chat-item-avatar">${avatarImg}</div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <div class="chat-item-name">${escapeHtml(c.sellerName)}</div>
            <div class="chat-item-time" title="${escapeHtml(dateTimeLabel(c.lastTime))}">${escapeHtml(listTimeLabel(c.lastTime))}</div>
          </div>
          <div class="chat-item-snippet">${escapeHtml(c.lastMessage || "")}</div>
          <div class="chat-item-meta">
            <div class="chat-item-tag">${escapeHtml(c.sellerSub || "")}</div>
            ${unread}
          </div>
        </div>
      `;

      listMount.appendChild(el);
    });
  }

  // ----------------------------
  // Render: room
  // ----------------------------
  function showRoom(convo, msgs) {
    const avatarFallback = resolveAssetPath('assets/images/avatar-guest.svg');
    activeChatId = convo.chatId;
    activeConversation = convo;
    setMobileRoomMode(true);

    // Header: keep seller data on elements.
    roomHeader.dataset.sellerId   = convo.sellerId   || "";
    roomHeader.dataset.sellerName = convo.sellerName || "";
    roomHeader.dataset.phone      = convo.phone      || "";
    roomName.textContent = convo.sellerName || "-";

    // Wire profile button using conversation closure.
    const btnOpenProfile = document.getElementById('btnOpenProfile');
    if (btnOpenProfile) {
      btnOpenProfile.onclick = () => {
        const uid  = convo.sellerId   || "";
        const name = convo.sellerName || "";
        if (!uid) { window.appNotify(t('profile_not_found', 'ไม่พบข้อมูลโปรไฟล์'), 'error'); return; }
        if (window.navigateWithTransition) window.navigateWithTransition(`profile.html?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`); else window.location.href = `profile.html?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`;
      };
    }

    // Wire call button.
    const btnCall = document.querySelector('[data-action="call"]');
    if (btnCall) {
      btnCall.onclick = () => {
        const phone = convo.phone || "";
        if (phone) {
          if (window.navigateWithTransition) window.navigateWithTransition(`tel:${phone.replace(/[^0-9+]/g, '')}`); else window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
        } else if (API_BASE && convo.sellerId) {
          fetch(`${API_BASE}/api/profiles/${convo.sellerId}`, { headers: authHeaders() })
            .then(r => r.ok ? r.json() : null)
            .then(p => {
              const tel = p?.phone || '';
              if (tel) {
                const nextHref = `tel:${tel.replace(/[^0-9+]/g, '')}`;
                if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
              }
              else window.appNotify(t('phone_not_found', 'ไม่พบเบอร์โทรของผู้ใช้รายนี้'), 'error');
            }).catch(() => window.appNotify(t('phone_fetch_failed', 'ไม่สามารถดึงเบอร์โทรได้'), 'error'));
        } else {
          window.appNotify(t('phone_not_found', 'ไม่พบเบอร์โทรของผู้ใช้รายนี้'), 'error');
        }
      };
    }
    // Inject online indicator when missing.
    if (!document.getElementById('onlineStatusDot')) {
      roomSub.innerHTML = '<span id="onlineStatusDot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#9ca3af;margin-right:4px;vertical-align:middle;"></span><span id="onlineStatusText" style="font-size:12px;color:#9ca3af;">' + escapeHtml(t('loading', 'กำลังโหลด...')) + '</span>';
    }
    roomAvatar.innerHTML = convo.avatar
      ? `<img src="${escapeHtml(convo.avatar)}" alt="" onerror="this.onerror=null;this.src='${avatarFallback}'">`
      : '<span class="material-icons-outlined" aria-hidden="true">person</span>';
    roomAvatar.style.overflow = "hidden";
    // เน€เธเนเธเธชเธ–เธฒเธเธฐเธญเธญเธเนเธฅเธเน
    if (convo.sellerId) updateOnlineStatus(convo.sellerId);

    // show/hide
    emptyState.style.display = "none";
    roomHeader.style.display = "flex";
    roomMessages.style.display = "block";
    composer.style.display = "flex";

    // messages
    let previousDateKey = "";
    roomMessages.innerHTML = msgs.map((m) => {
      const cls = m.from === "me" ? "msg me" : "msg them";
      const currentDateKey = getDateKeyInTimeZone(m.time, TH_TZ);
      const shouldShowDate = currentDateKey && currentDateKey !== previousDateKey;
      previousDateKey = currentDateKey;

      const dateSeparator = shouldShowDate
        ? `<div class="msg-date-separator"><span>${escapeHtml(messageDateSeparatorLabel(m.time))}</span></div>`
        : "";

      let contentHtml = "";
      if (m.contentType === "image" && (m.imageData || m.imageUrl)) {
        const imgSrc = m.imageUrl || m.imageData;
        const textBubble = m.text ? `<div class="bubble">${escapeHtml(m.text)}</div>` : "";
        contentHtml = `${textBubble}<img src="${escapeHtml(imgSrc)}" class="bubble-image" alt="${escapeHtml(t('attach_image', 'แนบรูป'))}" />`;
      } else if (m.text) {
        contentHtml = `<div class="bubble">${escapeHtml(m.text)}</div>`;
      }

      return `
        ${dateSeparator}
        <div class="${cls}">
          <div>
            ${contentHtml}
            <div class="msg-time">${escapeHtml(messageTimeLabel(m.time))}</div>
          </div>
        </div>
      `;
    }).join("");

    // scroll bottom
    roomMessages.scrollTop = roomMessages.scrollHeight;

    // mark read in UI
    const found = conversations.find((x) => x.chatId === convo.chatId);
    if (found) found.unread = 0;
    renderList(filterList(searchInput.value));
  }

  function closeRoomOnMobile() {
    if (isDesktop()) return;
    activeChatId = null;
    activeConversation = null;
    setMobileRoomMode(false);

    emptyState.style.display = "block";
    roomHeader.style.display = "none";
    roomMessages.style.display = "none";
    composer.style.display = "none";

    renderList(filterList(searchInput.value));
  }

  // ----------------------------
  // Filtering
  // ----------------------------
  function filterList(q) {
    const query = (q || "").trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((c) => {
      return (
        (c.sellerName || "").toLowerCase().includes(query) ||
        (c.sellerSub || "").toLowerCase().includes(query) ||
        (c.lastMessage || "").toLowerCase().includes(query)
      );
    });
  }

  // ----------------------------
  // Load
  // ----------------------------
  async function loadConversations() {
    conversations = await ChatAPI.listConversations();
    conversations.sort((a, b) => b.lastTime - a.lastTime);
    renderList(filterList(searchInput.value));

    // desktop: auto open first chat
    if (isDesktop() && conversations.length && !activeChatId) {
      await openChat(conversations[0].chatId);
    }
  }

  async function openChat(chatId) {
    if (DEBUG_CHAT) console.log('[chat] openChat called with:', chatId);
    const convo = conversations.find((x) => String(x.chatId) === String(chatId));
    if (DEBUG_CHAT) console.log('[chat] Found conversation:', convo);
    if (!convo) {
      if (DEBUG_CHAT) console.warn('[chat] Conversation not found in list');
      return;
    }

    // fetch messages fresh every time to avoid stale room state
    if (DEBUG_CHAT) console.log('[chat] Fetching messages for chat:', chatId);
    const msgs = await ChatAPI.getMessages(chatId);
    if (DEBUG_CHAT) console.log('[chat] Fetched messages:', msgs);
    messagesByChat.set(chatId, msgs);

    if (DEBUG_CHAT) console.log('[chat] Marking as read...');
    await ChatAPI.markRead(chatId);
    if (DEBUG_CHAT) console.log('[chat] Showing room...');
    showRoom(convo, messagesByChat.get(chatId));
  }

  // ----------------------------
  // Events
  // ----------------------------
  if (DEBUG_CHAT) {
    console.log('[chat] Initializing event listeners...');
    console.log('[chat] listMount:', listMount ? 'found' : 'NOT FOUND');
    console.log('[chat] roomHeader:', roomHeader ? 'found' : 'NOT FOUND');
    console.log('[chat] composer:', composer ? 'found' : 'NOT FOUND');
  }
  
  refreshBtn?.addEventListener("click", async () => {
    await loadConversations();
  });

  searchInput?.addEventListener("input", () => {
    renderList(filterList(searchInput.value));
  });

  listMount?.addEventListener("click", async (e) => {
    const item = e.target.closest(".chat-item");
    if (!item) {
      if (DEBUG_CHAT) console.log('[chat] Click handler fired but no .chat-item found');
      return;
    }
    const chatId = item.dataset.chatId;
    if (DEBUG_CHAT) console.log('[chat] Opening conversation:', chatId, typeof chatId);
    try {
      await openChat(chatId);
    } catch (err) {
      console.error('[chat] Error opening chat:', err);
    }
  });

  roomBackBtn?.addEventListener("click", () => {
    closeRoomOnMobile();
  });

  // header actions
  roomHeader?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;

    if (action === "open-profile") {
      // Read values from roomHeader dataset.
      const uid  = roomHeader.dataset.sellerId   || activeConversation?.sellerId   || "";
      const name = roomHeader.dataset.sellerName || activeConversation?.sellerName || "";

      if (DEBUG_CHAT) console.log('[chat] open-profile:', {
        uid,
        'roomHeader.dataset': JSON.stringify(roomHeader.dataset),
        'activeConversation': activeConversation,
      });

      if (!uid) {
        // Fallback: infer uid from message sender.
        const myId = myUserId();
        const msgs = messagesByChat.get(activeChatId) || [];
        const otherSender = msgs.find(m => m.sender_id && m.sender_id !== myId);
        if (DEBUG_CHAT) console.log('[chat] fallback sender:', otherSender?.sender_id, 'msgs:', msgs.length);
        if (otherSender?.sender_id) {
          if (window.navigateWithTransition) window.navigateWithTransition(`profile.html?uid=${encodeURIComponent(otherSender.sender_id)}`); else window.location.href = `profile.html?uid=${encodeURIComponent(otherSender.sender_id)}`;
          return;
        }
        showAlert(t('profile_not_found', 'ไม่พบข้อมูลโปรไฟล์'), 'error');
        return;
      }

      if (window.navigateWithTransition) window.navigateWithTransition(`profile.html?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`); else window.location.href = `profile.html?uid=${encodeURIComponent(uid)}&name=${encodeURIComponent(name)}`;
      return;
    }

    if (action === "call") {
      // Get phone from activeConversation or API.
      const phone = roomHeader.dataset.phone || activeConversation?.phone || null;
      if (phone) {
        // Dial on mobile.
        if (window.navigateWithTransition) window.navigateWithTransition(`tel:${phone.replace(/[^0-9+]/g, '')}`); else window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
      } else if (API_BASE && activeConversation?.sellerId) {
        // Load phone from API.
        fetch(`${API_BASE}/api/profiles/${activeConversation.sellerId}`, { headers: authHeaders() })
          .then(r => r.ok ? r.json() : null)
          .then(p => {
            const tel = p?.phone || '';
              if (tel) {
                const nextHref = `tel:${tel.replace(/[^0-9+]/g, '')}`;
                if (window.navigateWithTransition) window.navigateWithTransition(nextHref); else window.location.href = nextHref;
              }
            else window.appNotify(t('phone_not_found', 'ไม่พบเบอร์โทรของผู้ใช้รายนี้'), 'error');
          })
          .catch(() => window.appNotify(t('phone_fetch_failed', 'ไม่สามารถดึงเบอร์โทรได้'), 'error'));
      } else {
        window.appNotify(t('phone_not_found', 'ไม่พบเบอร์โทรของผู้ใช้รายนี้'), 'error');
      }
      return;
    }
  });

  // send message
  composer?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const text = (msgInput.value || "").trim();
    const hasImage = !!pendingImage;
    
    if (!text && !hasImage) return;

    const payload = {};
    if (text) payload.text = text;
    if (hasImage) {
      payload.contentType = "image";
      payload.imageData = pendingImage.imageData;
      payload.imageFile = pendingImage.imageFile;  // Required for FormData upload
    } else {
      payload.contentType = "text";
    }

    msgInput.value = "";
    pendingImage = null;
    composerPreview.style.display = "none";

    const sent = await ChatAPI.sendMessage(activeChatId, payload);

    const arr = messagesByChat.get(activeChatId) || [];
    arr.push(sent);
    messagesByChat.set(activeChatId, arr);

    // update convo preview/time
    const convo = conversations.find((x) => x.chatId === activeChatId);
    if (convo) {
      if (text) {
        convo.lastMessage = text;
      } else if (hasImage) {
        convo.lastMessage = "[Image]";
      } else {
        convo.lastMessage = text;
      }
      convo.lastTime = sent.time;
      // move to top
      conversations.sort((a, b) => b.lastTime - a.lastTime);
    }

    showRoom(convo, arr);
  });

  // attach image
  composer?.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="attach"]');
    if (!btn) return;
    imgInput?.click();
  });

  imgInput?.addEventListener("change", async () => {
    const file = imgInput.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      window.appNotify(t('image_too_large', 'รูปใหญ่เกินไป (เกิน 5MB)'), 'error');
      imgInput.value = "";
      return;
    }

    const uploaded = await ChatAPI.uploadImage(file);
    pendingImage = uploaded;

    previewImage.src = uploaded.imageData;
    composerPreview.style.display = "flex";
    imgInput.value = "";
  });

  previewRemoveBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    pendingImage = null;
    composerPreview.style.display = "none";
    imgInput.value = "";
  });

  // responsive: if switch to desktop, open first if none
  window.addEventListener("resize", async () => {
    if (isDesktop()) {
      document.body.classList.remove("chat-room-open");
    }
    if (isDesktop() && conversations.length && !activeChatId) {
      await openChat(conversations[0].chatId);
    }
  });

  // ----------------------------
  // Init: read ?chatId= from URL (opened from profile page)
  // ----------------------------
  async function init() {
    await loadConversations();
    const urlChatId = new URLSearchParams(window.location.search).get('chatId');
    if (urlChatId) {
      // If chatId comes from URL, auto-open it.
      const existing = conversations.find(x => String(x.chatId) === String(urlChatId));
      if (existing) {
        await openChat(existing.chatId);
      } else if (API_BASE) {
        // Load messages directly even if this room is not in list yet.
        const msgs = await ChatAPI.getMessages(urlChatId).catch(() => []);
        messagesByChat.set(urlChatId, msgs);
        // Query room info for real sellerId.
        let pseudo = {
          chatId: urlChatId, sellerId: '', sellerName: 'สนทนา',
          sellerSub: '', avatar: '', phone: '', lastMessage: '', lastTime: Date.now(), unread: 0,
        };
        try {
          const roomRes = await fetch(`${API_BASE}/api/chats`, { headers: authHeaders() });
          if (roomRes.ok) {
            const roomJson = await roomRes.json();
            const found = (roomJson.data || []).find(r => String(r.chatId) === String(urlChatId));
            if (found) pseudo = {
              chatId:      found.chatId,
              sellerId:    found.other_id,
              sellerName:  `${found.first_name||''} ${found.last_name||''}`.trim() || 'สนทนา',
              sellerSub:   '',
              avatar:      found.avatar || '',
              phone:       found.phone  || '',
              lastMessage: found.lastMessage || '',
              lastTime:    found.lastTime ? new Date(found.lastTime).getTime() : Date.now(),
              unread:      found.unread || 0,
            };
          }
        } catch (_) {}
        conversations.unshift(pseudo);
        renderList(filterList(''));
        await openChat(urlChatId);
      }
    }
  }
  init();

  // Heartbeat: update online status every 30 seconds.
  function startHeartbeat() {
    if (!API_BASE) return;
    const ping = () => fetch(API_BASE + '/api/presence/ping', {
      method: 'POST', headers: authHeaders()
    }).catch(() => {});
    ping(); // Ping immediately on start.
    setInterval(ping, 30000);
  }
  startHeartbeat();

  // Online indicator in room header.
  async function updateOnlineStatus(userId) {
    if (!userId || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/api/presence/${userId}`, { headers: authHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const dot = document.getElementById('onlineStatusDot');
      const txt = document.getElementById('onlineStatusText');
      if (dot) dot.style.background = json.online ? '#22c55e' : '#9ca3af';
      if (txt) {
        if (json.online) {
          txt.textContent = t('online', 'ออนไลน์');
          txt.style.color = '#22c55e';
        } else if (json.last_seen) {
          const mins = Math.floor((Date.now() - new Date(json.last_seen).getTime()) / 60000);
          txt.textContent = mins < 60 ? `${mins} ${t('minutes_ago', 'นาทีที่แล้ว')}` : t('offline', 'ออฟไลน์');
          txt.style.color = '#9ca3af';
        } else {
          txt.textContent = t('offline', 'ออฟไลน์');
          txt.style.color = '#9ca3af';
        }
      }
    } catch (_) {}
  }

  // Notify when new messages arrive.
  let lastMsgCount = new Map(); // chatId -> message count
  function notifyNewMessage(convo, newCount) {
    const prev = lastMsgCount.get(convo.chatId) || 0;
    if (newCount <= prev) return;
    lastMsgCount.set(convo.chatId, newCount);
    if (prev === 0) return; // Skip first-load notification.

    // Play notification sound.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}

    // Browser notification (when permission is granted).
    if (Notification.permission === 'granted' && document.hidden) {
      new Notification(t('new_message_from', 'ข้อความใหม่จาก') + ' ' + convo.sellerName, {
        body: convo.lastMessage || t('new_message', 'มีข้อความใหม่'),
        icon: convo.avatar || '',
      });
    }
  }

  // Request notification permission on page load.
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Update unread badge on bottom nav.
  async function updateUnreadBadge() {
    const clearBadge = () => {
      document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge, #chatBadge').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
      });
      document.title = t('chat_title', 'แชท | AGRIPRICE');
    };

    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!API_BASE || !token) {
      clearBadge();
      return;
    }

    try {
      const res = await fetch(API_BASE + '/api/chats/unread', { headers: authHeaders() });
      if (!res.ok) {
        clearBadge();
        return;
      }
      const json = await res.json();
      const count = json.unread_count || 0;
      // Update badge in bottom nav.
      document.querySelectorAll('.bottom-nav-item[data-page="chat"] .nav-badge, #chatBadge').forEach(el => {
        el.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
        el.style.display = count > 0 ? 'flex' : 'none';
      });
      // Update page title.
      document.title = count > 0 ? `(${count}) ${t('chat_title', 'แชท | AGRIPRICE')}` : t('chat_title', 'แชท | AGRIPRICE');
    } catch (_) {
      clearBadge();
    }
  }
  setInterval(updateUnreadBadge, 5000);
  updateUnreadBadge();

  // Auto-refresh messages every 10 seconds (polling).
  let pollTimer = null;
  function hasMessageListChanged(prev, next) {
    if (!Array.isArray(prev) || !Array.isArray(next)) return true;
    if (prev.length !== next.length) return true;
    if (!prev.length) return false;
    const a = prev[prev.length - 1] || {};
    const b = next[next.length - 1] || {};
    return String(a.id || '') !== String(b.id || '') || Number(a.time || 0) !== Number(b.time || 0) || String(a.text || '') !== String(b.text || '') || String(a.imageUrl || '') !== String(b.imageUrl || '');
  }

  function mergeConversations(updatedConvos) {
    const byId = new Map(conversations.map((c) => [String(c.chatId), c]));
    updatedConvos.forEach((nc) => {
      const key = String(nc.chatId);
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, { ...nc });
        return;
      }
      if (nc.unread > (existing.unread || 0) && String(nc.chatId) !== String(activeChatId)) {
        notifyNewMessage(nc, nc.unread);
      }
      existing.sellerId = nc.sellerId;
      existing.sellerName = nc.sellerName;
      existing.sellerSub = nc.sellerSub;
      existing.avatar = nc.avatar;
      existing.phone = nc.phone;
      existing.lastMessage = nc.lastMessage;
      existing.lastTime = nc.lastTime;
      existing.unread = nc.unread;
    });
    conversations = Array.from(byId.values()).sort((a, b) => b.lastTime - a.lastTime);
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const updatedConvos = await ChatAPI.listConversations();
        if (updatedConvos.length) {
          mergeConversations(updatedConvos);
          renderList(filterList(searchInput?.value || ''));
          updateUnreadBadge();
        }

        if (activeChatId) {
          const msgs = await ChatAPI.getMessages(activeChatId);
          const prev = messagesByChat.get(activeChatId) || [];
          if (hasMessageListChanged(prev, msgs)) {
            messagesByChat.set(activeChatId, msgs);
            const latestActive = conversations.find((x) => String(x.chatId) === String(activeChatId)) || activeConversation;
            showRoom(latestActive, msgs);
          }
        }
      } catch (_) {}
    }, 3000);
  }
  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  // เน€เธฃเธดเนเธก poll เนเธฅเธฐเธซเธขเธธเธ”เน€เธกเธทเนเธญเธญเธญเธเธเธฒเธเธซเธเนเธฒ
  startPolling();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
      loadConversations();
      updateUnreadBadge();
    }
  });
  window.addEventListener('focus', () => {
    loadConversations();
    updateUnreadBadge();
  });
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });

  window.addEventListener('i18n:updated', () => {
    renderList(filterList(searchInput?.value || ''));
    if (activeConversation && activeChatId && messagesByChat.has(activeChatId)) {
      showRoom(activeConversation, messagesByChat.get(activeChatId) || []);
    }
    updateUnreadBadge();
  });
});
