const bookingService = require('../services/bookingService');
const response = require('../utils/response');

class BookingController {
  async listBookings(req, res) {
    try {
      const { id: userId, role } = req.user;
      const { status } = req.query;
      const result = await bookingService.listBookings(userId, role, status);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      console.error('[BookingController] listBookings Error:', e.message);
      res.status(e.statusCode || 500).json(response.error(e.message));
    }
  }

  async getBooking(req, res) {
    try {
      const result = await bookingService.getBookingDetail(req.params.id, req.user.id);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(e.statusCode || 404).json(response.error(e.message));
    }
  }

  async createBooking(req, res) {
    try {
      const result = await bookingService.createBooking(req.user.id, req.body);
      res.status(201).json(response.success('จองคิวสำเร็จ', result));
    } catch (e) {
      res.status(e.statusCode || 500).json(response.error(e.message));
    }
  }

  async updateStatus(req, res) {
    try {
      const { id: userId, role } = req.user;
      const result = await bookingService.updateBookingStatus(req.params.id, userId, role, req.body.status);
      res.json(response.success('อัปเดตสถานะสำเร็จ', result));
    } catch (e) {
      res.status(e.statusCode || 400).json(response.error(e.message));
    }
  }

  async checkIn(req, res) {
    try {
      const { id: userId, role } = req.user;
      const result = await bookingService.checkInBooking(req.params.id, userId, role);
      res.json(response.success('เช็คอินสำเร็จ', result));
    } catch (e) {
      res.status(e.statusCode || 400).json(response.error(e.message));
    }
  }

  async getQueueStatus(req, res) {
    try {
      const result = await bookingService.getQueueStatus(req.params.id, req.user.id);
      res.json(response.success('ดึงสถานะคิวสำเร็จ', result));
    } catch (e) {
      console.error('[BookingController] getQueueStatus Error:', e.message);
      res.status(e.statusCode || 500).json(response.error(e.message));
    }
  }
}

module.exports = new BookingController();
