/**
 * services/fileService.js
 * บันทึกไฟล์ไปยัง local disk หรือ Supabase Storage
 * ขึ้นอยู่กับ UPLOAD_MODE ใน .env
 */
const path    = require('path');
const fs      = require('fs');
const { createClient } = require('@supabase/supabase-js');

const UPLOAD_MODE   = process.env.UPLOAD_MODE   || 'supabase-storage';
const UPLOAD_DIR    = process.env.UPLOAD_DIR    || path.join(__dirname, '..', 'uploads');
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'agriprice';

let supabaseAdmin;
if (UPLOAD_MODE === 'supabase-storage') {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('❌ ต้องตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env');
  }
  supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

module.exports = { saveFile };