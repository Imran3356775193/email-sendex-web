const express = require('express');
const router = express.Router();
const EmailService = require('../services/EmailService');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const auth = require('../middleware/auth');

// Start a new campaign
router.post('/start', auth, async (req, res) => {
  try {
    const {
      name,
      subject,
      body,
      htmlBody,
      isHtml = true,
      templateId,
      contactIds = [],
      tagFilter = null,
      workers = 4,
      emailsPerWorker = 50,
      delayBetweenEmails = 5,
      retryAttempts = 3,
      smtpStrategy = 'rotation',
      scheduledFor = null
    } = req.body;

    // Get contacts based on filters
    let contacts = [];
    if (contactIds.length > 0) {
      contacts = await Contact.find({
        _id: { $in: contactIds },
        userId: req.userId,
        status: 'active'
      }).select('email firstName lastName company position phone');
    } else if (tagFilter) {
      contacts = await Contact.find({
        userId: req.userId,
        tags: tagFilter,
        status: 'active'
      }).select('email firstName lastName company position phone');
    } else {
      // Get all active contacts
      contacts = await Contact.find({
        userId: req.userId,
        status: 'active'
      }).select('email firstName lastName company position phone');
    }

    if (contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No contacts found for the campaign'
      });
    }

    const campaignData = {
      contacts,
      subject,
      body,
      htmlBody,
      isHtml,
      templateId,
      workers,
      emailsPerWorker,
      delayBetweenEmails,
      retryAttempts,
      smtpStrategy,
      campaignName: name
    };

    // If scheduled for future, create campaign record but don't start
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      const campaign = new Campaign({
        campaignId: require('uuid').v4(),
        userId: req.userId,
        name,
        subject,
        templateId,
        totalContacts: contacts.length,
        workers,
        emailsPerWorker,
        delayBetweenEmails,
        retryAttempts,
        smtpStrategy,
        status: 'draft',
        scheduledFor: new Date(scheduledFor)
      });

      await campaign.save();

      return res.json({
        success: true,
        message: 'Campaign scheduled successfully',
        campaignId: campaign.campaignId,
        scheduledFor: campaign.scheduledFor,
        totalContacts: contacts.length
      });
    }

    // Start campaign immediately
    const result = await EmailService.sendBulkEmails(campaignData, req.userId);

    res.json({
      success: true,
      message: 'Campaign started successfully',
      ...result
    });
  } catch (error) {
    console.error('Campaign start error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get campaign status
router.get('/status/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await Campaign.findOne({
      campaignId,
      userId: req.userId
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const status = await EmailService.getCampaignStatus(campaignId);

    res.json({
      success: true,
      campaign: status || campaign
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List campaigns
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.userId };
    if (status) {
      query.status = status;
    }

    const campaigns = await Campaign.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Campaign.countDocuments(query);

    // Get active campaigns with real-time data
    const activeCampaigns = await EmailService.getActiveCampaigns(req.userId);

    res.json({
      success: true,
      campaigns,
      activeCampaigns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop campaign
router.post('/stop/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const result = await EmailService.stopCampaign(campaignId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause campaign
router.post('/pause/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const result = await EmailService.pauseCampaign(campaignId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume campaign
router.post('/resume/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const result = await EmailService.resumeCampaign(campaignId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get campaign emails
router.get('/:campaignId/emails', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { page = 1, limit = 50, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      campaignId,
      userId: req.userId
    };
    if (status) {
      query.status = status;
    }

    const emails = await Email.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-htmlBody -__v');

    const total = await Email.countDocuments(query);

    const stats = await Email.aggregate([
      {
        $match: {
          campaignId,
          userId: new mongoose.Types.ObjectId(req.userId)
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      emails,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete campaign
router.delete('/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;

    // First, stop if running
    try {
      await EmailService.stopCampaign(campaignId);
    } catch (e) {
      // Campaign might not be running
    }

    // Delete campaign and related emails
    const [campaignResult, emailResult] = await Promise.all([
      Campaign.deleteOne({ campaignId, userId: req.userId }),
      Email.deleteMany({ campaignId, userId: req.userId })
    ]);

    res.json({
      success: true,
      message: 'Campaign deleted successfully',
      deletedCampaigns: campaignResult.deletedCount,
      deletedEmails: emailResult.deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// Placeholder for now - we'll implement later
router.get('/', auth, async (req, res) => {
  res.json({
    success: true,
    campaigns: []
  });
});

module.exports = router;