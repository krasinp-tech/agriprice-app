const { supabaseAdmin } = require('../utils/supabase');

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function assertRoomMembership(roomId, userId) {
  const { data: room, error } = await supabaseAdmin
    .from('chat_rooms')
    .select('room_id, user1_id, user2_id')
    .eq('room_id', roomId)
    .maybeSingle();

  if (error) throw error;
  if (!room) throw createHttpError('Chat room not found', 404);
  if (String(room.user1_id) !== String(userId) && String(room.user2_id) !== String(userId)) {
    throw createHttpError('Forbidden', 403);
  }
  return room;
}

function normalizeRoomParticipants(user1Id, user2Id) {
  return String(user1Id) < String(user2Id) ? [user1Id, user2Id] : [user2Id, user1Id];
}

async function findRoomBetween(user1Id, user2Id) {
  const [firstRes, secondRes] = await Promise.all([
    supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('chat_rooms')
      .select('*')
      .eq('user1_id', user2Id)
      .eq('user2_id', user1Id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  if (firstRes.error) throw firstRes.error;
  if (secondRes.error) throw secondRes.error;

  const rooms = [firstRes.data, secondRes.data].filter(Boolean);
  return rooms.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))[0] || null;
}

async function getRoomDeletionMap(roomIds, userId) {
  if (!Array.isArray(roomIds) || roomIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('chat_room_deletions')
    .select('room_id, deleted_at')
    .eq('user_id', userId)
    .in('room_id', roomIds);

  if (error) {
    if (error.code === '42P01') return new Map();
    throw error;
  }

  return new Map((data || []).map((row) => [String(row.room_id), row.deleted_at]));
}

async function getRoomDeletedAt(roomId, userId) {
  const map = await getRoomDeletionMap([roomId], userId);
  return map.get(String(roomId)) || null;
}

function applyDeletedAfter(query, deletedAt) {
  return deletedAt ? query.gt('created_at', deletedAt) : query;
}

class ChatService {
  async listRooms(userId) {
    try {
      const { data: rooms, error: roomErr } = await supabaseAdmin
        .from('chat_rooms')
        .select(`
          *,
          user1:profiles!user1_id(profile_id, first_name, last_name, avatar),
          user2:profiles!user2_id(profile_id, first_name, last_name, avatar)
        `)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (roomErr) throw roomErr;
      if (!rooms || rooms.length === 0) return [];

      const roomIds = rooms.map((room) => room.room_id || room.id).filter(Boolean);
      const deletionMap = await getRoomDeletionMap(roomIds, userId);

      const results = await Promise.all(rooms.map(async (room) => {
        const roomId = room.room_id || room.id;
        const user1 = room.user1 || {};
        const user2 = room.user2 || {};
        const otherUser = String(user1.profile_id) === String(userId) ? user2 : user1;
        const deletedAt = deletionMap.get(String(roomId)) || null;

        let msgQuery = supabaseAdmin
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomId);
        msgQuery = applyDeletedAfter(msgQuery, deletedAt);
        msgQuery = msgQuery.order('created_at', { ascending: false });

        const { data: msgs, error: msgErr } = await msgQuery;

        if (msgErr) {
          console.warn(`[ChatService] Failed to fetch messages for room ${roomId}:`, msgErr.message);
        }

        if (deletedAt && (!msgs || msgs.length === 0)) return null;

        const lastMsg = (msgs && msgs[0]) || {};
        const unreadCount = msgs ? msgs.filter((m) => !m.is_read && String(m.sender_id) !== String(userId)).length : 0;

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

      return results.filter(Boolean).sort((a, b) => {
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
    await assertRoomMembership(roomId, userId);
    const deletedAt = await getRoomDeletedAt(roomId, userId);

    let query = supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId);
    query = applyDeletedAfter(query, deletedAt);
    query = query
      .order('created_at', { ascending: true })
      .limit(200);

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async sendMessage(roomId, senderId, message, imageUrl) {
    await assertRoomMembership(roomId, senderId);

    const hasText = String(message || '').trim().length > 0;
    const hasImage = String(imageUrl || '').trim().length > 0;
    if (!hasText && !hasImage) {
      throw createHttpError('Message or image is required');
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        message,
        image_url: imageUrl || null,
        is_read: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async startChat(user1Id, user2Id) {
    if (!user2Id) {
      throw createHttpError('target_user_id is required');
    }
    if (String(user1Id) === String(user2Id)) {
      throw createHttpError('Cannot start chat with yourself');
    }

    const [u1, u2] = normalizeRoomParticipants(user1Id, user2Id);
    const existing = await findRoomBetween(u1, u2);
    if (existing) return existing;

    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ user1_id: u1, user2_id: u2 })
      .select()
      .single();

    if (error && error.code === '23505') {
      const racedRoom = await findRoomBetween(u1, u2);
      if (racedRoom) return racedRoom;
    }

    if (error) throw error;
    return data;
  }

  async getUnreadCount(userId) {
    try {
      const { data: rooms, error: roomErr } = await supabaseAdmin
        .from('chat_rooms')
        .select('room_id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (roomErr) throw roomErr;

      const roomIds = rooms?.map((r) => r.room_id).filter(Boolean) || [];
      if (roomIds.length === 0) return 0;
      const deletionMap = await getRoomDeletionMap(roomIds, userId);

      const counts = await Promise.all(roomIds.map(async (roomId) => {
        let countQuery = supabaseAdmin
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)
          .eq('is_read', false)
          .neq('sender_id', userId);
        countQuery = applyDeletedAfter(countQuery, deletionMap.get(String(roomId)));

        const { count, error } = await countQuery;
        if (error) throw error;
        return count || 0;
      }));

      return counts.reduce((sum, count) => sum + count, 0);
    } catch (err) {
      console.error('[ChatService] getUnreadCount Error:', err.message);
      return 0;
    }
  }

  async markAsRead(roomId, userId) {
    await assertRoomMembership(roomId, userId);
    const deletedAt = await getRoomDeletedAt(roomId, userId);

    let updateQuery = supabaseAdmin
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', userId);
    updateQuery = applyDeletedAfter(updateQuery, deletedAt);

    const { data, error } = await updateQuery.select();

    if (error) throw error;
    return data;
  }

  async markAsUnread(roomId, userId) {
    await assertRoomMembership(roomId, userId);
    const deletedAt = await getRoomDeletedAt(roomId, userId);

    let latestQuery = supabaseAdmin
      .from('chat_messages')
      .select('message_id')
      .eq('room_id', roomId)
      .neq('sender_id', userId);
    latestQuery = applyDeletedAfter(latestQuery, deletedAt);
    latestQuery = latestQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latest, error: latestError } = await latestQuery;
    if (latestError) throw latestError;
    if (!latest) return null;

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .update({ is_read: false })
      .eq('message_id', latest.message_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteRoom(roomId, userId) {
    await assertRoomMembership(roomId, userId);

    const { data, error } = await supabaseAdmin
      .from('chat_room_deletions')
      .upsert({
        room_id: roomId,
        user_id: userId,
        deleted_at: new Date().toISOString(),
      }, { onConflict: 'room_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new ChatService();
