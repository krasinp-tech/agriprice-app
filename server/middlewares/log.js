/**
 * middlewares/log.js
 * Request logging และ Error logging middleware
 */
const logger = require('../utils/logger');

/**
 * Log ทุก incoming request
 */
function logRequestMiddleware(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status   = res.statusCode;
    const level    = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    logger[level](`${method} ${originalUrl} ${status} ${duration}ms — ${ip}`);
  });

  next();
}

/**
 * Log unhandled errors (ต้องอยู่หลัง routes ทั้งหมด)
 */
// eslint-disable-next-line no-unused-vars
function logErrorMiddleware(err, req, res, next) {
  logger.error(`Unhandled error: ${err.message}`, {
    stack:  err.stack,
    method: req.method,
    url:    req.originalUrl,
  });

  if (res.headersSent) return next(err);

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'
      : err.message,
  });
}

module.exports = { logRequestMiddleware, logErrorMiddleware };