const STATUS_ALIASES = Object.freeze({
  confirmed: 'waiting', completed: 'success', rejected: 'cancel',
  cancelled: 'cancel', canceled: 'cancel', waiting: 'waiting',
  success: 'success', cancel: 'cancel',
});

const TERMINAL_STATUSES = new Set(['success', 'cancel']);

function normalizeBookingStatus(status) {
  const normalized = STATUS_ALIASES[String(status || '').toLowerCase()];
  if (!normalized) {
    const error = new Error('สถานะการจองไม่ถูกต้อง');
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function assertBookingTransition(currentStatus, requestedStatus) {
  const current = normalizeBookingStatus(currentStatus);
  const next = normalizeBookingStatus(requestedStatus);
  if (current === next) return { current, next, changed: false };
  if (TERMINAL_STATUSES.has(current)) {
    const error = new Error(current === 'success'
      ? 'งานนี้เสร็จสิ้นแล้ว ไม่สามารถเปลี่ยนสถานะหรือยกเลิกได้'
      : 'การจองนี้ถูกยกเลิกแล้ว ไม่สามารถเปลี่ยนสถานะได้');
    error.statusCode = 409;
    throw error;
  }
  return { current, next, changed: true };
}

module.exports = { normalizeBookingStatus, assertBookingTransition, TERMINAL_STATUSES };
