const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { supabaseAdmin } = require('../utils/supabase');
const { toE164, JWT_SECRET, signToken } = require('../utils/helpers');
const { saveFile } = require('../services/fileService');
const jwt = require('jsonwebtoken');

const DEV_OTP_MODE = process.env.OTP_MOCK !== 'false';

/**
 * GET /api/profile (Current User)
 */
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('profile_id, phone, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, links, hero_image, followers_count, following_count, created_at, email, birth_date, account_status')
    .eq('profile_id', req.user.id)
    .single();
    
  if (error) return res.status(404).json({ message: 'ไม่พบโปรไฟล์' });
  res.json(data);
});

/**
 * PATCH /api/profile
 */
router.patch('/', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const fields = ['first_name','last_name','tagline','about','address_line1','address_line2','map_link','links','email','birth_date','account_status'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.phone) {
      const otpCode = req.body.otp_code || req.headers['x-otp-code'] || null;
      if (DEV_OTP_MODE && otpCode === '123456') {
        updates.phone = toE164(req.body.phone);
      } else {
        const otpToken = req.headers['x-otp-token'] || req.body.otp_token || null;
        if (!otpToken) return res.status(403).json({ message: 'ต้องยืนยัน OTP ก่อนเปลี่ยนเบอร์โทร' });
        
        try {
          const payload = jwt.verify(otpToken, JWT_SECRET);
          if (!payload.otp_verified) throw new Error();
          updates.phone = toE164(req.body.phone);
        } catch (_) {
          return res.status(401).json({ message: 'OTP token หมดอายุ หรือไม่ถูกต้อง' });
        }
      }
    }

    if (req.file) {
       // Note: fileService logic usually expects saveFile(file, bucket)
       // I'll use a direct supabase storage call or the existing service if available
       const { saveFile } = require('../services/fileService');
       updates.avatar = await saveFile(req.file, 'avatars');
    }

    if (!Object.keys(updates).length) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

    const { error } = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
    if (error) throw error;
    
    res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * DELETE /api/profile
 */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('profiles').delete().eq('profile_id', req.user.id);
    if (error) throw error;

    await supabaseAdmin.auth.admin.deleteUser(req.user.id).catch(() => {});
    res.json({ message: 'ลบบัญชีสำเร็จ' });
  } catch (e) {
    res.status(500).json({ message: 'ลบบัญชีไม่สำเร็จ' });
  }
});

/**
 * GET /api/profiles/:userId (Public Profile)
 */
router.get('/:userId', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('profile_id, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, links, hero_image, followers_count, created_at')
    .eq('profile_id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
  res.json(data);
});

module.exports = router;
