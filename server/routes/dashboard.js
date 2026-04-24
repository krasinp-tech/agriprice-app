const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../utils/supabase');
const verifyToken = require('../middlewares/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role || 'buyer'; // default to buyer logic

    // To implement dashboard, we would query the database to get real stats.
    // For now, let's fetch basic stats and build some dummy data for trend.
    // Real implementation would aggregate over the `bookings`, `products`, `profiles` etc.

    let bookingsTotal = 0;
    let totalSpent = 0;
    let productsTotal = 0;
    let avgPrice = 0;

    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('status, qty, expected_price, product_id, farmer_id, created_at')
      .eq(role === 'farmer' ? 'farmer_id' : 'buyer_id', userId);

    if (!bookingsError && bookingsData) {
      bookingsTotal = bookingsData.length;
      
      const successBookings = bookingsData.filter(b => b.status === 'success');
      
      productsTotal = successBookings.length; // Count of successful transactions

      totalSpent = successBookings.reduce((acc, curr) => {
        return acc + (Number(curr.qty || 0) * Number(curr.expected_price || 0));
      }, 0);

      const totalPrices = successBookings.reduce((acc, curr) => acc + Number(curr.expected_price || 0), 0);
      if (successBookings.length > 0) {
        avgPrice = totalPrices / successBookings.length;
      }
    }

    // Top Products
    const productMap = new Map();
    const sellerMap = new Map();

    if (bookingsData) {
      bookingsData.forEach(b => {
        if (b.status === 'success') {
          // Products
          const pid = b.product_id;
          if (pid) {
            const current = productMap.get(pid) || { qty: 0, spent: 0 };
            current.qty += 1;
            current.spent += (Number(b.qty || 0) * Number(b.expected_price || 0));
            productMap.set(pid, current);
          }
          // Sellers
          const sid = b.farmer_id;
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
      const { data: pData } = await supabaseAdmin.from('products').select('name, images').eq('product_id', pid).maybeSingle();
      top_products.push({
        id: pid,
        name: pData?.name || 'สินค้า',
        qty: stats.qty,
        spent: stats.spent,
        image: pData?.images?.[0] || '../../../assets/images/default-product.png'
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
    if (bookingsData) {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      bookingsData.forEach(b => {
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

    // Market Prices (Latest from gov_prices)
    const { data: mData } = await supabaseAdmin
      .from('gov_prices')
      .select('commodity, avg_price, price_date')
      .order('price_date', { ascending: false })
      .limit(30); // fetch more to ensure we get distinct top ones
    
    const marketPrices = [];
    const seenM = new Set();
    if (mData) {
      for (const row of mData) {
        if (!seenM.has(row.commodity)) {
          seenM.add(row.commodity);
          
          // Get previous price to show trend
          const { data: prevPriceData } = await supabaseAdmin
            .from('gov_prices')
            .select('avg_price')
            .eq('commodity', row.commodity)
            .lt('price_date', row.price_date)
            .order('price_date', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          let change = 0;
          let trend = 'stable';
          if (prevPriceData && prevPriceData.avg_price > 0) {
            change = ((row.avg_price - prevPriceData.avg_price) / prevPriceData.avg_price) * 100;
            trend = change > 0 ? 'up' : (change < 0 ? 'down' : 'stable');
          }

          marketPrices.push({
            name: row.commodity,
            price: row.avg_price,
            date: row.price_date,
            change: Math.round(change * 10) / 10,
            trend: trend
          });
        }
        if (marketPrices.length >= 5) break;
      }
    }

    const payload = {
      bookings_total: bookingsTotal,
      total_spent: totalSpent,
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
        waiting: bookingsData?.filter(b => b.status === 'waiting').length || 0,
        success: bookingsData?.filter(b => b.status === 'success').length || 0,
        cancel: bookingsData?.filter(b => b.status === 'cancel').length || 0,
      }
    };

    res.json({ success: true, data: payload });

  } catch (error) {
    console.error('[Dashboard API Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
