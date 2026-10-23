const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { receiveSlip, validateImage } = require('../middlewares/upload.middleware');
const { verifySlip } = require('../controllers/slip.controller');
const router = express.Router();
router.use(rateLimit({
  windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่' } },
}));
router.post('/verify', receiveSlip, validateImage, verifySlip);
router.post('/read-qr', receiveSlip, validateImage, require('../controllers/qr.controller').readSlipQr);
module.exports = router;
