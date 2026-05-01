const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { supabaseAdmin } = require('../utils/supabase');
const { saveFile } = require('../services/fileService');

/**
 * GET /api/chats
 * ดึงรายการห้องแชททั้งหมด
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .select(`
        room_id,
        user1:profiles!user1_id(profile_id, first_name, last_name, avatar),
        user2:profiles!user2_id(profile_id, first_name, last_name, avatar),
        chat_messages(message, created_at, is_read, sender_id)
      `)
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
      .order('created_at', { foreignTable: 'chat_messages', ascending: false });

    if (error) throw error;

    const result = (data || []).map(room => {
      const otherUser = room.user1.profile_id === uid ? room.user2 : room.user1;
      const lastMsg = room.chat_messages?.[0] || null;
      return {
        room_id: room.room_id,
        other_user: {
          id: otherUser.profile_id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          avatar: otherUser.avatar
        },
        last_message: lastMsg?.message || (lastMsg?.image_url ? '[รูปภาพ]' : ''),
        last_time: lastMsg?.created_at || room.created_at,
        unread_count: room.chat_messages?.filter(m => m.sender_id !== uid && !m.is_read).length || 0
      };
    });

    res.json(response.success('ดึงรายการแชทสำเร็จ', result));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/chats/unread
 * นับจำนวนข้อความที่ยังไม่ได้อ่านทั้งหมด
 */
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const { data: messages, error } = await supabaseAdmin
      .from('chat_messages')
      .select('message_id, room_id, chat_rooms!inner(user1_id, user2_id)')
      .eq('is_read', false)
      .neq('sender_id', uid)
      .or(`user1_id.eq.${uid},user2_id.eq.${uid}`, { foreignTable: 'chat_rooms' });

    if (error) throw error;

    res.json(response.success('ดึงจำนวนข้อความใหม่สำเร็จ', {
      unread_count: messages?.length || 0
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * GET /api/chats/:roomId/messages
 * ดึงประวัติข้อความในห้องแชท
 */
router.get('/:roomId/messages', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Mark as read
    await supabaseAdmin
      .from('chat_messages')
      .update({ is_read: true })
      .eq('room_id', roomId)
      .neq('sender_id', req.user.id);

    res.json(response.success('ดึงข้อมูลข้อความสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/chats/:roomId/messages
 * ส่งข้อความใหม่
 */
router.post('/:roomId/messages', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    
    const payload = {
      room_id: roomId,
      sender_id: req.user.id,
      message: message || ''
    };

    if (req.file) {
      payload.image_url = await saveFile(req.file, 'chats');
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(response.success('ส่งข้อความสำเร็จ', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * POST /api/chats/start
 * เริ่มแชทใหม่กับผู้ใช้
 */
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { target_user_id } = req.body;
    if (!target_user_id) return res.status(400).json(response.error('กรุณาระบุ target_user_id'));

    // Sort IDs to ensure uniqueness in room constraint
    const [u1, u2] = [req.user.id, target_user_id].sort();

    const { data, error } = await supabaseAdmin
      .from('chat_rooms')
      .upsert({ user1_id: u1, user2_id: u2 }, { onConflict: 'user1_id,user2_id' })
      .select()
      .single();

    if (error) throw error;
    res.json(response.success('พบ/สร้าง ห้องแชทสำเร็จ', { room_id: data.room_id }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
