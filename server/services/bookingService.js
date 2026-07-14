const { supabaseAdmin } = require('../utils/supabase');
const { makeBookingNo } = require('../utils/helpers');
const notificationService = require('./notificationService');
const { NORMALIZED_OFFER_SELECT, getOfferId, normalizeOffer } = require('../utils/offers');

const BOOKING_OFFER_SELECT = NORMALIZED_OFFER_SELECT;

const BOOKING_SELECT = `
  *,
  buyer:profiles!buyer_id(profile_id, first_name, last_name, phone, avatar, address_line1, address_line2, map_link),
  slot:offer_slots!slot_id(
    slot_id,
    offer_id,
    product_id:offer_id,
    slot_name,
    start_date,
    end_date,
    time_start,
    time_end,
    capacity,
    is_active,
    created_at,
    product:buy_offers!offer_id(${BOOKING_OFFER_SELECT})
  ),
  booking_vehicles(*)
`;

function firstRelation(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getBookingOffer(row) {
  return firstRelation(row?.product)
    || firstRelation(row?.products)
    || firstRelation(row?.buy_offers)
    || firstRelation(row?.slot?.product)
    || firstRelation(row?.slot?.buy_offers)
    || null;
}

function normalizeSlot(slot) {
  if (!slot) return slot;
  const product = normalizeOffer(firstRelation(slot.product) || firstRelation(slot.buy_offers));
  return {
    ...slot,
    product_id: slot.product_id || slot.offer_id,
    product,
    buy_offers: product,
  };
}

function normalizeBooking(row) {
  if (!row) return row;
  const slot = normalizeSlot(row.slot);
  const product = normalizeOffer(getBookingOffer({ ...row, slot }));
  const vehicles = Array.isArray(row.booking_vehicles) ? row.booking_vehicles : [];
  const offerOwnerId = product?.user_id || slot?.product?.user_id || row.offer_owner_id || null;
  const offerOwner = firstRelation(product?.profiles) || firstRelation(slot?.product?.profiles) || row.offer_owner || null;
  const requester = row.farmer || row.buyer || null;
  const requesterId = row.farmer_id || row.requester_id || row.buyer_id || requester?.profile_id || null;
  return {
    ...row,
    slot,
    product,
    products: product,
    buy_offers: product,
    offer_id: getOfferId(product),
    product_id: getOfferId(product),
    farmer_id: requesterId,
    farmer: requester,
    requester_id: requesterId,
    requester,
    offer_owner_id: offerOwnerId,
    offer_owner: offerOwner,
    buyer_profile: offerOwner,
    vehicle_plates: vehicles.map((vehicle) => vehicle.plate_no).filter(Boolean).join(', '),
    // Cancel info — populated when status = 'cancel'
    cancel_by: row.cancel_by || null,       // 'farmer' | 'buyer' | null
    cancel_reason: row.cancel_reason || null, // free-text reason or null
  };
}

function splitVehiclePlates(value) {
  return String(value || '')
    .split(/[,;\n]+/)
    .map((plate) => plate.trim())
    .filter(Boolean);
}

function normalizeBookingStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'confirmed') return 'waiting';
  if (value === 'completed') return 'success';
  if (value === 'rejected' || value === 'cancelled' || value === 'canceled') return 'cancel';
  if (['waiting', 'success', 'cancel'].includes(value)) return value;
  throw new Error('สถานะการจองไม่ถูกต้อง');
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getBangkokDateString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const bkkTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return bkkTime.toISOString().split('T')[0];
}

function getBangkokDayRange(value) {
  const dateString = getBangkokDateString(value);
  if (!dateString) return null;
  return {
    dateString,
    startOfDay: new Date(`${dateString}T00:00:00+07:00`).toISOString(),
    endOfDay: new Date(`${dateString}T23:59:59.999+07:00`).toISOString(),
  };
}

function timeToMinutes(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getBangkokTimeMinutes(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const bkkTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return bkkTime.getUTCHours() * 60 + bkkTime.getUTCMinutes();
}

function assertScheduledTimeMatchesSlot(slot, scheduledTime) {
  const scheduledDate = getBangkokDateString(scheduledTime);
  if (!scheduledDate) throw createHttpError('Invalid scheduled_time');

  if (slot.start_date && scheduledDate < slot.start_date) {
    throw createHttpError('Scheduled date is before the selected slot starts');
  }
  if (slot.end_date && scheduledDate > slot.end_date) {
    throw createHttpError('Scheduled date is after the selected slot ends');
  }

  const scheduledMinutes = getBangkokTimeMinutes(scheduledTime);
  const startMinutes = timeToMinutes(slot.time_start);
  const endMinutes = timeToMinutes(slot.time_end);
  if (scheduledMinutes == null || startMinutes == null || endMinutes == null) return;

  if (scheduledMinutes < startMinutes || scheduledMinutes > endMinutes) {
    throw createHttpError('Scheduled time is outside the selected slot');
  }
}

async function getFallbackQueueSequence(slotId, dayRange) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('queue_no')
    .eq('slot_id', slotId)
    .gte('scheduled_time', dayRange.startOfDay)
    .lte('scheduled_time', dayRange.endOfDay);

  if (error) throw error;

  const maxSequence = (data || []).reduce((max, row) => {
    const match = String(row.queue_no || '').match(/-(\d+)$/);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);

  return maxSequence + 1;
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

async function fetchBookingRow(bookingIdOrNo) {
  let query = supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT);

  if (!isNaN(Number(bookingIdOrNo))) {
    query = query.eq('booking_id', bookingIdOrNo);
  } else {
    query = query.eq('booking_no', bookingIdOrNo);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function createBookingWithQueueValidation(farmerId, bookingData) {
  const { slot_id, scheduled_time, note } = bookingData;
  const product_id = bookingData.offer_id || bookingData.product_id;
  const vehicle_info = bookingData.vehicle_info || bookingData.vehicle_plates || '';
  const vehiclePlates = splitVehiclePlates(vehicle_info);
  const expected_qty = bookingData.expected_qty !== undefined ? bookingData.expected_qty : (bookingData.product_amount || 0);
  const numericOfferId = Number(product_id);
  const numericSlotId = Number(slot_id);

  if (!Number.isInteger(numericOfferId) || numericOfferId <= 0) {
    throw createHttpError('Invalid offer_id');
  }
  if (!Number.isInteger(numericSlotId) || numericSlotId <= 0) {
    throw createHttpError('Invalid slot_id');
  }
  if (!scheduled_time) {
    throw createHttpError('scheduled_time is required');
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from('buy_offers')
    .select('user_id')
    .eq('offer_id', numericOfferId)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw createHttpError('Buy offer not found', 404);

  const { data: slot, error: slotError } = await supabaseAdmin
    .from('offer_slots')
    .select('*')
    .eq('slot_id', numericSlotId)
    .maybeSingle();
  if (slotError) throw slotError;
  if (!slot) throw createHttpError('Selected slot not found', 404);
  if (Number(slot.offer_id) !== numericOfferId) {
    throw createHttpError('Selected slot does not belong to this offer');
  }
  if (!slot.is_active) {
    throw createHttpError('Selected slot is not active');
  }

  assertScheduledTimeMatchesSlot(slot, scheduled_time);

  const dayRange = getBangkokDayRange(scheduled_time);
  if (!dayRange) throw createHttpError('Invalid scheduled_time');

  const { count: currentBooked, error: countError } = await supabaseAdmin
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('slot_id', numericSlotId)
    .neq('status', 'cancel')
    .gte('scheduled_time', dayRange.startOfDay)
    .lte('scheduled_time', dayRange.endOfDay);
  if (countError) throw countError;

  if (slot.capacity > 0 && (currentBooked || 0) >= slot.capacity) {
    throw createHttpError('Selected slot is full');
  }

  const buyerId = product.user_id;
  const booking_no = makeBookingNo();

  const { data: nextSeq, error: rpcErr } = await supabaseAdmin.rpc('next_queue_sequence', {
    p_slot_id: numericSlotId,
    p_date: dayRange.dateString
  });
  if (rpcErr) {
    console.warn('[BookingService] next_queue_sequence RPC failed, using non-atomic fallback:', rpcErr.message);
  }
  const sequence = (!rpcErr && nextSeq != null)
    ? nextSeq
    : await getFallbackQueueSequence(numericSlotId, dayRange);
  const queue_no = `Q-${String(sequence).padStart(2, '0')}`;

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .insert({
      booking_no,
      queue_no,
      buyer_id: farmerId,
      slot_id: numericSlotId,
      scheduled_time,
      quantity: parseFloat(expected_qty) || 0,
      contact_name: bookingData.contact_name || '',
      contact_phone: bookingData.contact_phone || '',
      address: bookingData.address || '',
      note,
      status: 'waiting'
    })
    .select()
    .single();

  if (error) throw error;

  if (vehiclePlates.length > 0) {
    const { error: vehicleError } = await supabaseAdmin
      .from('booking_vehicles')
      .insert(vehiclePlates.map((plate_no) => ({
        booking_id: data.booking_id,
        plate_no,
      })));
    if (vehicleError) throw vehicleError;
  }

  await notificationService.createNotification(
    buyerId,
    'booking',
    'มีการจองคิวใหม่',
    `เลขที่ ${booking_no} (${queue_no})`,
    `/pages/buyer/setbooking/booking-information.html?id=${data.booking_id}`,
    { booking_id: String(data.booking_id) }
  ).catch((err) => console.error('[BookingService] Notify buyer error:', err.message));

  return normalizeBooking(await fetchBookingRow(data.booking_id));
}

class BookingService {
  async listBookings(userId, role, status) {
    let query = supabaseAdmin
      .from('bookings')
      .select(BOOKING_SELECT)
      .order('created_at', { ascending: false });

    if (role === 'farmer') {
      query = query.eq('buyer_id', userId);
    } else if (role === 'buyer') {
      const slotIds = await getSlotIdsForOfferOwner(userId);
      if (slotIds.length === 0) return [];
      query = query.in('slot_id', slotIds);
    } else {
      throw new Error('Unauthorized role');
    }

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[BookingService] Database Error:', error);
      throw error;
    }
    return (data || []).map(normalizeBooking);
  }

  async getBookingDetail(bookingIdOrNo, userId) {
    const data = await fetchBookingRow(bookingIdOrNo);
    if (!data) throw new Error('ไม่พบข้อมูลการจอง');

    const normalized = normalizeBooking(data);
    if (String(normalized.buyer_id) !== String(userId) && String(normalized.offer_owner_id) !== String(userId)) {
      throw createHttpError('Forbidden', 403);
    }

    return normalized;
  }

  async getQueueStatus(bookingId, userId) {
    const booking = await this.getBookingDetail(bookingId, userId);
    if (!booking) throw new Error('ไม่พบข้อมูลการจอง');

    if (booking.status !== 'waiting' || !booking.slot_id) {
      return {
        currentQueue: booking.queue_no || '-',
        waitingAhead: 0,
        status: booking.status
      };
    }

    const dayRange = getBangkokDayRange(booking.scheduled_time);
    if (!dayRange) throw createHttpError('Invalid scheduled_time');

    // Count bookings ahead in the same slot on the same day (waiting status and created earlier)
    const { count: waitingAhead, error: countErr } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', booking.slot_id)
      .eq('status', 'waiting')
      .gte('scheduled_time', dayRange.startOfDay)
      .lte('scheduled_time', dayRange.endOfDay)
      .lt('created_at', booking.created_at);

    if (countErr) throw countErr;

    // Get the queue_no currently at the front of the queue (oldest waiting booking in this slot on the same day)
    const { data: currentBookingRow, error: curErr } = await supabaseAdmin
      .from('bookings')
      .select('queue_no')
      .eq('slot_id', booking.slot_id)
      .eq('status', 'waiting')
      .gte('scheduled_time', dayRange.startOfDay)
      .lte('scheduled_time', dayRange.endOfDay)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (curErr) throw curErr;

    return {
      currentQueue: currentBookingRow?.queue_no || '-',
      waitingAhead: waitingAhead || 0,
      status: booking.status
    };
  }

  async createBooking(farmerId, bookingData) {
    return createBookingWithQueueValidation(farmerId, bookingData);
  }

  async updateBookingStatus(bookingId, userId, role, status, cancelReason = null) {
    const requestedStatus = String(status || '').toLowerCase();
    const nextStatus = normalizeBookingStatus(status);
    const booking = await this.getBookingDetail(bookingId, userId);

    // 'confirmed' is an acknowledgment — send notification even if DB status stays 'waiting'
    if (booking.status === nextStatus && requestedStatus !== 'confirmed') {
      return booking; // already in this status
    }

    const requesterId = booking.buyer_id;
    const offerOwnerId = booking.offer_owner_id;

    if (role === 'farmer' && nextStatus !== 'cancel') {
      throw new Error('เกษตรกรสามารถยกเลิกได้เท่านั้น');
    }
    if (role === 'buyer' && String(offerOwnerId) !== String(userId)) {
      throw createHttpError('Only the offer owner can update this booking', 403);
    }

    // Build update payload — include cancel info when cancelling
    const updatePayload = { status: nextStatus };
    if (nextStatus === 'cancel') {
      updatePayload.cancel_by = role; // 'farmer' or 'buyer'
      if (cancelReason) updatePayload.cancel_reason = String(cancelReason).trim().slice(0, 500);
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update(updatePayload)
      .eq('booking_id', booking.booking_id)
      .select()
      .single();

    if (error) throw error;

    // Send status update notifications (in-app and push)
    try {
      let notifyUserId = null;
      let title = '';
      let description = '';
      let link = '';

      if (nextStatus === 'cancel') {
        if (role === 'farmer') {
          notifyUserId = offerOwnerId;
          title = 'มีการยกเลิกการจองคิว';
          description = `คิวเลขที่ ${booking.queue_no} (ใบจองเลขที่ ${booking.booking_no}) ถูกยกเลิกโดยเกษตรกร`;
          link = `/pages/buyer/setbooking/booking-information.html?id=${booking.booking_id}`;
        } else {
          notifyUserId = requesterId;
          title = 'การจองคิวของคุณถูกยกเลิก';
          description = `คิวเลขที่ ${booking.queue_no} (ใบจองเลขที่ ${booking.booking_no}) ถูกยกเลิกโดยผู้รับซื้อ`;
          link = `/pages/farmer/booking/booking.html`;
        }
      } else if (requestedStatus === 'confirmed') {
        notifyUserId = requesterId;
        title = 'ยืนยันการจองคิวสำเร็จ';
        description = `คิวเลขที่ ${booking.queue_no} (ใบจองเลขที่ ${booking.booking_no}) ได้รับการยืนยันจากผู้รับซื้อแล้ว`;
        link = `/pages/farmer/booking/booking.html`;
      } else if (requestedStatus === 'completed' || nextStatus === 'success') {
        notifyUserId = requesterId;
        title = 'คิวจองผลผลิตเสร็จสิ้น';
        description = `คิวเลขที่ ${booking.queue_no} (ใบจองเลขที่ ${booking.booking_no}) ดำเนินการชั่งน้ำหนักและลงบันทึกเสร็จสิ้นแล้ว`;
        link = `/pages/farmer/booking/booking.html`;
      } else if (requestedStatus === 'rejected') {
        notifyUserId = requesterId;
        title = 'การจองคิวถูกปฏิเสธ';
        description = `คิวเลขที่ ${booking.queue_no} (ใบจองเลขที่ ${booking.booking_no}) ถูกปฏิเสธโดยผู้รับซื้อ`;
        link = `/pages/farmer/booking/booking.html`;
      }

      if (notifyUserId) {
        await notificationService.createNotification(
          notifyUserId,
          'booking',
          title,
          description,
          link,
          { booking_id: String(booking.booking_id), status: nextStatus }
        );
      }
    } catch (notiErr) {
      console.error('[BookingService] Failed to send status update notification:', notiErr.message);
    }

    return normalizeBooking(await fetchBookingRow(data.booking_id));
  }

  async checkInBooking(bookingId, userId, role) {
    const booking = await this.getBookingDetail(bookingId, userId);

    if (role !== 'buyer' || String(booking.offer_owner_id) !== String(userId)) {
      throw createHttpError('Only the buyer can confirm check-in for this booking', 403);
    }
    if (booking.status === 'cancel') {
      throw createHttpError('Cannot check in a canceled booking', 400);
    }
    if (booking.status === 'success') {
      return booking;
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'success' })
      .eq('booking_id', booking.booking_id)
      .select()
      .single();

    if (error) throw error;

    await notificationService.createNotification(
      booking.buyer_id,
      'booking',
      'เช็คอินคิวสำเร็จ',
      `คิวเลขที่ ${booking.queue_no || '-'} (ใบจองเลขที่ ${booking.booking_no}) ได้รับการเช็คอินแล้ว`,
      `/pages/farmer/booking/booking.html`,
      { booking_id: String(booking.booking_id), status: 'success' }
    ).catch((err) => console.error('[BookingService] Check-in notification failed:', err.message));

    return normalizeBooking(await fetchBookingRow(data.booking_id));
  }
}

module.exports = new BookingService();
