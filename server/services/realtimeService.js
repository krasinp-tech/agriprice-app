const EventEmitter = require('events');
const { supabaseAdmin } = require('../utils/supabase');

const bus = new EventEmitter();
bus.setMaxListeners(0);

const TABLE_EVENTS = {
  chat_messages: 'chat',
  bookings: 'booking',
  notifications: 'notification',
  buy_offers: 'offer',
  offer_grades: 'offer',
  offer_slots: 'offer',
  device_sessions: 'session',
};

let channel = null;

function startRealtimeBridge() {
  if (channel) return channel;

  channel = supabaseAdmin.channel('agriprice-server-realtime');
  Object.entries(TABLE_EVENTS).forEach(([table, type]) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      const row = payload.new && Object.keys(payload.new).length ? payload.new : payload.old;
      bus.emit('change', {
        type,
        table,
        action: payload.eventType || 'UPDATE',
        userId: ['notifications', 'device_sessions'].includes(table) ? (row?.user_id || null) : null,
        at: Date.now(),
      });
    });
  });

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn('[Realtime] Supabase channel status:', status);
    }
  });
  return channel;
}

startRealtimeBridge();

module.exports = { bus, startRealtimeBridge };
