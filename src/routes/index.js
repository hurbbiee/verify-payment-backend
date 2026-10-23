const express = require('express');

const router = express.Router();
router.use('/slips', require('./slip.routes'));
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});
router.get('/usage', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: await require('../providers/thunder-usage.provider').getUsage() });
  } catch (error) { next(error); }
});

module.exports = router;
