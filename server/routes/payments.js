const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const authMiddleware = require('../middlewares/auth');

/**
 * POST /api/payments/checkout
 * Mock endpoint for processing a subscription payment.
 * Upgrades the user's tier to "pro".
 */
router.post('/checkout', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. In a real app, integrate Omise/Stripe here.
    // For now, we simulate a successful payment and upgrade tier.

    // 2. Update user tier in Supabase
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ tier: 'pro' })
      .eq('profile_id', userId)
      .select('profile_id')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'User not found in profiles');
    }

    res.json({
      success: true,
      message: 'Payment successful. Upgraded to PRO.',
      data: { tier: 'pro' }
    });

  } catch (e) {
    console.error('[Payment Error]', e);
    res.status(500).json({ success: false, error: 'Payment processing failed: ' + e.message });
  }
});

module.exports = router;
