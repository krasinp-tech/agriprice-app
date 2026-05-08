/**
 * AGRIPRICE - Chat Page JS
 */
document.addEventListener("DOMContentLoaded", () => {

  /* ── Elements ── */
  const listMount       = document.getElementById("chatListMount");
  const searchInput     = document.getElementById("chatSearchInput");
  const refreshBtn      = document.getElementById("chatRefreshBtn");
  const emptyState      = document.getElementById("chatEmptyState");
  const roomHeader      = document.getElementById("roomHeader");
  const roomMessages    = document.getElementById("roomMessages");
  const composer        = document.getElementById("chatComposer");
  const msgInput        = document.getElementById("chatMessageInput");
  const imgInput        = document.getElementById("chatImageInput");
  const composerPreview = document.getElementById("composerPreview");
  const previewImage    = document.getElementById("previewImage");
  const previewRemoveBtn = document.getElementById("previewRemoveBtn");
  const roomBackBtn     = document.getElementById("roomBackBtn");
  const roomName        = document.getElementById("roomName");
  const roomSub         = document.getElementById("roomSub");
  const roomAvatar      = document.getElementById("roomAvatar");

  let pendingImage = null;

  /* ── ChatAPI — ดึงข้อมูลจาก mockup.js โดยตรง ── */
  const ChatAPI = {
    async listConversations() {
      // join mockChatRooms, mockProfiles, mockProducts เพื่อสร้าง list รายการแชท
      const rooms = window.mockChatRooms || [];
      const profiles = window.mockProfiles || [];
      const products = window.mockProducts || [];
      const messages = window.mockChatMessages || [];
      // สมมุติ user ปัจจุบันคือ u2 (buyer)
      const currentUserId = "u2";
      return rooms.map(room => {
        // หาอีกฝั่ง (seller/farmer)
        const otherId = room.user1_id === currentUserId ? room.user2_id : room.user1_id;
        const seller = profiles.find(p => p.uuid === otherId) || {};
        // หา avatar จาก products ที่ user_id ตรงกับ seller
        const sellerProduct = products.find(p => p.user_id === otherId);
        const avatar = sellerProduct?.avatar || "";
        // หา last message
        const roomMsgs = messages.filter(m => m.room_id === room.id);
        const lastMsg = roomMsgs.length ? roomMsgs[roomMsgs.length - 1] : null;
        // นับ unread (is_read === false && sender_id !== currentUserId)
        const unread = roomMsgs.filter(m => !m.is_read && m.sender_id !== currentUserId).length;
        return {
          chatId: String(room.id),
          sellerId: otherId,
          sellerName: seller.first_name + (seller.last_name ? " " + seller.last_name : ""),
          sellerSub: seller.role === "farmer" ? "ผู้ขาย" : "ผู้ซื้อ",
          avatar,
          lastMessage: lastMsg ? (lastMsg.content_type === "image" ? "[รูปภาพ]" : lastMsg.message) : "-",
          lastTime: lastMsg ? new Date(lastMsg.time).getTime() : 0,
          unread
        };
      });
    },

    async getMessages(chatId) {
      const messages = window.mockChatMessages || [];
      const roomId = Number(chatId);
      // สมมุติ user ปัจจุบันคือ u2 (buyer)
      const currentUserId = "u2";
      return messages.filter(m => m.room_id === roomId).map(m => ({
        from: m.sender_id === currentUserId ? "me" : "them",
        text: m.content_type === "text" ? m.message : undefined,
        imageUrl: m.content_type === "image" ? m.image_url : undefined,
        imageData: m.content_type === "image" ? m.image_url : undefined,
        time: new Date(m.time).getTime(),
        contentType: m.content_type,
        status: m.status
      }));
    },

    async sendMessage(chatId, payload) {
      // สมมุติ user ปัจจุบันคือ u2 (buyer)
      const currentUserId = "u2";
      const messages = window.mockChatMessages;
      const newId = messages.length ? Math.max(...messages.map(m => m.id)) + 1 : 1;
      const now = new Date();
      let msgObj = {
        id: newId,
        room_id: Number(chatId),
        sender_id: currentUserId,
        is_read: false,
        time: now.toISOString(),
        content_type: payload.contentType,
        status: "sent"
      };
      if (payload.contentType === "image") {
        msgObj.message = "";
        msgObj.image_url = payload.imageData;
      } else {
        msgObj.message = payload.text;
      }
      messages.push(msgObj);
      return {
        from: "me",
        text: msgObj.content_type === "text" ? msgObj.message : undefined,
        imageUrl: msgObj.content_type === "image" ? msgObj.image_url : undefined,
        imageData: msgObj.content_type === "image" ? msgObj.image_url : undefined,
        time: new Date(msgObj.time).getTime(),
        contentType: msgObj.content_type,
        status: msgObj.status
      };
    },

    async uploadImage(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          imageData: reader.result,
          uploadId: "temp-" + Date.now()
        });
        reader.readAsDataURL(file);
      });
    },

    async markRead(chatId) {
      // สมมุติ user ปัจจุบันคือ u2 (buyer)
      const currentUserId = "u2";
      const messages = window.mockChatMessages || [];
      messages.forEach(m => {
        if (m.room_id === Number(chatId) && m.sender_id !== currentUserId) {
          m.is_read = true;
          m.status = "read";
        }
      });
      return true;
    }
  };

  /* ── State ── */
  let conversations     = [];
  let activeChatId      = null;
  let activeConversation = null;
  let messagesByChat    = new Map();

  /* ── Utils ── */
  const TH_TZ = "Asia/Bangkok";

  function isValidTimestamp(ts) {
    return Number.isFinite(Number(ts));
  }

  function isSameCalendarDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth()    &&
      a.getDate()     === b.getDate()
    );
  }

  function listTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    const target = new Date(Number(ts));
    const now    = new Date();
    if (isSameCalendarDay(target, now)) {
      return new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit", minute: "2-digit",
        hour12: false, timeZone: TH_TZ
      }).format(target);
    }
    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      timeZone: TH_TZ
    }).format(target);
  }

  function dateTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      hour12: false, timeZone: TH_TZ
    }).format(new Date(Number(ts)));
  }

  function messageTimeLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    return new Intl.DateTimeFormat("th-TH", {
      hour: "2-digit", minute: "2-digit",
      hour12: false, timeZone: TH_TZ
    }).format(new Date(Number(ts)));
  }

  function getDateKeyInTimeZone(ts, timeZone) {
    if (!isValidTimestamp(ts)) return "";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date(Number(ts)));
    const y = parts.find(p => p.type === "year")?.value  || "0000";
    const m = parts.find(p => p.type === "month")?.value || "00";
    const d = parts.find(p => p.type === "day")?.value   || "00";
    return `${y}-${m}-${d}`;
  }

  function messageDateSeparatorLabel(ts) {
    if (!isValidTimestamp(ts)) return "-";
    return new Intl.DateTimeFormat("th-TH", {
      weekday: "short", day: "2-digit", month: "short",
      year: "numeric", timeZone: TH_TZ
    }).format(new Date(Number(ts)));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  function isDesktop() {
    return window.matchMedia("(min-width: 768px)").matches;
  }

  function setMobileRoomMode(isOpen) {
    if (isDesktop()) { document.body.classList.remove("chat-room-open"); return; }
    document.body.classList.toggle("chat-room-open", !!isOpen);
  }

  /* ── Render: List ── */
  function renderList(list) {
    listMount.innerHTML = "";

    if (!list.length) {
      listMount.innerHTML = `
        <div style="padding:16px;color:#666;font-size:14px;">
          ไม่พบแชทที่ตรงกับคำค้นหา
        </div>`;
      return;
    }

    list.forEach((c) => {
      const active    = c.chatId === activeChatId ? " active" : "";
      const unread    = c.unread > 0
        ? `<div class="chat-item-unread">${c.unread}</div>` : "";
      const avatarImg = c.avatar
        ? `<img src="${escapeHtml(c.avatar)}" alt="">` : "👤";

      const el = document.createElement("div");
      el.className          = "chat-item" + active;
      el.dataset.chatId     = c.chatId;
      el.dataset.sellerId   = c.sellerId;
      el.dataset.sellerName = c.sellerName;

      el.innerHTML = `
        <div class="chat-item-avatar">${avatarImg}</div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <div class="chat-item-name">${escapeHtml(c.sellerName)}</div>
            <div class="chat-item-time"
                 title="${escapeHtml(dateTimeLabel(c.lastTime))}">
              ${escapeHtml(listTimeLabel(c.lastTime))}
            </div>
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

  /* ── Render: Room ── */
  function showRoom(convo, msgs) {
    activeChatId       = convo.chatId;
    activeConversation = convo;
    setMobileRoomMode(true);

    roomName.textContent      = convo.sellerName || "-";
    roomSub.textContent       = "ออนไลน์";
    roomAvatar.innerHTML      = convo.avatar
      ? `<img src="${escapeHtml(convo.avatar)}" alt="">` : "👤";
    roomAvatar.style.overflow = "hidden";

    emptyState.style.display   = "none";
    roomHeader.style.display   = "flex";
    roomMessages.style.display = "block";
    composer.style.display     = "flex";

    let previousDateKey = "";
    roomMessages.innerHTML = msgs.map((m) => {
      const cls            = m.from === "me" ? "msg me" : "msg them";
      const currentDateKey = getDateKeyInTimeZone(m.time, TH_TZ);
      const shouldShowDate = currentDateKey && currentDateKey !== previousDateKey;
      previousDateKey      = currentDateKey;

      const dateSeparator = shouldShowDate
        ? `<div class="msg-date-separator">
             <span>${escapeHtml(messageDateSeparatorLabel(m.time))}</span>
           </div>`
        : "";

      let contentHtml = "";
      if (m.contentType === "image" && (m.imageData || m.imageUrl)) {
        contentHtml = `<img src="${escapeHtml(m.imageUrl || m.imageData)}"
                            class="bubble-image" alt="แชทรูป" />`;
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

    roomMessages.scrollTop = roomMessages.scrollHeight;

    // mark read in UI
    const found = conversations.find(x => x.chatId === convo.chatId);
    if (found) found.unread = 0;
    renderList(filterList(searchInput.value));
  }

  function closeRoomOnMobile() {
    if (isDesktop()) return;
    activeChatId       = null;
    activeConversation = null;
    setMobileRoomMode(false);

    emptyState.style.display   = "block";
    roomHeader.style.display   = "none";
    roomMessages.style.display = "none";
    composer.style.display     = "none";

    renderList(filterList(searchInput.value));
  }

  /* ── Filter ── */
  function filterList(q) {
    const query = (q || "").trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter(c =>
      (c.sellerName  || "").toLowerCase().includes(query) ||
      (c.sellerSub   || "").toLowerCase().includes(query) ||
      (c.lastMessage || "").toLowerCase().includes(query)
    );
  }

  /* ── Load ── */
  async function loadConversations() {
    conversations = await ChatAPI.listConversations();
    conversations.sort((a, b) => b.lastTime - a.lastTime);
    renderList(filterList(searchInput.value));

    if (isDesktop() && conversations.length && !activeChatId) {
      await openChat(conversations[0].chatId);
    }
  }

  async function openChat(chatId) {
    const convo = conversations.find(x => x.chatId === chatId);
    if (!convo) return;

    if (!messagesByChat.has(chatId)) {
      messagesByChat.set(chatId, await ChatAPI.getMessages(chatId));
    }

    await ChatAPI.markRead(chatId);
    showRoom(convo, messagesByChat.get(chatId));
  }

  /* ── Events ── */
  refreshBtn?.addEventListener("click", loadConversations);

  searchInput?.addEventListener("input", () => {
    renderList(filterList(searchInput.value));
  });

  listMount.addEventListener("click", async (e) => {
    const item = e.target.closest(".chat-item");
    if (!item) return;
    await openChat(item.dataset.chatId);
  });

  roomBackBtn?.addEventListener("click", closeRoomOnMobile);

  roomHeader.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    if (btn.dataset.action === "open-profile") {
      const name = activeConversation?.sellerName || "";
      window.location.href =
        `../pages/shared/profile.html?name=${encodeURIComponent(name)}`;
    }

    if (btn.dataset.action === "call") {
      alert("กำลังพัฒนา: โทรหาผู้รับซื้อ");
    }
  });

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const text     = (msgInput.value || "").trim();
    const hasImage = !!pendingImage;
    if (!text && !hasImage) return;

    const payload = {};
    if (hasImage) {
      payload.contentType = "image";
      payload.imageData   = pendingImage.imageData;
    } else {
      payload.contentType = "text";
      payload.text        = text;
    }

    msgInput.value = "";
    pendingImage   = null;
    composerPreview.style.display = "none";

    const sent = await ChatAPI.sendMessage(activeChatId, payload);
    const arr  = messagesByChat.get(activeChatId) || [];
    arr.push(sent);
    messagesByChat.set(activeChatId, arr);

    const convo = conversations.find(x => x.chatId === activeChatId);
    if (convo) {
      convo.lastMessage = hasImage ? "[รูปภาพ]" : text;
      convo.lastTime    = sent.time;
      conversations.sort((a, b) => b.lastTime - a.lastTime);
    }

    showRoom(convo, arr);
  });

  composer.addEventListener("click", (e) => {
    if (e.target.closest('[data-action="attach"]')) imgInput.click();
  });

  imgInput.addEventListener("change", async () => {
    const file = imgInput.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("รูปใหญ่เกินไป (เกิน 5MB)");
      imgInput.value = "";
      return;
    }

    const uploaded   = await ChatAPI.uploadImage(file);
    pendingImage     = uploaded;
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

  window.addEventListener("resize", async () => {
    if (isDesktop()) document.body.classList.remove("chat-room-open");
    if (isDesktop() && conversations.length && !activeChatId) {
      await openChat(conversations[0].chatId);
    }
  });

  /* ── Init ── */
  loadConversations();
});