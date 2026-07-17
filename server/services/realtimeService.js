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
let reconnectTimer = null;
let reconnectDelayMs = 1000;

function scheduleReconnect(failedChannel = channel) {
  // Ignore a late CLOSED/error callback from an older channel after a new one
  // has already connected.
  if (failedChannel && channel && failedChannel !== channel) return;
  if (reconnectTimer) return;

  channel = null;
  if (failedChannel) {
    Promise.resolve(supabaseAdmin.removeChannel(failedChannel)).catch((error) => {
      console.warn('[Realtime] Failed to remove channel:', error.message);
    });
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startRealtimeBridge();
  }, reconnectDelayMs);
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
}

function startRealtimeBridge() {
  if (channel) return channel;

  const activeChannel = supabaseAdmin.channel('agriprice-server-realtime');
  channel = activeChannel;
  Object.entries(TABLE_EVENTS).forEach(([table, type]) => {
    activeChannel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
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

  activeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      reconnectDelayMs = 1000;
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      console.warn('[Realtime] Supabase channel status:', status);
      scheduleReconnect(activeChannel);
    }
  });
  return activeChannel;
}

startRealtimeBridge();

module.exports = { bus, startRealtimeBridge };
