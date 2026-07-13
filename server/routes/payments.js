const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const authMiddleware = require('../middlewares/auth');
const { signToken } = require('../utils/helpers');
const rateLimit = require('express-rate-limit');

// จำกัดการอัปเกรด: เพิ่มลิมิตเป็น 100 ครั้ง/ชั่วโมง เพื่อความสะดวกในการทดสอบของ Developer
const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'พยายามอัปเกรดบ่อยเกินไป กรุณารอสักครู่' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/payments/checkout
 * อัปเกรด tier เป็น "pro"
 */
router.post('/checkout', authMiddleware, checkoutLimiter, async (req, res) => {
  const userId = req.user.id;

  try {
    // ตรวจสอบ tier ปัจจุบันก่อน (idempotency guard)
    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('tier')
      .eq('profile_id', userId)
      .single();

    if (current?.tier === 'pro') {
      return res.json({ success: true, message: 'คุณเป็น PRO อยู่แล้ว', data: { tier: 'pro' } });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'pro' })
      .eq('profile_id', userId)
      .select('profile_id, phone, role, first_name, last_name')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'User not found in profiles');
    }

    const newToken = signToken({
      id: data.profile_id,
      phone: data.phone,
      role: data.role,
      tier: 'pro'
    });

    res.json({
      success: true,
      message: 'Payment successful. Upgraded to PRO.',
      data: { tier: 'pro', token: newToken }
    });

  } catch (e) {
    console.error('[Payment Error]', e);
    res.status(500).json({ success: false, error: 'Payment processing failed: ' + e.message });
  }
});

/**
 * POST /api/payments/cancel
 * ยกเลิก subscription — downgrade tier กลับเป็น "free"
 */
router.post('/cancel', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'free' })
      .eq('profile_id', userId)
      .select('profile_id, phone, role, first_name, last_name')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'User not found in profiles');
    }

    // ออก token ใหม่ที่มี tier: free
    const newToken = signToken({
      id: data.profile_id,
      phone: data.phone,
      role: data.role,
      tier: 'free'
    });

    res.json({
      success: true,
      message: 'Subscription cancelled. Downgraded to FREE.',
      data: { tier: 'free', token: newToken }
    });

  } catch (e) {
    console.error('[Cancel Subscription Error]', e);
    res.status(500).json({ success: false, error: 'Cancel failed: ' + e.message });
  }
});

module.exports = router;
