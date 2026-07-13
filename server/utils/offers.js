const NORMALIZED_OFFER_SELECT = `
  offer_id,
  product_id:offer_id,
  user_id,
  description,
  unit,
  image,
  is_active,
  created_at,
  updated_at,
  variety_id,
  profiles!user_id(profile_id, first_name, last_name, phone, avatar, address_line1, address_line2, map_link, lat, lng),
  variety_ref:varieties!variety_id(
    variety_id,
    variety_name,
    product_ref:products!product_id(product_id, product_name, category)
  ),
  offer_grades!offer_id(id, grade_name, price)
`;

function parseGrades(grades) {
  if (!grades) return [];
  if (Array.isArray(grades)) return grades;
  try {
    const parsed = JSON.parse(grades);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function normalizeOffer(row) {
  if (!row) return row;

  const varietyRef = row.variety_ref || null;
  const productRef = varietyRef?.product_ref || null;
  const grades = (row.offer_grades || []).map((grade) => ({
    id: grade.id,
    grade: grade.grade_name,
    grade_name: grade.grade_name,
    price: Number(grade.price || 0),
  }));
  const firstGrade = grades[0] || {};
  const fallbackName = row.name || row.description || 'สินค้าเกษตร';
  const offerId = getOfferId(row);

  const normalized = {
    ...row,
    offer_id: offerId,
    product_id: offerId,
    name: productRef?.product_name || fallbackName,
    category: productRef?.category || row.category || 'สินค้าเกษตร',
    variety: varietyRef?.variety_name || row.variety || null,
    grade: firstGrade.grade_name || row.grade || null,
    price: Number(firstGrade.price ?? row.price ?? 0),
    grades,
  };

  delete normalized.variety_ref;
  delete normalized.offer_grades;
  return normalized;
}

async function resolveVarietyId(supabaseAdmin, { variety_id, name, category, variety }) {
  if (variety_id) return Number(variety_id);

  const productName = String(name || '').trim();
  if (!productName) return null;

  const categoryName = String(category || productName).trim();
  const varietyName = String(variety || productName).trim();

  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .upsert(
      { product_name: productName, category: categoryName },
      { onConflict: 'product_name' }
    )
    .select('product_id')
    .single();

  if (productError) throw productError;

  const { data: varietyRow, error: varietyError } = await supabaseAdmin
    .from('varieties')
    .upsert(
      { product_id: product.product_id, variety_name: varietyName },
      { onConflict: 'product_id,variety_name' }
    )
    .select('variety_id')
    .single();

  if (varietyError) throw varietyError;
  return varietyRow.variety_id;
}

function getOfferId(row) {
  return row?.offer_id ?? row?.product_id ?? null;
}

async function replaceOfferGrades(supabaseAdmin, offerId, grades, fallback = {}) {
  const parsedGrades = parseGrades(grades);
  const rows = parsedGrades.length > 0
    ? parsedGrades
    : (fallback.price !== undefined
      ? [{ grade: fallback.grade || 'คละ', price: fallback.price }]
      : []);

  const { error: deleteError } = await supabaseAdmin
    .from('offer_grades')
    .delete()
    .eq('offer_id', offerId);

  if (deleteError) throw deleteError;

  if (rows.length === 0) return;

  const inserts = rows.map((row) => ({
    offer_id: offerId,
    grade_name: row.grade_name || row.grade || 'คละ',
    price: Number(row.price || 0),
  }));

  const { error: insertError } = await supabaseAdmin
    .from('offer_grades')
    .insert(inserts);

  if (insertError) throw insertError;
}

module.exports = {
  NORMALIZED_OFFER_SELECT,
  getOfferId,
  normalizeOffer,
  parseGrades,
  replaceOfferGrades,
  resolveVarietyId,
};
