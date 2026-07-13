const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middlewares/auth');

router.get('/', authMiddleware, bookingController.listBookings);
router.get('/:id', authMiddleware, bookingController.getBooking);
router.get('/:id/queue-status', authMiddleware, bookingController.getQueueStatus);
router.post('/', authMiddleware, bookingController.createBooking);
router.patch('/:id/checkin', authMiddleware, bookingController.checkIn);
router.patch('/:id', authMiddleware, bookingController.updateStatus);

module.exports = router;
