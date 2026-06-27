const express = require('express');
const router = express.Router();
const offerController = require('../controllers/offerController');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Public routes
router.get('/', offerController.listOffers);
router.get('/:id', offerController.getOffer);
router.get('/:id/slots', offerController.getSlots);

// Protected routes (Buyer only - ideally add a role check middleware)
router.post('/', authMiddleware, upload.single('image'), offerController.createOffer);
router.patch('/:id', authMiddleware, upload.single('image'), offerController.updateOffer);
router.delete('/:id', authMiddleware, offerController.deleteOffer);
router.post('/:id/slots', authMiddleware, offerController.createSlot);

module.exports = router;
