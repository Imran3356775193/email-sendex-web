const express = require('express');
const router = express.Router();
const { Tracking, ClickTracking } = require('../models/Tracking');
const Email = require('../models/Email');
const geoip = require('geoip-lite');
const UserAgent = require('ua-parser-js');

// Track email open
router.get('/pixel/:pixelId', async (req, res) => {
  try {
    const { pixelId } = req.params;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ua = new UserAgent(userAgent);

    // Find tracking record
    const tracking = await Tracking.findOne({ pixelId });
    if (tracking) {
      // Update tracking stats
      tracking.openedCount += 1;
      tracking.lastOpened = new Date();
      tracking.recipientIp = ip;
      tracking.userAgent = userAgent;
      
      // Determine device type
      if (ua.device.type === 'mobile') {
        tracking.device = 'mobile';
      } else if (ua.device.type === 'tablet') {
        tracking.device = 'tablet';
      } else if (ua.os.name) {
        tracking.device = 'desktop';
      } else {
        tracking.device = 'unknown';
      }

      // Get location from IP
      const geo = geoip.lookup(ip);
      if (geo) {
        tracking.location = {
          country: geo.country,
          city: geo.city,
          region: geo.region
        };
      }

      await tracking.save();

      // Update email stats
      await Email.findByIdAndUpdate(tracking.emailId, {
        $inc: { 'stats.opened': 1 },
        $set: { 'stats.lastOpened': new Date() }
      });
    }

    // Return transparent 1x1 pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.send(pixel);
  } catch (error) {
    console.error('Tracking error:', error);
    // Still return pixel even if tracking fails
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    res.send(pixel);
  }
});

// Track link click
router.get('/click/:clickId', async (req, res) => {
  try {
    const { clickId } = req.params;
    const { url, email } = req.query;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!url) {
      return res.redirect('/');
    }

    // Decode URL
    const decodedUrl = decodeURIComponent(url);

    // Find click tracking record
    const clickTracking = await ClickTracking.findOne({ clickId });
    if (clickTracking) {
      // Update click stats
      clickTracking.clickCount += 1;
      clickTracking.lastClicked = new Date();
      clickTracking.recipientIp = ip;
      clickTracking.userAgent = userAgent;
      await clickTracking.save();

      // Update email stats
      await Email.findByIdAndUpdate(clickTracking.emailId, {
        $inc: { 'stats.clicked': 1 },
        $set: { 'stats.lastClicked': new Date() }
      });
    }

    // Redirect to original URL
    res.redirect(decodedUrl);
  } catch (error) {
    console.error('Click tracking error:', error);
    // Redirect anyway
    const url = req.query.url ? decodeURIComponent(req.query.url) : '/';
    res.redirect(url);
  }
});

// Get tracking stats for email (protected)
router.get('/stats/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify user has access to this email
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const email = await Email.findOne({
      _id: emailId,
      userId: decoded.userId
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }

    // Get tracking stats
    const trackingStats = await Tracking.aggregate([
      { $match: { emailId: email._id } },
      {
        $group: {
          _id: null,
          totalOpens: { $sum: '$openedCount' },
          uniqueOpens: { $sum: 1 },
          lastOpen: { $max: '$lastOpened' },
          devices: {
            $push: {
              $cond: [
                { $ne: ['$device', null] },
                '$device',
                'unknown'
              ]
            }
          },
          countries: {
            $push: {
              $cond: [
                { $and: [{ $ne: ['$location', null] }, { $ne: ['$location.country', null] }] },
                '$location.country',
                'Unknown'
              ]
            }
          }
        }
      }
    ]);

    // Get click stats
    const clickStats = await ClickTracking.aggregate([
      { $match: { emailId: email._id } },
      {
        $group: {
          _id: '$originalUrl',
          clicks: { $sum: '$clickCount' },
          uniqueClicks: { $sum: 1 },
          lastClick: { $max: '$lastClicked' }
        }
      },
      { $sort: { clicks: -1 } }
    ]);

    // Get timeline data
    const opensByDay = await Tracking.aggregate([
      { $match: { emailId: email._id } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$openedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const clicksByDay = await ClickTracking.aggregate([
      { $match: { emailId: email._id } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$clickedAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      tracking: trackingStats[0] || {
        totalOpens: 0,
        uniqueOpens: 0,
        lastOpen: null,
        devices: [],
        countries: []
      },
      clicks: clickStats,
      timeline: {
        opens: opensByDay,
        clicks: clicksByDay
      },
      emailStats: email.stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get campaign tracking stats
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Verify user has access to this campaign
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    const Campaign = require('../models/Campaign');
    const campaign = await Campaign.findOne({
      campaignId,
      userId: decoded.userId
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Get all emails for this campaign
    const emails = await Email.find({
      campaignId,
      userId: decoded.userId
    }).select('_id stats');

    const emailIds = emails.map(email => email._id);

    // Aggregate campaign stats
    const campaignStats = await Tracking.aggregate([
      { $match: { emailId: { $in: emailIds } } },
      {
        $group: {
          _id: null,
          totalOpens: { $sum: '$openedCount' },
          uniqueOpens: { $sum: 1 }
        }
      }
    ]);

    const clickStats = await ClickTracking.aggregate([
      { $match: { emailId: { $in: emailIds } } },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: '$clickCount' },
          uniqueClicks: { $sum: 1 }
        }
      }
    ]);

    // Calculate rates
    const totalSent = emails.reduce((sum, email) => sum + (email.stats?.sent || 0), 0);
    const totalOpened = campaignStats[0]?.totalOpens || 0;
    const totalClicked = clickStats[0]?.totalClicks || 0;

    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

    res.json({
      success: true,
      stats: {
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        openRate: parseFloat(openRate.toFixed(2)),
        clickRate: parseFloat(clickRate.toFixed(2))
      },
      emailCount: emails.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;