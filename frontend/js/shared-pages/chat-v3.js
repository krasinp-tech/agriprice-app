/**
 * Chat Page Controller - AgriPrice v3
 */
(function() {
    const chat = window.AgriChat;
    const state = window.AgriState;

    const listMount = document.getElementById('chatListMount');
    const roomHeader = document.getElementById('roomHeader');
    const roomMessages = document.getElementById('roomMessages');
    const emptyState = document.getElementById('chatEmptyState');
    const composer = document.getElementById('chatComposer');
    const msgInput = document.getElementById('chatMessageInput');

    let activeRoomId = null;

    async function init() {
        const rooms = await chat.listRooms();
        renderRooms(rooms);
    }

    function renderRooms(rooms) {
        if (!rooms || rooms.length === 0) {
            listMount.innerHTML = '<div class="empty-state"><p>ยังไม่มีรายการแชท</p></div>';
            return;
        }

        listMount.innerHTML = rooms.map(r => `
            <div class="chat-item" data-id="${r.room_id}">
                <div class="chat-avatar"><img src="${r.other_user.avatar || '../../assets/images/avatar-guest.svg'}"></div>
                <div class="chat-info">
                    <div class="chat-name">${r.other_user.first_name} ${r.other_user.last_name}</div>
                    <div class="chat-last">${r.last_message || 'เริ่มการสนทนา'}</div>
                </div>
            </div>
        `).join('');

        listMount.querySelectorAll('.chat-item').forEach(el => {
            el.onclick = () => openRoom(el.dataset.id, rooms.find(r => r.room_id == el.dataset.id));
        });
    }

    async function openRoom(roomId, info) {
        activeRoomId = roomId;
        emptyState.style.display = 'none';
        roomHeader.style.display = 'flex';
        roomMessages.style.display = 'block';
        composer.style.display = 'flex';

        document.getElementById('roomName').textContent = `${info.other_user.first_name} ${info.other_user.last_name}`;
        
        const messages = await chat.getMessages(roomId);
        renderMessages(messages);
    }

    function renderMessages(messages) {
        const me = state.getState().user?.id;
        roomMessages.innerHTML = messages.map(m => `
            <div class="message ${m.sender_id === me ? 'me' : 'them'}">
                <div class="bubble">${m.message}</div>
            </div>
        `).join('');
        roomMessages.scrollTop = roomMessages.scrollHeight;
    }

    composer.onsubmit = async (e) => {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text || !activeRoomId) return;

        msgInput.value = '';
        await chat.sendMessage(activeRoomId, text);
        const messages = await chat.getMessages(activeRoomId);
        renderMessages(messages);
    };

    init();
})();
