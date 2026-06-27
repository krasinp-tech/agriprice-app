/**
 * Chat Controller - AgriPrice v3
 */
(function() {
    const state = window.AgriState;
    const API_BASE = (window.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

    async function listRooms() {
        const res = await fetch(`${API_BASE}/chats`, {
            headers: { 'Authorization': `Bearer ${state.getState().token}` }
        });
        const json = await res.json();
        return json.data;
    }

    async function getMessages(roomId) {
        const res = await fetch(`${API_BASE}/chats/${roomId}/messages`, {
            headers: { 'Authorization': `Bearer ${state.getState().token}` }
        });
        const json = await res.json();
        return json.data;
    }

    async function sendMessage(roomId, message) {
        const res = await fetch(`${API_BASE}/chats/${roomId}/messages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.getState().token}` 
            },
            body: JSON.stringify({ message })
        });
        const json = await res.json();
        return json.data;
    }

    window.AgriChat = { listRooms, getMessages, sendMessage };
})();
