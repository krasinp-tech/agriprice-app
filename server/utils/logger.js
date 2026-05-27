/**
 * utils/logger.js
 * Simple logger — ใช้ console พร้อม timestamp และ level
 * สามารถแทนที่ด้วย winston ได้ภายหลัง
 */

const isDev = process.env.NODE_ENV !== 'production';

function formatMessage(level, message, meta) {
  const ts   = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta && isDev) {
    return base + '\n' + JSON.stringify(meta, null, 2);
  }
  return base;
}

const logger = {
  info(message, meta)  { console.log(formatMessage('info',  message, meta)); },
  warn(message, meta)  { console.warn(formatMessage('warn',  message, meta)); },
  error(message, meta) { console.error(formatMessage('error', message, meta)); },
  debug(message, meta) {
    if (isDev) console.debug(formatMessage('debug', message, meta));
  },
};

module.exports = logger;