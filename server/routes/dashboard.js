const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const verifyToken = require('../middlewares/auth');
const { NORMALIZED_OFFER_SELECT, getOfferId, normalizeOffer } = require('../utils/offers');

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function firstRelation(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getBookingUnitPrice(row) {
  const product = firstRelation(row?.product) || firstRelation(row?.products) || firstRelation(row?.slot?.product);
  const firstGrade = firstRelation(product?.grades) || firstRelation(product?.offer_grades) || firstRelation(product?.offerGrades);
  const candidate = product?.price ?? firstGrade?.price ?? row?.expected_price ?? row?.price ?? 0;
  return Number(candidate || 0);
}

function getBookingValue(row) {
  const qty = Number(row?.quantity || row?.qty || 0);
  return qty * getBookingUnitPrice(row);
}

function normalizeDashboardBooking(row) {
  const slot = firstRelation(row?.slot);
  const product = normalizeOffer(firstRelation(slot?.product) || firstRelation(row?.product) || firstRelation(row?.products));
  const offerOwnerId = product?.user_id || row?.offer_owner_id || null;
  const requester = firstRelation(row?.farmer) || firstRelation(row?.buyer) || null;
  const requesterId = row?.farmer_id || row?.requester_id || row?.buyer_id || requester?.profile_id || null;
  return {
    ...row,
    slot,
    product,
    products: product,
    offer_id: getOfferId(product),
    product_id: getOfferId(product),
    farmer_id: requesterId,
    requester_id: requesterId,
    requester,
    offer_owner_id: offerOwnerId,
  };
}

async function getSlotIdsForOfferOwner(userId) {
  const { data: offers, error: offerError } = await supabaseAdmin
    .from('buy_offers')
    .select('offer_id')
    .eq('user_id', userId);

  if (offerError) throw offerError;
  const offerIds = (offers || []).map((offer) => offer.offer_id).filter(Boolean);
  if (offerIds.length === 0) return [];

  const { data: slots, error: slotError } = await supabaseAdmin
    .from('offer_slots')
    .select('slot_id')
    .in('offer_id', offerIds);

  if (slotError) throw slotError;
  return (slots || []).map((slot) => slot.slot_id).filter(Boolean);
}

async function fetchDashboardBookings(userId, role) {
  let query = supabaseAdmin
    .from('bookings')
    .select(`
      booking_id,
      status,
      created_at,
      quantity,
      buyer_id,
      slot_id,
      buyer:profiles!buyer_id(profile_id, first_name, last_name, avatar),
      slot:offer_slots!slot_id(
        slot_id,
        offer_id,
        product:buy_offers!offer_id(${NORMALIZED_OFFER_SELECT})
      )
    `);

  if (role === 'farmer') {
    query = query.eq('buyer_id', userId);
  } else {
    const slotIds = await getSlotIdsForOfferOwner(userId);
    if (slotIds.length === 0) return [];
    query = query.in('slot_id', slotIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeDashboardBooking);
}

async function getLatestMarketPrices(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from('gov_prices')
    .select('commodity, avg_price, price_date')
    .order('price_date', { ascending: false });

  if (error) throw error;

  const commodityDates = new Map();
  for (const row of data || []) {
    if (!row.commodity || !row.price_date) continue;
    const commodityMap = commodityDates.get(row.commodity) || new Map();
    const bucket = commodityMap.get(row.price_date) || { total: 0, count: 0 };
    bucket.total += Number(row.avg_price || 0);
    bucket.count += 1;
    commodityMap.set(row.price_date, bucket);
    commodityDates.set(row.commodity, commodityMap);
  }

  return Array.from(commodityDates.entries()).slice(0, limit).map(([commodity, dateMap]) => {
    const dates = Array.from(dateMap.entries())
      .sort(([dateA], [dateB]) => String(dateB).localeCompare(String(dateA)));
    const [latestDate, latestBucket] = dates[0] || [];
    const [, prevBucket] = dates[1] || [];
    const latestPrice = latestBucket ? latestBucket.total / latestBucket.count : 0;
    const prevPrice = prevBucket ? prevBucket.total / prevBucket.count : 0;
    let change = 0;
    let trend = 'stable';

    if (prevPrice > 0) {
      change = ((latestPrice - prevPrice) / prevPrice) * 100;
      trend = change > 0 ? 'up' : (change < 0 ? 'down' : 'stable');
    }

    return {
      name: commodity,
      price: latestPrice,
      date: latestDate || null,
      change: Math.round(change * 10) / 10,
      trend,
    };
  });
}

async function findLatestMarketAverage(commodityName, varietyName) {
  if (!commodityName) return null;

  const { data, error } = await supabaseAdmin
    .from('gov_prices')
    .select('commodity, variety, avg_price, price_date')
    .order('price_date', { ascending: false });

  if (error) throw error;

  const commodityKey = normalizeText(commodityName);
  const varietyKey = normalizeText(varietyName);
  const rows = (data || []).filter((row) => {
    const rowCommodity = normalizeText(row.commodity);
    return rowCommodity.includes(commodityKey) || commodityKey.includes(rowCommodity);
  });

  const varietyRows = varietyKey
    ? rows.filter((row) => normalizeText(row.variety) === varietyKey)
    : [];

  const latest = (varietyRows.length > 0 ? varietyRows : rows)[0];
  return latest ? Number(latest.avg_price || 0) : null;
}

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role || 'buyer'; // default to buyer logic

    let bookingsTotal = 0;
    let totalSpent = 0;
    let estimatedTotalSpent = 0;
    let productsTotal = 0;
    let avgPrice = 0;

    const normalizedBookingsData = await fetchDashboardBookings(userId, role);

    if (normalizedBookingsData) {
      bookingsTotal = normalizedBookingsData.length;
      
      const successBookings = normalizedBookingsData.filter(b => b.status === 'success');
      const chargeableBookings = normalizedBookingsData.filter(b => b.status !== 'cancel');
      
      productsTotal = successBookings.length; // Count of successful transactions

      totalSpent = successBookings.reduce((acc, curr) => acc + getBookingValue(curr), 0);
      estimatedTotalSpent = chargeableBookings.reduce((acc, curr) => acc + getBookingValue(curr), 0);

      const totalPrices = successBookings.reduce((acc, curr) => {
        return acc + getBookingUnitPrice(curr);
      }, 0);
      
      if (successBookings.length > 0) {
        avgPrice = totalPrices / successBookings.length;
      }
    }

    // Top Products
    const productMap = new Map();
    const sellerMap = new Map();

    if (normalizedBookingsData) {
      normalizedBookingsData.forEach(b => {
        if (b.status === 'success') {
          // Products
          const pid = b.product_id;
          if (pid) {
            const current = productMap.get(pid) || { qty: 0, spent: 0 };
            current.qty += 1;
            current.spent += getBookingValue(b);
            productMap.set(pid, current);
          }
          // Sellers
          const sid = b.offer_owner_id || b.farmer_id;
          if (sid) {
            const current = sellerMap.get(sid) || { orders: 0 };
            current.orders += 1;
            sellerMap.set(sid, current);
          }
        }
      });
    }

    // Fetch product details for top products
    const topProductPids = [...productMap.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5);
    
    const top_products = [];
    for (const [pid, stats] of topProductPids) {
      const { data: pRaw } = await supabaseAdmin.from('buy_offers').select(NORMALIZED_OFFER_SELECT).eq('offer_id', pid).maybeSingle();
      const pData = normalizeOffer(pRaw);
      top_products.push({
        id: pid,
        name: pData?.name || 'สินค้า',
        qty: stats.qty,
        spent: stats.spent,
        image: pData?.image || '../../../assets/images/default-product.png'
      });
    }

    // Fetch profile details for top sellers
    const topSellerSids = [...sellerMap.entries()]
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 5);
    
    const top_sellers = [];
    for (const [sid, stats] of topSellerSids) {
      const { data: sData } = await supabaseAdmin.from('profiles').select('first_name, last_name, avatar').eq('profile_id', sid).maybeSingle();
      top_sellers.push({
        id: sid,
        name: `${sData?.first_name || ''} ${sData?.last_name || ''}`.trim() || 'ผู้ขาย',
        orders: stats.orders,
        avatar: sData?.avatar || 'https://ui-avatars.com/api/?background=E8F7EF&color=14AE60&name=Seller'
      });
    }

    // Trend Data (Last 7 days)
    const trendData = [0, 0, 0, 0, 0, 0, 0];
    if (normalizedBookingsData) {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      normalizedBookingsData.forEach(b => {
        if (b.status === 'success' || b.status === 'waiting') {
           const d = new Date(b.created_at);
           d.setHours(0, 0, 0, 0);
           const diffTime = now.getTime() - d.getTime();
           const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
           if (diffDays >= 0 && diffDays < 7) {
              trendData[6 - diffDays]++; // 6 is today, 0 is 6 days ago
           }
        }
      });
    }

    // Market Prices (Latest from Supabase gov_prices)
    const marketPrices = await getLatestMarketPrices(5);

    const payload = {
      bookings_total: bookingsTotal,
      total_spent: totalSpent,
      estimated_total_spent: estimatedTotalSpent,
      products_total: productsTotal,
      avg_price: avgPrice,
      purchaseTrend: {
         "7": {
            labels: ["6 วันก่อน", "5 วันก่อน", "4 วันก่อน", "3 วันก่อน", "2 วันก่อน", "เมื่อวาน", "วันนี้"],
            data: trendData
         }
      },
      top_products: top_products,
      top_sellers: top_sellers,
      market_prices: marketPrices,
      booking_stats: {
        waiting: normalizedBookingsData?.filter(b => b.status === 'waiting').length || 0,
        success: normalizedBookingsData?.filter(b => b.status === 'success').length || 0,
        cancel: normalizedBookingsData?.filter(b => b.status === 'cancel').length || 0,
      }
    };

    res.json({ success: true, data: payload });

  } catch (error) {
    console.error('[Dashboard API Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/dashboard/pro-stats
 * ดึงสถิติเชิงลึกสำหรับผู้ใช้ระดับ PRO
 */
router.get('/pro-stats', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role || 'buyer';

    // ── Tier Guard: เฉพาะ PRO เท่านั้น ─────────────────────────
    const { data: profileCheck } = await supabaseAdmin
      .from('profiles')
      .select('tier')
      .eq('profile_id', userId)
      .single();

    const userTier = (profileCheck?.tier || 'free').toLowerCase();
    if (userTier !== 'pro') {
      return res.status(403).json({
        success: false,
        tier_required: true,
        message: 'ฟีเจอร์นี้ใช้ได้เฉพาะสมาชิก PRO เท่านั้น'
      });
    }
    // ─────────────────────────────────────────────────────────────

    const period = req.query.period || 'today';
    const now = new Date();
    let startDate = new Date();
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0); // start of today
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7); // last 7 days
    } else { // 'month'
      startDate.setDate(now.getDate() - 30); // last 30 days
    }

    // [REAL DATA] 1. ดึงข้อมูลการจองจริง
    const bookingsData = await fetchDashboardBookings(userId, role);

    // กรองข้อมูลการจองตามช่วงเวลาที่เลือก
    const periodBookings = (bookingsData || []).filter(b => new Date(b.created_at) >= startDate);
    const totalBookings = periodBookings.length;
    const successBookings = periodBookings.filter(b => b.status === 'success');
    const waitingBookingsCount = periodBookings.filter(b => b.status === 'waiting').length;
    const cancelBookingsCount = periodBookings.filter(b => b.status === 'cancel').length;
    const successRate = totalBookings > 0 ? (successBookings.length / totalBookings) * 100 : 0;

    // คำนวณช่วงเวลาการจองสูงสุด
    const hourCounts = Array(24).fill(0);
    periodBookings.forEach(b => {
      const hr = new Date(b.created_at).getHours();
      hourCounts[hr]++;
    });
    let peakHour = 0;
    let maxHourCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourCounts[h] > maxHourCount) {
        maxHourCount = hourCounts[h];
        peakHour = h;
      }
    }
    const peakBookingTime = maxHourCount > 0 
      ? `${String(peakHour).padStart(2, '0')}:00 - ${String((peakHour + 1) % 24).padStart(2, '0')}:00`
      : '-';

    // คำนวณความถี่การจองเฉลี่ยรายวัน/รายเดือน
    const totalDays = period === 'today' ? 1 : (period === 'week' ? 7 : 30);
    const dailyMap = {};
    const monthlyMap = {};
    periodBookings.forEach(b => {
      const dateStr = new Date(b.created_at).toISOString().split('T')[0];
      const monthStr = dateStr.substring(0, 7);
      dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
      monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + 1;
    });
    const avgDailyBookings = Object.values(dailyMap).reduce((a, b) => a + b, 0) / totalDays;
    const avgMonthlyBookings = Object.values(monthlyMap).reduce((a, b) => a + b, 0) / (period === 'month' ? 1 : (totalDays / 30));

    // ดึงสินค้าทั้งหมดของผู้ใช้งานเพื่อใช้หา ประกาศจองมากสุด/น้อยสุด และ วิเคราะห์ราคา/การเข้าชม
    const { data: userProducts } = await supabaseAdmin
      .from('buy_offers')
      .select(NORMALIZED_OFFER_SELECT)
      .eq('user_id', userId);
    const normalizedUserProducts = (userProducts || []).map(normalizeOffer);

    const productBookingCounts = {};
    if (normalizedUserProducts) {
      normalizedUserProducts.forEach(p => {
        productBookingCounts[p.product_id] = { name: p.name, count: 0 };
      });
    }

    periodBookings.forEach(b => {
      if (b.product_id && productBookingCounts[b.product_id]) {
        productBookingCounts[b.product_id].count++;
      } else if (b.product_id && b.products) {
        productBookingCounts[b.product_id] = { name: normalizeOffer(b.products).name, count: 1 };
      }
    });

    const sortedProds = Object.values(productBookingCounts).sort((a, b) => b.count - a.count);
    const mostBooked = sortedProds.length > 0 && sortedProds[0].count > 0 ? sortedProds[0] : null;
    const leastBooked = sortedProds.length > 0 ? sortedProds[sortedProds.length - 1] : null;

    // [REAL DATA] 2. คำนวณผู้ติดตาม
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('followers_count, address_line1, address_line2')
      .eq('profile_id', userId)
      .single();

    const totalFollowers = profileData?.followers_count || 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: newFollowersCount } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const initialFollowers = totalFollowers - (newFollowersCount || 0);
    const followerGrowthRate = initialFollowers > 0 
      ? ((newFollowersCount || 0) / initialFollowers) * 100 
      : (totalFollowers > 0 ? 100 : 0);

    // [REAL DATA] 3. คำนวณยอดแสดงผล Feed (Impressions)
    const userProductIds = normalizedUserProducts ? normalizedUserProducts.map(p => getOfferId(p)).filter(Boolean) : [];
    let totalImpressions = 0;
    if (userProductIds.length > 0) {
      const { count: impCount, error: impErr } = await supabaseAdmin
        .from('offer_impressions')
        .select('*', { count: 'exact', head: true })
        .in('offer_id', userProductIds)
        .or(`viewer_id.is.null,viewer_id.neq.${userId}`)
        .gte('created_at', startDate.toISOString());
      if (!impErr) {
        totalImpressions = impCount || 0;
      }
    }

    // [REAL DATA] 4. จำนวนล้งคู่แข่งในพื้นที่เดียวกัน
    let competitorsCount = 0;
    let categoryCompetitors = [];
    const getProvinceKeyword = (address) => {
      if (!address) return '';
      let clean = address.replace(/จังหวัด|จ\./g, '').trim();
      const parts = clean.split(/[\s,]+/);
      return parts[0] || '';
    };
    const provinceKeyword = getProvinceKeyword(profileData?.address_line2 || profileData?.address_line1);

    if (provinceKeyword) {
      const { data: competitorProfiles, error: compErr } = await supabaseAdmin
        .from('profiles')
        .select('profile_id')
        .eq('role', role)
        .neq('profile_id', userId)
        .ilike('address_line2', `%${provinceKeyword}%`);

      if (!compErr && competitorProfiles && competitorProfiles.length > 0) {
        const compIds = competitorProfiles.map(cp => cp.profile_id);
        competitorsCount = compIds.length;

        const { data: compProducts } = await supabaseAdmin
          .from('buy_offers')
          .select(NORMALIZED_OFFER_SELECT)
          .in('user_id', compIds)
          .eq('is_active', true);

        if (compProducts) {
          const catMap = {};
          compProducts.map(normalizeOffer).forEach(cp => {
            if (cp.category) {
              catMap[cp.category] = (catMap[cp.category] || 0) + 1;
            }
          });
          categoryCompetitors = Object.entries(catMap).map(([category, count]) => ({
            category,
            count
          }));
        }
      }
    }

    // [REAL DATA] Price comparison against Supabase gov_prices
    const priceComparison = [];
    const activeProds = normalizedUserProducts ? normalizedUserProducts.filter(p => p.is_active) : [];
    
    for (const prod of activeProds) {
      const commodityName = prod.name || prod.variety || prod.category;
      const varietyName = prod.variety;
      const marketAvg = await findLatestMarketAverage(commodityName, varietyName);

      if (marketAvg) {
        const myPrice = Number(prod.price);
        const diffPercent = ((myPrice - marketAvg) / marketAvg) * 100;
        const roundedDiff = Math.round(diffPercent * 10) / 10;
        const diffText = roundedDiff > 0 
          ? `สูงกว่าตลาด +${roundedDiff}%` 
          : (roundedDiff < 0 ? `ต่ำกว่าตลาด ${roundedDiff}%` : 'เท่ากับราคาตลาด');

        priceComparison.push({
          product_id: getOfferId(prod),
          offer_id: getOfferId(prod),
          name: prod.name,
          variety: prod.variety,
          myPrice,
          marketPrice: marketAvg,
          diffPercent: roundedDiff,
          diffText
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalBookings,
        successBookings: successBookings.length,
        waitingBookings: waitingBookingsCount,
        cancelBookings: cancelBookingsCount,
        successRate: Math.round(successRate * 10) / 10,
        peakBookingTime,
        mostBooked,
        leastBooked,
        dailyAverage: Math.round(avgDailyBookings * 10) / 10,
        monthlyAverage: Math.round(avgMonthlyBookings * 10) / 10,

        totalFollowers,
        newFollowers: newFollowersCount || 0,
        followerGrowthRate: Math.round(followerGrowthRate * 10) / 10,

        totalViews: totalImpressions,
        province: provinceKeyword || '-',
        competitorsCount,
        categoryCompetitors,
        priceComparison,

        monthlyRevenue: 0, // skip monetary values
        trends: {
          monthlyRevenue: "0%",
          totalBookings: "0%",
          totalViews: "0%",
          newFollowers: "0%"
        },
        bookingSummary: {
          total: totalBookings,
          success: successBookings.length,
          waiting: waitingBookingsCount,
          cancel: cancelBookingsCount
        }
      }
    });

  } catch (error) {
    console.error('[Dashboard Pro API Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
