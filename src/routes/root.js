const express = require('express');

const rootRouter = express.Router();

rootRouter.get('/', (req, res) => {
  res.json({ name: 'Taskr API', version: '1.0.0', docs: '/health' });
});

module.exports = { rootRouter };
