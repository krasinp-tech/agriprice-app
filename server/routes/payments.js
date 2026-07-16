const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { saveFile } = require('../services/fileService');
const { signToken } = require('../utils/helpers');
const rateLimit = require('express-rate-limit');

const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'ทำรายการชำระเงินบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

const planAmount = () => Number(process.env.PRO_PLAN_PRICE || 499);

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

async function issueProToken(userId) {
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
    token: signToken({ id: data.profile_id, phone: data.phone, role: data.role, tier: 'pro' }),
    startedAt: data.pro_started_at,
    expiresAt: data.pro_expires_at,
  };
}

router.get('/promptpay/qr', authMiddleware, paymentLimiter, async (req, res) => {
  try {
    const { msisdn } = easySlipConfig();
    const amount = planAmount();
    const result = await easySlipRequest('/v1/qr/generate', { type: 'PROMPTPAY', msisdn, amount });
    res.json({ success: true, data: { image: result.data.image, mime: result.data.mime, amount } });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post('/promptpay/verify', authMiddleware, paymentLimiter, upload.single('slip'), upload.handleMulterError, async (req, res) => {
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
      const membership = await issueProToken(userId);
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

router.get('/promptpay/status', authMiddleware, async (req, res) => {
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

router.post('/cancel', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('profiles')
      .select('profile_id, phone, role, tier, pro_expires_at')
      .eq('profile_id', req.user.id)
      .single();
    if (error || !data) throw new Error(error?.message || 'User not found');

    const expiresAt = data.pro_expires_at ? new Date(data.pro_expires_at) : null;
    const isActive = String(data.tier || '').toLowerCase() === 'pro'
      && (!expiresAt || expiresAt > new Date());
    const tier = isActive ? 'pro' : 'free';

    if (!isActive && String(data.tier || '').toLowerCase() !== 'free') {
      await supabaseAdmin.from('profiles').update({ tier: 'free' }).eq('profile_id', req.user.id);
    }

    const token = signToken({
      id: data.profile_id,
      phone: data.phone,
      role: data.role,
      tier,
      session_id: req.user.sessionId,
    });
    res.json({
      success: true,
      message: isActive ? 'ยกเลิกการต่ออายุแล้ว คุณยังใช้ PRO ได้จนถึงวันหมดอายุ' : 'แพ็กเกจ PRO หมดอายุแล้ว',
      data: { tier, token, pro_expires_at: data.pro_expires_at },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
