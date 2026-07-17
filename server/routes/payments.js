const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const authMiddleware = require('../middlewares/auth');
const { saveFile } = require('../services/fileService');
const { signToken } = require('../utils/helpers');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const PAYMENT_MAX_FILE_SIZE = 4 * 1024 * 1024;
const PAYMENT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Keep payment slips in memory until validation finishes. This avoids leaving
// rejected temporary files on disk when UPLOAD_MODE=local.
const paymentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PAYMENT_MAX_FILE_SIZE },
  fileFilter: (_req, file, callback) => {
    if (PAYMENT_IMAGE_TYPES.has(file.mimetype)) return callback(null, true);
    return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  },
});

function handlePaymentUploadError(error, _req, res, next) {
  if (!(error instanceof multer.MulterError)) return next(error);
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB' });
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'รองรับสลิปเฉพาะไฟล์ JPEG, PNG, WebP หรือ GIF' });
  }
  return res.status(400).json({ success: false, message: error.message });
}

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'ทำรายการชำระเงินบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

const configuredPlanAmount = Number(process.env.PRO_PLAN_PRICE || 499);
if (!Number.isFinite(configuredPlanAmount) || configuredPlanAmount <= 0) {
  throw new Error('PRO_PLAN_PRICE must be a positive number');
}
const PLAN_AMOUNT = Number(configuredPlanAmount.toFixed(2));
const planAmount = () => PLAN_AMOUNT;
const requireBuyer = (req, res, next) => {
  if (req.user?.role !== 'buyer') {
    return res.status(403).json({ success: false, message: 'แพ็กเกจ PRO นี้สำหรับบัญชีผู้รับซื้อเท่านั้น' });
  }
  next();
};

function easySlipConfig() {
  const apiKey = String(process.env.EASYSLIP_API_KEY || '').trim();
  const msisdn = String(process.env.PROMPTPAY_MSISDN || '').replace(/\D/g, '');
  if (!apiKey || !/^0\d{9}$/.test(msisdn)) {
    const error = new Error('ระบบพร้อมเพย์ยังตั้งค่าไม่ครบ');
    error.status = 503;
    throw error;
  }
  return { apiKey, msisdn };
}

async function easySlipRequest(path, body) {
  const { apiKey } = easySlipConfig();
  const response = await fetch(`https://api.easyslip.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false || (result.status && result.status !== 200)) {
    const error = new Error(result.error?.message || result.message || 'EasySlip ไม่สามารถทำรายการได้');
    error.code = result.error?.code || 'EASYSLIP_ERROR';
    error.status = response.status;
    throw error;
  }
  return result;
}

async function issueProToken(userId, sessionId) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setMonth(expiresAt.getMonth() + 1);
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ tier: 'pro', pro_started_at: startedAt.toISOString(), pro_expires_at: expiresAt.toISOString() })
    .eq('profile_id', userId)
    .select('profile_id, phone, role, pro_started_at, pro_expires_at')
    .single();
  if (error || !data) throw new Error(error?.message || 'ไม่พบบัญชีผู้ใช้');
  return {
    token: signToken({ id: data.profile_id, phone: data.phone, role: data.role, tier: 'pro', session_id: sessionId }),
    startedAt: data.pro_started_at,
    expiresAt: data.pro_expires_at,
  };
}

router.get('/plan', (_req, res) => {
  res.json({ success: true, data: { plan: 'pro', amount: planAmount(), duration_months: 1, auto_renew: false } });
});

router.get('/promptpay/qr', authMiddleware, requireBuyer, paymentLimiter, async (req, res) => {
  try {
    const { msisdn } = easySlipConfig();
    const amount = planAmount();
    const result = await easySlipRequest('/v1/qr/generate', { type: 'PROMPTPAY', msisdn, amount });
    res.json({ success: true, data: { image: result.data.image, mime: result.data.mime, amount } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post('/promptpay/verify', authMiddleware, requireBuyer, paymentLimiter, paymentUpload.single('slip'), handlePaymentUploadError, async (req, res) => {
  const userId = req.user.id;
  const amount = planAmount();
  if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบรูปสลิป' });
  if (req.file.size > 4 * 1024 * 1024) return res.status(400).json({ success: false, message: 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB' });

  let slipUrl = null;
  let verification = null;
  let verifyError = null;
  try {
    easySlipConfig();
    slipUrl = await saveFile(req.file, `payment-slips/${userId}`);
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    verification = await easySlipRequest('/v2/verify/bank', {
      base64,
      remark: `AGRIPRICE-PRO-${userId}`,
      matchAccount: true,
      matchAmount: amount,
      checkDuplicate: true,
    });
  } catch (error) {
    verifyError = error;
  }

  const verified = verification?.data;
  const transRef = verified?.rawSlip?.transRef || null;
  const amountMatched = verified?.isAmountMatched === true || Number(verified?.amountInSlip) === amount;
  const accountMatched = !!verified?.matchedAccount;
  const duplicate = verified?.isDuplicate === true;
  const status = verified && amountMatched && accountMatched && !duplicate ? 'approved' : 'pending';

  try {
    const { data: submission, error } = await supabaseAdmin
      .from('payment_submissions')
      .insert({
        user_id: userId,
        plan: 'pro',
        amount,
        method: 'promptpay',
        slip_url: slipUrl,
        trans_ref: transRef,
        status,
        verification_data: verification?.data || null,
        verification_error: verifyError?.message || (duplicate ? 'DUPLICATE_SLIP' : null),
        verified_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .select('payment_id,status,amount,created_at')
      .single();

    if (error) {
      if (String(error.code) === '23505') return res.status(409).json({ success: false, message: 'สลิปนี้ถูกใช้ยืนยันไปแล้ว' });
      throw error;
    }

    if (status === 'approved') {
      const membership = await issueProToken(userId, req.user.sessionId);
      return res.json({ success: true, message: 'ตรวจสอบสลิปสำเร็จ อัปเกรดเป็น PRO แล้ว', data: { ...submission, token: membership.token, tier: 'pro', pro_started_at: membership.startedAt, pro_expires_at: membership.expiresAt } });
    }

    return res.status(202).json({
      success: true,
      message: duplicate ? 'สลิปนี้อาจถูกใช้แล้ว จึงส่งให้เจ้าหน้าที่ตรวจสอบ' : 'รับสลิปแล้ว กำลังรอเจ้าหน้าที่ตรวจสอบ',
      data: submission,
    });
  } catch (error) {
    console.error('[PromptPay Verify Error]', error);
    res.status(500).json({ success: false, message: 'บันทึกการชำระเงินไม่สำเร็จ' });
  }
});

router.get('/promptpay/status', authMiddleware, requireBuyer, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('payment_submissions')
    .select('payment_id,status,amount,review_note,created_at,verified_at')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, data });
});

module.exports = router;
