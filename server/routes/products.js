const express = require('express');
const router = express.Router();
const buyerRouter = express.Router();
const response = require('../utils/response');
const authMiddleware = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { supabaseAdmin } = require('../utils/supabase');
const { getOptionalAuthUser } = require('../utils/helpers');
const { saveFile } = require('../services/fileService');
const {
  NORMALIZED_OFFER_SELECT,
  getOfferId,
  normalizeOffer,
  parseGrades,
  replaceOfferGrades,
  resolveVarietyId,
} = require('../utils/offers');

function isDateSearch(value) {
  return /^(\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})$/.test(value || '');
}

function parseSearchDate(value) {
  let dateObj = new Date(value);
  if (isNaN(dateObj.getTime())) {
    const parts = String(value).split(/[-/]/);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
      dateObj = new Date(y, m, d);
    }
  }
  return isNaN(dateObj.getTime()) ? null : dateObj;
}

async function assertTierLimit(userId) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('tier')
    .eq('profile_id', userId)
    .single();

  if (profileError) throw new Error('Profile not found');

  const tier = (profile?.tier || 'free').toLowerCase();
  const limit = tier === 'pro' ? 10 : 3;
  const { count, error: countError } = await supabaseAdmin
    .from('buy_offers')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (countError) throw countError;
  if ((count || 0) >= limit) {
    throw Object.assign(new Error(tier === 'pro'
      ? 'PRO accounts can create up to 10 active buy offers'
      : 'FREE accounts can create up to 3 active buy offers'), { statusCode: 403 });
  }
}

function filterOffers(rows, { q, category }) {
  let filtered = rows;
  if (category && category !== 'undefined') {
    filtered = filtered.filter((row) => String(row.category || '') === String(category));
  }

  const term = String(q || '').trim().toLowerCase();
  if (term && !isDateSearch(term)) {
    filtered = filtered.filter((row) => [row.name, row.category, row.variety]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }
  return filtered;
}

async function fetchOfferById(productId) {
  const { data, error } = await supabaseAdmin
    .from('buy_offers')
    .select(NORMALIZED_OFFER_SELECT)
    .eq('offer_id', productId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeOffer(data) : null;
}

async function createOffer(userId, body, file) {
  const { name, category, variety, variety_id, price, grade, unit, grades, description } = body;
  if (!name && !variety_id) throw Object.assign(new Error('Product name is required'), { statusCode: 400 });

  const parsedGrades = parseGrades(grades);
  if (!price && parsedGrades.length === 0) {
    throw Object.assign(new Error('Price is required'), { statusCode: 400 });
  }

  const resolvedVarietyId = await resolveVarietyId(supabaseAdmin, {
    variety_id,
    name,
    category,
    variety,
  });

  const insertData = {
    user_id: userId,
    variety_id: resolvedVarietyId,
    description: description || null,
    unit: unit || 'กก.',
    is_active: true,
  };
  if (file) insertData.image = await saveFile(file, 'products');

  const { data, error } = await supabaseAdmin
    .from('buy_offers')
    .insert(insertData)
    .select('offer_id')
    .single();

  if (error) throw error;
  await replaceOfferGrades(supabaseAdmin, data.offer_id, parsedGrades, { price, grade });

  return fetchOfferById(data.offer_id);
}

async function updateOffer(productId, userId, body, file) {
  const { name, category, variety, variety_id, price, grade, unit, grades, description, is_active } = body;

  const existing = await fetchOfferById(productId);

  if (!existing) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  if (String(existing.user_id) !== String(userId)) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  const updates = {};
  if (name !== undefined || category !== undefined || variety !== undefined || variety_id !== undefined) {
    updates.variety_id = await resolveVarietyId(supabaseAdmin, {
      variety_id,
      name: name !== undefined ? name : existing.name,
      category: category !== undefined ? category : existing.category,
      variety: variety !== undefined ? variety : existing.variety,
    });
  }
  if (description !== undefined) updates.description = description || null;
  if (unit !== undefined) updates.unit = unit;
  if (is_active !== undefined) updates.is_active = is_active === true || is_active === 'true';
  if (file) updates.image = await saveFile(file, 'products');

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('buy_offers')
      .update(updates)
      .eq('offer_id', productId);
    if (error) throw error;
  }

  if (grades !== undefined || price !== undefined || grade !== undefined) {
    await replaceOfferGrades(supabaseAdmin, productId, grades, {
      price: price !== undefined ? price : existing.price,
      grade: grade !== undefined ? grade : existing.grade,
    });
  }

  return fetchOfferById(productId);
}

router.get('/', async (req, res) => {
  try {
    const { q, user_id, category, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 20);

    let query = supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .order('created_at', { ascending: false });

    if (!user_id) query = query.eq('is_active', true);
    if (user_id && user_id !== 'undefined') query = query.eq('user_id', user_id);

    if (q && isDateSearch(q)) {
      const dateObj = parseSearchDate(q);
      if (dateObj) {
        const start = new Date(dateObj).toISOString();
        const end = new Date(dateObj.setDate(dateObj.getDate() + 1)).toISOString();
        query = query.gte('created_at', start).lt('created_at', end);
      }
    }

    const hasTextSearch = q && !isDateSearch(q) && String(q || '').trim().length > 0;

    if (!hasTextSearch) {
      const from = (pageNumber - 1) * limitNumber;
      const to = from + limitNumber - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = filterOffers((data || []).map(normalizeOffer), { q, category });

    const from = (pageNumber - 1) * limitNumber;
    const pagedRows = hasTextSearch ? rows.slice(from, from + limitNumber) : rows;

    const optionalUser = getOptionalAuthUser(req);
    const viewerId = optionalUser?.id;
    if (pagedRows.length > 0 && (!user_id || String(user_id) !== String(viewerId))) {
      const impressionsToInsert = pagedRows.map((offer) => ({
        offer_id: getOfferId(offer),
        viewer_id: viewerId || null,
      }));
      supabaseAdmin
        .from('offer_impressions')
        .insert(impressionsToInsert)
        .then(({ error: impressionError }) => {
          if (impressionError) console.error('[GET /api/products] impression error:', impressionError.message);
        })
        .catch((err) => console.error('[GET /api/products] impression insert failed:', err.message));
    }

    res.json({
      success: true,
      data: pagedRows,
      total: rows.length,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (e) {
    console.error('[GET /api/products]', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'undefined' || isNaN(Number(req.params.id))) {
      return res.status(404).json(response.error('Product not found'));
    }

    const data = await fetchOfferById(req.params.id);
    if (!data) return res.status(404).json(response.error('Product not found'));
    res.json(response.success('OK', data));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.post('/', authMiddleware, upload.single('image'), upload.handleMulterError, async (req, res) => {
  try {
    await assertTierLimit(req.user.id);
    const data = await createOffer(req.user.id, req.body, req.file);
    res.status(201).json(response.success('Created', data));
  } catch (e) {
    res.status(e.statusCode || 500).json(response.error(e.message));
  }
});

router.patch('/:id', authMiddleware, upload.single('image'), upload.handleMulterError, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json(response.error('Invalid product id'));
    }
    const data = await updateOffer(req.params.id, req.user.id, req.body, req.file);
    res.json(response.success('Updated', data));
  } catch (e) {
    res.status(e.statusCode || 500).json(response.error(e.message));
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json(response.error('Invalid product id'));
    }
    const existing = await fetchOfferById(req.params.id);
    if (!existing) return res.status(404).json(response.error('Product not found'));
    if (String(existing.user_id) !== String(req.user.id)) {
      return res.status(403).json(response.error('Forbidden'));
    }

    const { error } = await supabaseAdmin
      .from('buy_offers')
      .update({ is_active: false })
      .eq('offer_id', req.params.id);

    if (error) throw error;
    res.json(response.success('Deleted'));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.get('/:id/slots', async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json(response.error('Invalid product id'));
    }
    const { data, error } = await supabaseAdmin
      .from('offer_slots')
      .select('*')
      .eq('offer_id', req.params.id)
      .eq('is_active', true)
      .order('time_start');

    if (error) throw error;
    const rows = (data || []).map((slot) => ({
      ...slot,
      product_id: slot.offer_id,
    }));
    res.json(response.success('OK', rows));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

router.post('/:id/slots', authMiddleware, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json(response.error('Invalid product id'));
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from('buy_offers')
      .select('user_id')
      .eq('offer_id', req.params.id)
      .maybeSingle();

    if (productError || !product) return res.status(404).json(response.error('Product not found'));
    if (String(product.user_id) !== String(req.user.id)) return res.status(403).json(response.error('Forbidden'));

    const payload = { ...req.body, offer_id: req.params.id };
    delete payload.product_id;
    const { data, error } = await supabaseAdmin
      .from('offer_slots')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(response.success('Created', {
      ...data,
      product_id: data.offer_id,
    }));
  } catch (e) {
    res.status(500).json(response.error(e.message));
  }
});

const requireBuyer = (req, res, next) => {
  if (req.user?.role !== 'buyer') return res.status(403).json(response.error('Buyer only'));
  next();
};

buyerRouter.post('/', authMiddleware, requireBuyer, upload.single('image'), upload.handleMulterError, async (req, res) => {
  try {
    await assertTierLimit(req.user.id);
    const data = await createOffer(req.user.id, req.body, req.file);
    res.status(201).json(response.success('Created', data));
  } catch (e) {
    res.status(e.statusCode || 500).json(response.error(e.message));
  }
});

buyerRouter.patch('/:id', authMiddleware, requireBuyer, upload.single('image'), upload.handleMulterError, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json(response.error('Invalid product id'));
    }
    const data = await updateOffer(req.params.id, req.user.id, req.body, req.file);
    res.json(response.success('Updated', data));
  } catch (e) {
    console.error('[PATCH buyer/products]', e.message);
    res.status(e.statusCode || 500).json(response.error(e.message));
  }
});

module.exports = { router, buyerRouter };
