const offerService = require('../services/offerService');
const response = require('../utils/response');

class OfferController {
  async listOffers(req, res) {
    try {
      const result = await offerService.listOffers(req.query);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async getOffer(req, res) {
    try {
      const result = await offerService.getOfferById(req.params.id);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(404).json(response.error(e.message));
    }
  }

  async createOffer(req, res) {
    try {
      const result = await offerService.createOffer(req.user.id, req.body, req.file);
      res.status(201).json(response.success('สร้างประกาศสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async updateOffer(req, res) {
    try {
      const result = await offerService.updateOffer(req.params.id, req.user.id, req.body, req.file);
      res.json(response.success('อัปเดตประกาศสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async deleteOffer(req, res) {
    try {
      await offerService.deleteOffer(req.params.id, req.user.id);
      res.json(response.success('ลบประกาศสำเร็จ'));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async getSlots(req, res) {
    try {
      const result = await offerService.getOfferSlots(req.params.id);
      res.json(response.success('ดึงข้อมูลสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async createSlot(req, res) {
    try {
      const result = await offerService.createOfferSlot(req.user.id, req.params.id, req.body);
      res.status(201).json(response.success('สร้างคิวสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }
}

module.exports = new OfferController();
