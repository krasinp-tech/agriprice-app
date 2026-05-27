/**
 * middlewares/upload.js
 * Multer middleware รองรับ local storage และ memory (Supabase Storage)
 * ควบคุมด้วย UPLOAD_MODE ใน .env: 'local' | 'supabase-storage'
 */
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const UPLOAD_MODE = process.env.UPLOAD_MODE || 'supabase-storage';
const UPLOAD_DIR  = process.env.UPLOAD_DIR  || path.join(__dirname, '..', 'uploads');
const MAX_SIZE_MB  = 10; // MB

// อนุญาตเฉพาะไฟล์รูปและ PDF
const ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `ไม่รองรับไฟล์ประเภท ${file.mimetype}`));
  }
}

let storage;

if (UPLOAD_MODE === 'local') {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });
} else {
  // supabase-storage: ใช้ memory แล้วให้ fileService อัปโหลดต่อ
  storage = multer.memoryStorage();
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

// Handle multer errors อย่าง graceful
function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: `ไฟล์ใหญ่เกิน ${MAX_SIZE_MB} MB` });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  next(err);
}

upload.handleMulterError = handleMulterError;

module.exports = upload;