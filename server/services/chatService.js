const { supabaseAdmin } = require('../utils/supabase');

class ChatService {
  async listRooms(userId) {
    console.log('[ChatService] listRooms for userId:', userId);
    try {
      // 1. Get rooms first
      const { data: rooms, error: roomErr } = await supabaseAdmin
        .from('chat_rooms')
        .select(`
          *,
          user1:profiles!user1_id(profile_id, first_name, last_name, avatar),
          user2:profiles!user2_id(profile_id, first_name, last_name, avatar)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (roomErr) {
        console.error('[ChatService] listRooms Error (Querying rooms):', roomErr);
        throw roomErr;
      }

      if (!rooms || rooms.length === 0) return [];

      // 2. Map rooms and get last messages (to avoid complex joins that trigger "id not found" errors)
      const results = await Promise.all(rooms.map(async (room) => {
        // Detect primary key name (id or room_id)
        const roomId = room.room_id || room.id;
        
        const otherUser = room.user1.profile_id === userId ? room.user2 : room.user1;
        
        // Get last message and unread count for this room
        const { data: msgs, error: msgErr } = await supabaseAdmin
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false });

        if (msgErr) {
          console.warn(`[ChatService] Failed to fetch messages for room ${roomId}:`, msgErr.message);
        }

        const lastMsg = (msgs && msgs[0]) || {};
        const unreadCount = msgs ? msgs.filter(m => !m.is_read && m.sender_id !== userId).length : 0;

        return {
          room_id: roomId,
          other_user: {
            id: otherUser.profile_id,
            first_name: otherUser.first_name,
            last_name: otherUser.last_name,
            avatar: otherUser.avatar
          },
          last_message: lastMsg.message || '',
          last_message_type: lastMsg.image_url ? 'image' : 'text',
          last_message_at: lastMsg.created_at,
          unread_count: unreadCount
        };
      }));

      // Sort by last message date
      return results.sort((a, b) => {
        const dateA = new Date(a.last_message_at || 0);
        const dateB = new Date(b.last_message_at || 0);
        return dateB - dateA;
      });

    } catch (err) {
      console.error('[ChatService] listRooms Fatal Error:', err.message);
      throw err;
    }
  }

  async getMessages(roomId, userId) {
    console.log('[ChatService] getMessages for room:', roomId);
    // Security check: user must be in the room
    const { data: rooms, error: checkErr } = await supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('room_id', roomId);

    const room = rooms && rooms[0];
    if (checkErr || !room || (room.user1_id !== userId && room.user2_id !== userId)) {
      throw new Error('ไม่ได้รับอนุญาตให้เข้าถึงห้องแชทนี้');
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async sendMessage(roomId, senderId, message, imageUrl) {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        message,
        image_url: imageUrl,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async startChat(user1Id, user2Id) {
    const [u1, u2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];

    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .upsert({ user1_id: u1, user2_id: u2 }, { onConflict: 'user1_id, user2_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUnreadCount(userId) {
    console.log('[ChatService] getUnreadCount for userId:', userId);
    try {
      const { data: rooms, error: roomErr } = await supabaseAdmin
        .from('chat_rooms')
        .select('room_id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
      
      if (roomErr) throw roomErr;

      const roomIds = rooms?.map(r => r.room_id).filter(Boolean) || [];
      if (roomIds.length === 0) return 0;

      const { count: unreadCount, error: countErr } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('room_id', roomIds)
        .eq('is_read', false)
        .neq('sender_id', userId);

      if (countErr) throw countErr;
      return unreadCount || 0;
    } catch (err) {
      console.error('[ChatService] getUnreadCount Error:', err.message);
      return 0; // Return 0 instead of crashing for badge count
    }
  }

  async markAsRead(roomId, userId) {
    console.log('[ChatService] markAsRead for room:', roomId, 'by user:', userId);
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', userId)
      .select();

    if (error) throw error;
    return data;
  }
}

module.exports = new ChatService();
