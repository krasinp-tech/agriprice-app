/**
 * services/fileService.js
 * บันทึกไฟล์ไปยัง local disk หรือ Supabase Storage
 * ขึ้นอยู่กับ UPLOAD_MODE ใน .env
 */
const path    = require('path');
const fs      = require('fs');
const { supabaseAdmin } = require('../utils/supabase');

const UPLOAD_MODE    = process.env.UPLOAD_MODE || 'supabase-storage';
const UPLOAD_DIR     = process.env.UPLOAD_DIR  || path.join(__dirname, '..', 'uploads');
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'agriprice';

/**
 * บันทึกไฟล์จาก multer และคืน URL หรือ path
 * @param {Express.Multer.File} file  — ไฟล์จาก req.file
 * @param {string} folder             — โฟลเดอร์ปลายทาง เช่น 'avatars', 'products', 'chat'
 * @returns {Promise<string>}          — URL สาธารณะหรือ path ท้องถิ่น
 */
async function saveFile(file, folder = 'misc') {
  if (!file) throw new Error('ไม่พบไฟล์ที่จะบันทึก');

  const ext      = path.extname(file.originalname || '').toLowerCase() || guessExt(file.mimetype);
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  // ─── Local storage ──────────────────────────────────────────
  if (UPLOAD_MODE === 'local') {
    const destDir  = path.join(UPLOAD_DIR, folder);
    const destPath = path.join(UPLOAD_DIR, filename);
    fs.mkdirSync(destDir, { recursive: true });

    if (file.path) {
      // diskStorage: ย้ายไฟล์ที่ multer บันทึกไว้แล้ว
      fs.renameSync(file.path, destPath);
    } else if (file.buffer) {
      // memoryStorage fallback
      fs.writeFileSync(destPath, file.buffer);
    }

    return `/uploads/${filename}`;
  }

  // ─── Supabase Storage ────────────────────────────────────────
  const buffer      = file.buffer || fs.readFileSync(file.path);
  const contentType = file.mimetype || 'application/octet-stream';

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, { contentType, upsert: true });

  if (error) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ: ' + error.message);

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return data.publicUrl;
}

async function collectAccountFileUrls(userId) {
  const [profileResult, offersResult, paymentsResult, roomsResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('avatar, hero_image').eq('profile_id', userId).maybeSingle(),
    supabaseAdmin.from('buy_offers').select('image').eq('user_id', userId),
    supabaseAdmin.from('payment_submissions').select('slip_url').eq('user_id', userId),
    supabaseAdmin.from('chat_rooms').select('room_id').or(`user1_id.eq.${userId},user2_id.eq.${userId}`),
  ]);

  const failedResult = [profileResult, offersResult, paymentsResult, roomsResult].find(result => result.error);
  if (failedResult?.error) throw failedResult.error;

  const roomIds = (roomsResult.data || []).map(room => room.room_id).filter(Boolean);
  let chatImages = [];
  if (roomIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('image_url')
      .in('room_id', roomIds);
    if (error) throw error;
    chatImages = data || [];
  }

  return [
    profileResult.data?.avatar,
    profileResult.data?.hero_image,
    ...(offersResult.data || []).map(row => row.image),
    ...(paymentsResult.data || []).map(row => row.slip_url),
    ...chatImages.map(row => row.image_url),
  ].filter(Boolean);
}
function getStoredFilePath(fileUrl) {
  const value = String(fileUrl || '').trim();
  if (!value) return null;

  if (value.startsWith('/uploads/')) {
    return decodeURIComponent(value.slice('/uploads/'.length));
  }

  try {
    const parsed = new URL(value);
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(markerIndex + marker.length));
  } catch (_) {
    return null;
  }
}

async function deleteFilesByUrls(fileUrls) {
  const storedPaths = [...new Set((fileUrls || []).map(getStoredFilePath).filter(Boolean))];
  if (storedPaths.length === 0) return { deleted: 0 };

  if (UPLOAD_MODE === 'local') {
    const uploadRoot = path.resolve(UPLOAD_DIR);
    let deleted = 0;
    for (const storedPath of storedPaths) {
      const targetPath = path.resolve(uploadRoot, storedPath);
      if (!targetPath.startsWith(uploadRoot + path.sep)) continue;
      if (!fs.existsSync(targetPath)) continue;
      fs.unlinkSync(targetPath);
      deleted += 1;
    }
    return { deleted };
  }

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove(storedPaths);
  if (error) throw new Error('ลบไฟล์จาก Storage ไม่สำเร็จ: ' + error.message);
  return { deleted: storedPaths.length };
}
function guessExt(mimetype) {
  const map = {
    'image/jpeg':      '.jpg',
    'image/png':       '.png',
    'image/webp':      '.webp',
    'image/gif':       '.gif',
    'application/pdf': '.pdf',
  };
  return map[mimetype] || '';
}

module.exports = { saveFile, collectAccountFileUrls, deleteFilesByUrls };
