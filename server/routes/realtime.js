const express = require('express');
const auth = require('../middlewares/auth');
const { bus } = require('../services/realtimeService');

const router = express.Router();

router.get('/stream', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event) => {
    if (event.userId && String(event.userId) !== String(req.user.id)) return;
    const safeEvent = { ...event };
    delete safeEvent.userId;
    res.write(`event: change\ndata: ${JSON.stringify(safeEvent)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);

  res.write(`event: ready\ndata: {"connected":true}\n\n`);
  bus.on('change', send);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('change', send);
  });
});

module.exports = router;
