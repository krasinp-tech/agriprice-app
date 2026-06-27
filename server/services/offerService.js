const { supabaseAdmin } = require('../utils/supabase');
const { saveFile } = require('./fileService');

class OfferService {
  async listOffers({ q, buyer_id, category, page = 1, limit = 20 }) {
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabaseAdmin
      .from('buy_offers')
      .select('*, profiles!buyer_id(profile_id, first_name, last_name, avatar, lat, lng)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!buyer_id) {
      query = query.eq('is_active', true);
    } else {
      query = query.eq('buyer_id', buyer_id);
    }

    if (category && category !== 'undefined') {
      query = query.eq('category', category);
    }

    if (q) {
      // Basic smart search logic migrated from old products route
      const dateMatch = q.match(/^(\d{4}-\d{2}-\d{2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})$/);
      if (dateMatch) {
        let dateObj = new Date(q);
        if (isNaN(dateObj.getTime())) {
          const parts = q.split(/[-/]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
            dateObj = new Date(y, m, d);
          }
        }
        if (!isNaN(dateObj.getTime())) {
          const start = new Date(dateObj).toISOString();
          const end = new Date(dateObj.setDate(dateObj.getDate() + 1)).toISOString();
          query = query.gte('created_at', start).lt('created_at', end);
        } else {
          query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,variety.ilike.%${q}%`);
        }
      } else {
        query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%,variety.ilike.%${q}%`);
      }
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return { data, total: count, page: Number(page), limit: Number(limit) };
  }

  async getOfferById(id) {
    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .select('*, profiles!buyer_id(*), offer_grades(*)')
      .eq('id', id)
      .single();

    if (error) throw new Error('ไม่พบข้อมูลการรับซื้อ');
    return data;
  }

  async createOffer(buyerId, offerData, imageFile) {
    const { title, category, variety, base_price, unit, description, grades } = offerData;
    
    const insertData = {
      buyer_id: buyerId,
      title,
      category: category || title,
      variety: variety || null,
      base_price: Number(base_price || 0),
      unit: unit || 'กก.',
      description: description || null,
      is_active: true
    };

    if (imageFile) {
      insertData.image_url = await saveFile(imageFile, 'offers');
    }

    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Handle grades if provided
    if (grades && Array.isArray(grades)) {
      const gradeInserts = grades.map(g => ({
        offer_id: data.id,
        grade_name: g.grade_name,
        price: Number(g.price)
      }));
      await supabaseAdmin.from('offer_grades').insert(gradeInserts);
    }

    return data;
  }

  async updateOffer(offerId, buyerId, updates, imageFile) {
    if (imageFile) {
      updates.image_url = await saveFile(imageFile, 'offers');
    }

    const { data, error } = await supabaseAdmin
      .from('buy_offers')
      .update(updates)
      .eq('id', offerId)
      .eq('buyer_id', buyerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteOffer(offerId, buyerId) {
    const { error } = await supabaseAdmin
      .from('buy_offers')
      .update({ is_active: false })
      .eq('id', offerId)
      .eq('buyer_id', buyerId);

    if (error) throw error;
    return true;
  }

  // Slots Management
  async getOfferSlots(offerId) {
    const { data, error } = await supabaseAdmin
      .from('offer_slots')
      .select('*')
      .eq('offer_id', offerId)
      .eq('is_active', true)
      .order('time_start');

    if (error) throw error;
    return data;
  }

  async createOfferSlot(buyerId, offerId, slotData) {
    // Ownership check
    const { data: offer } = await supabaseAdmin.from('buy_offers').select('buyer_id').eq('id', offerId).single();
    if (!offer || offer.buyer_id !== buyerId) throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('offer_slots')
      .insert({ ...slotData, offer_id: offerId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = new OfferService();
