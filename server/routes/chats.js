const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// IMPORTANT: unread must come BEFORE :roomId
router.get('/unread', authMiddleware, chatController.getUnreadCount);
router.get('/', authMiddleware, chatController.listRooms);
router.get('/:roomId/messages', authMiddleware, chatController.getMessages);
router.post('/:roomId/messages', authMiddleware, (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    upload.single('image')(req, res, next);
  } else {
    next();
  }
}, chatController.sendMessage);
router.post('/start', authMiddleware, chatController.startChat);
router.patch('/:roomId/read', authMiddleware, chatController.markRead);
router.patch('/:roomId/unread', authMiddleware, chatController.markUnread);
router.delete('/:roomId', authMiddleware, chatController.deleteRoom);

module.exports = router;
