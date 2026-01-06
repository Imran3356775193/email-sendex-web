const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// Public header/debug endpoint
router.get('/headers', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'] || null,
      'forwarded': req.headers.forwarded || null,
      'via': req.headers.via || null
    }
  });
});

// Protected whoami endpoint
router.get('/whoami', auth, (req, res) => {
  res.json({ success: true, userId: req.userId });
});

module.exports = router;
