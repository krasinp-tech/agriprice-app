const chatService = require('../services/chatService');
const response = require('../utils/response');

class ChatController {
  async listRooms(req, res) {
    try {
      const result = await chatService.listRooms(req.user.id);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async getMessages(req, res) {
    try {
      const result = await chatService.getMessages(req.params.roomId, req.user.id);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async sendMessage(req, res) {
    try {
      const { roomId } = req.params;
      let { message, image_url } = req.body;

      if (req.file) {
        const { saveFile } = require('../services/fileService');
        image_url = await saveFile(req.file, 'chats');
      }

      const result = await chatService.sendMessage(roomId, req.user.id, message, image_url);
      res.json(response.success('ส่งข้อความสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async startChat(req, res) {
    try {
      const { target_user_id } = req.body;
      const result = await chatService.startChat(req.user.id, target_user_id);
      res.json(response.success('เริ่มแชทสำเร็จ', { room_id: result.room_id }));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async getUnreadCount(req, res) {
    try {
      const count = await chatService.getUnreadCount(req.user.id);
      res.json(response.success('ดึงจำนวนข้อความที่ยังไม่อ่านสำเร็จ', { unread_count: count }));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async markRead(req, res) {
    try {
      const { roomId } = req.params;
      const result = await chatService.markAsRead(roomId, req.user.id);
      res.json(response.success('อ่านข้อความสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }
}

module.exports = new ChatController();
