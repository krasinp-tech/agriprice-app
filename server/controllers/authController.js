const authService = require('../services/authService');
const response = require('../utils/response');

class AuthController {
  async sendOtp(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json(response.error('กรุณาระบุเบอร์โทรศัพท์'));
      const result = await authService.sendOtp(phone);
      res.json(response.success(result.message));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async verifyOtp(req, res) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) return res.status(400).json(response.error('กรุณาระบุ phone และ otp'));
      const result = await authService.verifyOtp(phone, otp);
      res.json(response.success('OTP ยืนยันสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async verifyFirebaseOtp(req, res) {
    try {
      const { idToken, phone } = req.body;
      if (!idToken || !phone) return res.status(400).json(response.error('กรุณาระบุ idToken และ phone'));
      const result = await authService.verifyFirebaseOtp(idToken, phone);
      res.json(response.success('ยืนยันตัวตน Firebase สำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async registerFinish(req, res) {
    try {
      console.log('[AuthController] RegisterFinish attempt with:', {
        hasToken: !!req.body.temp_token,
        role: req.body.role,
        hasProfile: !!req.body.profile
      });

      const result = await authService.registerFinish(req.body);
      res.status(201).json(response.success('สมัครสมาชิกสำเร็จ', result));
    } catch (e) {
      console.error('[AuthController] RegisterFinish Error:', e.message);
      res.status(500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + e.message));
    }
  }

  async login(req, res) {
    try {
      const { phone, email, password } = req.body;
      const identifier = phone || email;
      if (!identifier || !password) return res.status(400).json(response.error('กรุณากรอกข้อมูลให้ครบถ้วน'));

      const result = await authService.login(identifier, password);

      // Record active device session in background
      try {
        const { supabaseAdmin } = require('../utils/supabase');
        const { recordDeviceSession } = require('../routes/deviceSessions');
        await recordDeviceSession(supabaseAdmin, result.user.id, req);
      } catch (sessErr) {
        console.warn('[AuthController] Failed to record device session:', sessErr.message);
      }

      res.json(response.success('เข้าสู่ระบบสำเร็จ', result));
    } catch (e) {
      res.status(401).json(response.error(e.message));
    }
  }
}

module.exports = new AuthController();
