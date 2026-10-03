const express = require('express');

const webhooksRouter = express.Router();

webhooksRouter.post('/task-update', (req, res) => {
  // TODO: process webhook payload
  console.log('[WEBHOOK] Received:', req.body);
  res.json({ received: true });
});

module.exports = { webhooksRouter };
