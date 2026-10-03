const express = require('express');

const healthRouter = express.Router();

healthRouter.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = { healthRouter };
