const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');
const SMTP = require('../models/SMTP');
const Email = require('../models/Email');

// Overview stats: imported emails (contacts), smtp count, total sent/failed
router.get('/overview', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const importedEmails = await Contact.countDocuments({ userId });
    const smtpCount = await SMTP.countDocuments({ userId });
    const totalSent = await Email.countDocuments({ userId, status: 'sent' });
    const totalFailed = await Email.countDocuments({ userId, status: 'failed' });

    res.json({ success: true, data: { importedEmails, smtpCount, totalSent, totalFailed } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Performance metrics (aggregate recent stats)
router.get('/performance', auth, async (req, res) => {
  try {
    const userId = req.userId;
    // Simple performance metrics: sent per minute (last 5 min), success rate (last 24h)
    const fiveMinAgo = new Date(Date.now() - (5 * 60 * 1000));
    const dayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

    const recentSent = await Email.countDocuments({ userId, status: 'sent', sentAt: { $gte: fiveMinAgo } });
    const recentTotal = await Email.countDocuments({ userId, sentAt: { $gte: fiveMinAgo } });

    const daySent = await Email.countDocuments({ userId, status: 'sent', sentAt: { $gte: dayAgo } });
    const dayTotal = await Email.countDocuments({ userId, sentAt: { $gte: dayAgo } });

    const sentPerMinute = Math.round((recentSent / 5) * 100) / 100; // avg per minute
    const successRate = dayTotal === 0 ? 100 : Math.round((daySent / dayTotal) * 1000) / 10;

    res.json({ success: true, data: { sentPerMinute, successRate, recentSent, daySent } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;