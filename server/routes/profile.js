const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const response = require('../utils/response');
const { supabaseAdmin } = require('../utils/supabase');
const { toE164 } = require('../utils/helpers');

function parseMaybeJson(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return [value];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (_) {
    return String(value)
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function normalizeLinks(value) {
  const seen = new Set();
  return parseMaybeJson(value)
    .map((item) => {
      if (typeof item === 'string') {
        return { link_type: 'website', url: item.trim() };
      }
      return {
        link_type: String(item.link_type || item.type || 'website').trim() || 'website',
        url: String(item.url || item.href || '').trim(),
      };
    })
    .filter((item) => {
      if (!item.url) return false;
      const key = `${item.link_type}|${item.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeServices(value) {
  const seen = new Set();
  return parseMaybeJson(value)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      return String(item.service_name || item.name || item.service || '').trim();
    })
    .filter((serviceName) => {
      if (!serviceName || seen.has(serviceName)) return false;
      seen.add(serviceName);
      return true;
    });
}

async function attachProfileDetails(profile) {
  if (!profile) return profile;
  const [linksRes, servicesRes, offersCountRes] = await Promise.all([
    supabaseAdmin
      .from('profile_links')
      .select('id, link_type, url')
      .eq('profile_id', profile.profile_id)
      .order('id'),
    supabaseAdmin
      .from('profile_services')
      .select('id, service_name')
      .eq('profile_id', profile.profile_id)
      .order('id'),
    supabaseAdmin
      .from('buy_offers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.profile_id)
      .not('is_active', 'is', null),
  ]);

  return {
    ...profile,
    links: (linksRes.data || []).map((link) => ({
      id: link.id,
      link_type: link.link_type,
      type: link.link_type,
      url: link.url,
    })),
    services: (servicesRes.data || []).map((service) => service.service_name),
    profile_services: servicesRes.data || [],
    promoCount: offersCountRes.count || 0,
  };
}

async function replaceProfileLinks(profileId, rawLinks) {
  const links = normalizeLinks(rawLinks);
  const { error: deleteError } = await supabaseAdmin
    .from('profile_links')
    .delete()
    .eq('profile_id', profileId);
  if (deleteError) throw deleteError;
  if (links.length === 0) return;

  const { error } = await supabaseAdmin
    .from('profile_links')
    .insert(links.map((link) => ({ profile_id: profileId, ...link })));
  if (error) throw error;
}

async function replaceProfileServices(profileId, rawServices) {
  const services = normalizeServices(rawServices);
  const { error: deleteError } = await supabaseAdmin
    .from('profile_services')
    .delete()
    .eq('profile_id', profileId);
  if (deleteError) throw deleteError;
  if (services.length === 0) return;

  const { error } = await supabaseAdmin
    .from('profile_services')
    .insert(services.map((service_name) => ({ profile_id: profileId, service_name })));
  if (error) throw error;
}

/**
 * GET /api/profile (Current User)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, hero_image, followers_count, following_count, created_at, email, birth_date, account_status, lat, lng, tier, pro_started_at, pro_expires_at')
      .eq('profile_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(404).json(response.error('ไม่พบโปรไฟล์'));
    }
    res.json(await attachProfileDetails(data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
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
    const rawLinks = req.body.links;
    const rawServices = req.body.services;
    const hasLinksUpdate = Object.prototype.hasOwnProperty.call(req.body, 'links');
    const hasServicesUpdate = Object.prototype.hasOwnProperty.call(req.body, 'services');
    const fields = ['first_name','last_name','tagline','about','address_line1','address_line2','map_link','email','birth_date','account_status','lat','lng','hero_image'];
    const updates = {};

    if (req.body.account_status !== undefined) {
      if (!['active', 'disabled'].includes(req.body.account_status)) {
        return res.status(400).json(response.error('สถานะบัญชีไม่ถูกต้อง'));
      }
      const nonStatusFields = Object.keys(req.body).filter(key => key !== 'account_status');
      if (nonStatusFields.length > 0) {
        return res.status(400).json(response.error('กรุณาเปลี่ยนสถานะบัญชีแยกจากการแก้ไขข้อมูลอื่น'));
      }

      if (req.body.account_status === 'active' && req.user.accountStatus === 'disabled') {
        const { data: recoveryProfile, error: recoveryError } = await supabaseAdmin
          .from('profiles')
          .select('phone, password_hash')
          .eq('profile_id', req.user.id)
          .maybeSingle();
        if (recoveryError) throw recoveryError;
        if (!recoveryProfile?.password_hash || String(recoveryProfile.phone || '').startsWith('deleted-')) {
          return res.status(410).json(response.error('บัญชีนี้ถูกลบถาวรแล้วและไม่สามารถเปิดใช้งานใหม่ได้'));
        }
      }
    }
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

    if (!Object.keys(updates).length && !hasLinksUpdate && !hasServicesUpdate) {
      return res.status(400).json(response.error('ไม่มีข้อมูลที่จะอัปเดต'));
    }

    if (!req.user || !req.user.id) {
       return res.status(401).json(response.error('ไม่พบรหัสผู้ใช้ในระบบ'));
    }

    let error = null;
    if (Object.keys(updates).length > 0) {
      const result = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
      error = result.error;
    }
    
    // [FIXED] ดักจับ Error เฉพาะเจาะจง ไม่ตัด lat/lng ทิ้งถ้ามีคอลัมน์ใน DB แล้ว
    if (error && (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('relationship'))) {
      
      let modified = false;
      if (error.message.includes('lat')) {
        delete updates.lat;
        modified = true;
      }
      if (error.message.includes('lng')) {
        delete updates.lng;
        modified = true;
      }

      if (modified) {
        if (Object.keys(updates).length > 0) {
          const retry = await supabaseAdmin.from('profiles').update(updates).eq('profile_id', req.user.id);
          error = retry.error;
        } else {
          error = null;
        }
      }
    }

    if (error) {
      return res.status(500).json(response.error('Database Error: ' + error.message));
    }

    if (updates.account_status === 'disabled') {
      const disableResults = await Promise.all([
        supabaseAdmin.from('buy_offers').update({ is_active: false }).eq('user_id', req.user.id),
        supabaseAdmin.from('profiles').update({ last_seen: null }).eq('profile_id', req.user.id)
      ]);
      const disableError = disableResults.find(result => result.error)?.error;
      if (disableError) {
        await supabaseAdmin
          .from('profiles')
          .update({ account_status: 'active' })
          .eq('profile_id', req.user.id);
        throw disableError;
      }

      const revokeQuery = supabaseAdmin
        .from('device_sessions')
        .delete()
        .eq('user_id', req.user.id);
      const { error: revokeError } = req.user.sessionId
        ? await revokeQuery.neq('session_id', req.user.sessionId)
        : await revokeQuery;

      if (revokeError) {
        await supabaseAdmin
          .from('profiles')
          .update({ account_status: 'active' })
          .eq('profile_id', req.user.id);
        throw new Error('ไม่สามารถออกจากระบบอุปกรณ์อื่นได้ กรุณาลองใหม่');
      }
    }

    if (hasLinksUpdate) await replaceProfileLinks(req.user.id, rawLinks);
    if (hasServicesUpdate) await replaceProfileServices(req.user.id, rawServices);

    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, hero_image, followers_count, following_count, created_at, email, birth_date, account_status, lat, lng, tier, pro_started_at, pro_expires_at')
      .eq('profile_id', req.user.id)
      .single();
    
    res.json({
      success: true,
      message: 'อัปเดตโปรไฟล์สำเร็จ',
      data: await attachProfileDetails(updatedProfile || { profile_id: req.user.id, ...updates })
    });
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

/**
 * DELETE /api/profile
 */
router.delete('/', authMiddleware, async (req, res) => {
  try {
    // Keep an anonymized profile row so historical bookings retain valid foreign keys.
    // Do not delete auth.users first: profiles.profile_id references auth.users.id,
    // so that ordering leaves the account disabled and returns a foreign-key 500.
    const tombstonePhone = `deleted-${req.user.id}`;
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        phone: tombstonePhone,
        first_name: '',
        last_name: '',
        password_hash: null,
        avatar: null,
        tagline: null,
        about: null,
        address_line1: null,
        address_line2: null,
        map_link: null,
        hero_image: null,
        email: null,
        birth_date: null,
        lat: null,
        lng: null,
        last_seen: null,
        account_status: 'disabled',
        tier: 'free',
        pro_started_at: null,
        pro_expires_at: null
      })
      .eq('profile_id', req.user.id);
    if (error) throw error;

    const cleanupOperations = [
      ['buy_offers', supabaseAdmin.from('buy_offers').update({ is_active: null }).eq('user_id', req.user.id)],
      ['profile_links', supabaseAdmin.from('profile_links').delete().eq('profile_id', req.user.id)],
      ['profile_services', supabaseAdmin.from('profile_services').delete().eq('profile_id', req.user.id)],
      ['notification_settings', supabaseAdmin.from('notification_settings').delete().eq('user_id', req.user.id)],
      ['profile_favorites', supabaseAdmin.from('profile_favorites').delete().or(`owner_id.eq.${req.user.id},target_profile_id.eq.${req.user.id}`)],
      ['follows', supabaseAdmin.from('follows').delete().or(`follower_id.eq.${req.user.id},following_id.eq.${req.user.id}`)]
    ];
    const cleanupResults = await Promise.all(cleanupOperations.map(([, operation]) => operation));
    const failedCleanupIndex = cleanupResults.findIndex(result => result.error);
    if (failedCleanupIndex >= 0) {
      const [cleanupName] = cleanupOperations[failedCleanupIndex];
      throw new Error(`${cleanupName} cleanup failed: ${cleanupResults[failedCleanupIndex].error.message}`);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      ban_duration: '876000h',
      user_metadata: { account_deleted: true }
    });
    if (authError) throw authError;

    const { error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .delete()
      .eq('user_id', req.user.id);
    if (sessionError) throw sessionError;

    res.json(response.success('ลบบัญชีสำเร็จ'));
  } catch (e) {
    console.error('[Profile] Delete account failed:', e.message);
    res.status(500).json(response.error('ลบบัญชีไม่สำเร็จ กรุณาลองใหม่'));
  }
});

/**
 * GET /api/profiles/:userId (Public Profile)
 */
router.get('/:userId', async (req, res) => {
  try {
    if (!req.params.userId || req.params.userId === 'undefined') {
      return res.status(404).json(response.error('ไม่พบผู้ใช้'));
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_id, phone, email, first_name, last_name, role, avatar, tagline, about, address_line1, address_line2, map_link, hero_image, followers_count, following_count, created_at, lat, lng, account_status')
      .eq('profile_id', req.params.userId)
      .single();

    if (error || data?.account_status !== 'active') return res.status(404).json(response.error('ไม่พบผู้ใช้'));
    delete data.account_status;
    res.json(await attachProfileDetails(data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
