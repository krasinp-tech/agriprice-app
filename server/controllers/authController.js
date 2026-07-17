const authService = require('../services/authService');
const response = require('../utils/response');

class AuthController {
  async checkPhone(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) return res.status(400).json(response.error('กรุณาระบุเบอร์โทรศัพท์'));
      const result = await authService.checkPhoneAvailability(phone);
      res.json(response.success('ตรวจสอบเบอร์โทรสำเร็จ', result));
    } catch (e) {
      res.status(e.statusCode || 500).json(response.error(e.message));
    }
  }

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
      const result = await authService.registerFinish(req.body);
      const { supabaseAdmin } = require('../utils/supabase');
      const { recordDeviceSession } = require('../services/deviceSessionService');
      const { signToken } = require('../utils/helpers');
      const sessionId = await recordDeviceSession(supabaseAdmin, result.user.id, req);
      if (!sessionId) throw new Error('ไม่สามารถสร้างเซสชันอุปกรณ์ได้');
      result.token = signToken({
        id: result.user.id,
        phone: result.user.phone,
        role: result.user.role,
        tier: result.user.tier || 'free',
        session_id: sessionId,
      });
      res.status(201).json(response.success('สมัครสมาชิกสำเร็จ', result));
    } catch (e) {
      console.error('[AuthController] RegisterFinish Error:', e.message);
      res.status(e.statusCode || 500).json(response.error('สมัครสมาชิกไม่สำเร็จ: ' + e.message));
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
        const { recordDeviceSession } = require('../services/deviceSessionService');
        const sessionId = await recordDeviceSession(supabaseAdmin, result.user.id, req);
        if (!sessionId) throw new Error('ไม่สามารถสร้างเซสชันอุปกรณ์ได้');
        const { signToken } = require('../utils/helpers');
        result.token = signToken({
          id: result.user.id,
          phone: result.user.phone,
          role: result.user.role,
          tier: result.user.tier || 'free',
          session_id: sessionId,
        });
      } catch (sessErr) {
        console.warn('[AuthController] Failed to record device session:', sessErr.message);
        return res.status(503).json(response.error('ไม่สามารถเริ่มเซสชันเข้าสู่ระบบได้ กรุณาลองใหม่'));
      }

      res.json(response.success('เข้าสู่ระบบสำเร็จ', result));
    } catch (e) {
      res.status(401).json(response.error(e.message));
    }
  }

  async passwordReset(req, res) {
    try {
      const { temp_token, password } = req.body;
      if (!temp_token || !password) return res.status(400).json(response.error('กรุณาระบุ temp_token และ password'));
      const result = await authService.passwordReset(temp_token, password);
      res.json(response.success('รีเซ็ตรหัสผ่านสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) return res.status(400).json(response.error('กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่'));
      const result = await authService.changePassword(req.user.id, current_password, new_password);
      res.json(response.success('เปลี่ยนรหัสผ่านสำเร็จ', result));
    } catch (e) {
      res.status(500).json(response.error(e.message));
    }
  }

  async logout(req, res) {
    try {
      const { supabaseAdmin } = require('../utils/supabase');
      const query = supabaseAdmin
        .from('device_sessions')
        .delete()
        .eq('user_id', req.user.id);
      const { error } = req.user.sessionId
        ? await query.eq('session_id', req.user.sessionId)
        : await query;
      if (error) throw error;
      res.json(response.success('Logged out'));
    } catch (e) {
      res.status(500).json(response.error('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'));
    }
  }
}

module.exports = new AuthController();
