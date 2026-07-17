const express = require('express');
const router = express.Router();
const response = require('../utils/response');
const { supabaseAdmin } = require('../utils/supabase');
const { getOptionalAuthUser } = require('../utils/helpers');
const { NORMALIZED_OFFER_SELECT, getOfferId, normalizeOffer } = require('../utils/offers');

function hasOfferPrice(offer) {
  return Array.isArray(offer?.grades) && offer.grades.length > 0;
}

async function searchProfiles(term, limit) {
  const select = 'id:profile_id, first_name, last_name, avatar, role, lat, lng, address_line2';

  if (!term) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(select)
      .eq('account_status', 'active')
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  const [firstNameRes, lastNameRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select(select)
      .eq('account_status', 'active')
      .ilike('first_name', `%${term}%`)
      .limit(limit),
    supabaseAdmin
      .from('profiles')
      .select(select)
      .eq('account_status', 'active')
      .ilike('last_name', `%${term}%`)
      .limit(limit),
  ]);

  if (firstNameRes.error) throw firstNameRes.error;
  if (lastNameRes.error) throw lastNameRes.error;

  const seen = new Set();
  return [...(firstNameRes.data || []), ...(lastNameRes.data || [])]
    .filter((row) => {
      const id = row.id || row.profile_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
}

async function searchOffers(term, limit) {
  if (!term) {
    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(normalizeOffer).filter(hasOfferPrice);
  }

  const pattern = `%${term}%`;
  const lookupLimit = Math.min(limit * 4, 200);
  const [descriptionRes, productNameRes, productCategoryRes, varietyNameRes, profileFirstNameRes, profileLastNameRes] = await Promise.all([
    supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .eq('is_active', true)
      .ilike('description', pattern)
      .order('created_at', { ascending: false })
      .limit(lookupLimit),
    supabaseAdmin
      .from('products')
      .select('product_id')
      .ilike('product_name', pattern)
      .limit(lookupLimit),
    supabaseAdmin
      .from('products')
      .select('product_id')
      .ilike('category', pattern)
      .limit(lookupLimit),
    supabaseAdmin
      .from('varieties')
      .select('variety_id')
      .ilike('variety_name', pattern)
      .limit(lookupLimit),
    supabaseAdmin
      .from('profiles')
      .select('profile_id')
      .eq('account_status', 'active')
      .ilike('first_name', pattern)
      .limit(lookupLimit),
    supabaseAdmin
      .from('profiles')
      .select('profile_id')
      .eq('account_status', 'active')
      .ilike('last_name', pattern)
      .limit(lookupLimit),
  ]);

  if (descriptionRes.error) throw descriptionRes.error;
  if (productNameRes.error) throw productNameRes.error;
  if (productCategoryRes.error) throw productCategoryRes.error;
  if (varietyNameRes.error) throw varietyNameRes.error;
  if (profileFirstNameRes.error) throw profileFirstNameRes.error;
  if (profileLastNameRes.error) throw profileLastNameRes.error;

  const productIds = [
    ...(productNameRes.data || []),
    ...(productCategoryRes.data || [])
  ].map((row) => row.product_id).filter(Boolean);

  let productVarietyIds = [];
  if (productIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('varieties')
      .select('variety_id')
      .in('product_id', [...new Set(productIds)])
      .limit(lookupLimit);
    if (error) throw error;
    productVarietyIds = (data || []).map((row) => row.variety_id).filter(Boolean);
  }

  const varietyIds = [
    ...(varietyNameRes.data || []).map((row) => row.variety_id),
    ...productVarietyIds,
  ].filter(Boolean);

  let varietyOfferRows = [];
  if (varietyIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .eq('is_active', true)
      .in('variety_id', [...new Set(varietyIds)])
      .order('created_at', { ascending: false })
      .limit(lookupLimit);
    if (error) throw error;
    varietyOfferRows = data || [];
  }

  const matchedProfileIds = [
    ...(profileFirstNameRes.data || []).map(r => r.profile_id),
    ...(profileLastNameRes.data || []).map(r => r.profile_id),
  ].filter(Boolean);

  let profileOfferRows = [];
  if (matchedProfileIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .eq('is_active', true)
      .in('user_id', [...new Set(matchedProfileIds)])
      .order('created_at', { ascending: false })
      .limit(lookupLimit);
    if (error) throw error;
    profileOfferRows = data || [];
  }

  const seen = new Set();
  return [...(descriptionRes.data || []), ...varietyOfferRows, ...profileOfferRows]
    .map(normalizeOffer)
    .filter((offer) => {
      if (!hasOfferPrice(offer)) return false;
      const id = getOfferId(offer);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, limit);
}

/**
 * GET /api/search?q=...
 */
router.get('/', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const safeLimit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 50);
    const term = String(q || '').trim();

    const [products, users] = await Promise.all([
      searchOffers(term, safeLimit),
      searchProfiles(term, safeLimit),
    ]);

    const optionalUser = getOptionalAuthUser(req);
    const viewerId = optionalUser?.id;
    if (products.length > 0) {
      const impressionsToInsert = products
        .filter(p => !viewerId || String(p.user_id) !== String(viewerId))
        .map(p => ({
          offer_id: getOfferId(p),
          viewer_id: viewerId || null
        }));

      if (impressionsToInsert.length > 0) {
        supabaseAdmin
          .from('offer_impressions')
          .insert(impressionsToInsert)
          .then(({ error: impError }) => {
            if (impError) console.error('[GET /api/search] Failed to log impressions:', impError.message);
          })
          .catch((err) => console.error('[GET /api/search] impression insert failed:', err.message));
      }
    }

    res.json(response.success('OK', {
      products,
      users,
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

module.exports = router;
