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
    .select('profile_id, phone, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, links, hero_image, followers_count, following_count, created_at, email, birth_date, account_status, lat, lng, tier')
    .eq('profile_id', req.user.id)
    .single();
    
  if (error || !data) {
    console.warn(`[Profile] Not found for ID: ${req.user.id}`);
    return res.status(404).json({ message: 'ไม่พบโปรไฟล์' });
  }
  console.log('[DEBUG] GET /api/profile result:', { profile_id: data.profile_id, tier: data.tier });
  res.json(data);
});

/**
 * PATCH /api/profile
 */
router.patch('/', authMiddleware, (req, res, next) => {
  // [FIX] ถ้าเป็น multipart (มีรูป) ใช้ multer
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    upload.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'hero_image', maxCount: 1 }
    ])(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
  try {
    console.log('[DEBUG] Profile Update Request:', { body: req.body, user: req.user });

    const fields = ['first_name','last_name','tagline','about','address_line1','address_line2','map_link','links','email','birth_date','account_status','lat','lng','hero_image','services'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (req.body.phone) {
      updates.phone = toE164(req.body.phone);
    }

    if (req.files) {
       const { saveFile } = require('../services/fileService');
       if (req.files['avatar']) {
         updates.avatar = await saveFile(req.files['avatar'][0], 'avatars');
       }
       if (req.files['hero_image']) {
         updates.hero_image = await saveFile(req.files['hero_image'][0], 'hero_images');
       }
    }

    if (!Object.keys(updates).length) return res.status(400).json({ message: 'ไม่มีข้อมูลที่จะอัปเดต' });

    if (!req.user || !req.user.id) {
       console.error('[DEBUG] No user ID found in request');
       return res.status(401).json({ message: 'ไม่พบรหัสผู้ใช้ในระบบ' });
    }

    let { error } = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
    
    // [FIX] ถ้า Error เพราะไม่มีคอลัมน์ lat/lng/services ให้ลองอัปเดตใหม่โดยตัดฟิลด์ที่อาจไม่มีออก
    if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
      console.warn('[DEBUG] Skipping some fields because columns might not exist in DB yet.');
      delete updates.lat;
      delete updates.lng;
      delete updates.services;
      const retry = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
      error = retry.error;
    }

    if (error) {
      console.error('[DEBUG] Supabase Update Error:', error);
      return res.status(500).json({ message: 'Database Error: ' + error.message });
    }
    
    console.log('[DEBUG] Profile Updated Successfully for:', req.user.id);
    res.json({ message: 'อัปเดตโปรไฟล์สำเร็จ' });
  } catch (e) {
    console.error('[DEBUG] Catch-all Error:', e);
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
  if (!req.params.userId || req.params.userId === 'undefined') {
    return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('profile_id, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, links, hero_image, followers_count, following_count, created_at, lat, lng')
    .eq('profile_id', req.params.userId)
    .single();

  if (error) return res.status(404).json({ message: 'ไม่พบผู้ใช้' });
  res.json(data);
});

module.exports = router;
