const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const EmailService = require('../services/EmailService');
const auth = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Validation middleware
const validateEmail = [
  body('to').notEmpty().withMessage('Recipient email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('body').notEmpty().withMessage('Email body is required'),
  body('smtpConfig.host').notEmpty().withMessage('SMTP host is required'),
  body('smtpConfig.port').isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
  body('smtpConfig.auth.user').notEmpty().withMessage('Username is required'),
  body('smtpConfig.auth.pass').notEmpty().withMessage('Password is required')
];

// Bulk send using single/multiple SMTPs - enqueue job for worker
router.post('/send-bulk', auth, upload.array('attachments'), async (req, res) => {
  try {
    const {
      recipients = [],
      subject,
      body,
      htmlBody,
      isHtml = true,
      fromName,
      fromEmail,
      smtpStrategy = 'rotation',
      smtpIds = [],
      trackingEnabled = true,
      concurrency = 10
    } = req.body;

    const { campaignRequired = false, campaignName = '' } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Recipients are required' });
    }

    // Load SMTP configs
    let smtpConfigs = [];
    if (Array.isArray(smtpIds) && smtpIds.length > 0) {
      const SMTPModel = require('../models/SMTP');
      smtpConfigs = await SMTPModel.find({ userId: req.userId, _id: { $in: smtpIds }, isActive: true });
    }

    const EmailService = require('../services/EmailService');
    if (smtpConfigs.length === 0) {
      const smtp = await EmailService.getAvailableSMTP(req.userId).catch(() => null);
      if (smtp) smtpConfigs = [smtp];
    }

    if (smtpConfigs.length === 0) {
      return res.status(400).json({ success: false, error: 'No SMTP servers available' });
    }

    // If campaign requested, create campaign record
    let campaignDoc = null;
    if (campaignRequired) {
      const Campaign = require('../models/Campaign');
      const { v4: uuidv4 } = require('uuid');
      campaignDoc = new Campaign({
        campaignId: `cmp_${uuidv4()}`,
        userId: req.userId,
        name: campaignName || `Campaign ${new Date().toISOString()}`,
        subject: subject || '',
        totalContacts: Array.isArray(recipients) ? recipients.length : 0,
        status: 'starting',
        startedAt: new Date()
      });
      await campaignDoc.save();
    }

    // Enqueue job to process in background worker
    const emailQueue = require('../queues/emailQueue');

    const jobData = {
      recipients,
      subject,
      body,
      htmlBody,
      isHtml,
      fromName,
      fromEmail,
      smtpIds: smtpConfigs.map(s => s._id),
      smtpStrategy,
      trackingEnabled,
      concurrency: parseInt(concurrency) || 10,
      campaignId: campaignDoc ? campaignDoc.campaignId : null,
      userId: req.userId
    };

    const job = await emailQueue.add(jobData);

    res.json({ success: true, message: 'Bulk send enqueued', jobId: job.id, campaignId: campaignDoc ? campaignDoc.campaignId : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send single email
router.post('/send', auth, upload.array('attachments'), validateEmail, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      to,
      cc,
      bcc,
      subject,
      body,
      htmlBody,
      isHtml = true,
      fromName,
      fromEmail,
      smtpConfig,
      trackingEnabled = true,
      smtpStrategy = 'rotation'
    } = req.body;

    // Parse recipients
    const recipients = to.split(/[,;]/).map(email => email.trim());
    
    // Prepare attachments
    const attachments = req.files ? req.files.map(file => ({
      filename: file.originalname,
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    })) : [];

    const emailData = {
      to: recipients,
      cc: cc ? cc.split(/[,;]/).map(email => email.trim()) : [],
      bcc: bcc ? bcc.split(/[,;]/).map(email => email.trim()) : [],
      subject,
      body,
      htmlBody: htmlBody || body,
      isHtml,
      fromName,
      fromEmail,
      attachments,
      trackingEnabled,
      smtpStrategy,
      smtpConfig: {
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port),
        secure: smtpConfig.secure === 'true' || smtpConfig.secure === true,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass
        }
      }
    };

    const result = await EmailService.sendEmail(emailData, req.userId);

    res.json({
      success: true,
      message: 'Email sent successfully',
      ...result
    });

  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test SMTP connection
router.post('/test-connection', auth, async (req, res) => {
  try {
    const { smtpConfig } = req.body;

    if (!smtpConfig || !smtpConfig.host || !smtpConfig.auth) {
      return res.status(400).json({
        success: false,
        error: 'SMTP configuration is required'
      });
    }
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: parseInt(smtpConfig.port) || 587,
      secure: smtpConfig.secure === 'true' || smtpConfig.secure === true,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
      },
      tls: { rejectUnauthorized: false }
    });

    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection successful' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Get recent emails
router.get('/recent', auth, async (req, res) => {
  try {
    const Email = require('../models/Email');
    const emails = await Email.find({ userId: req.userId })
      .sort({ sentAt: -1 })
      .limit(10)
      .select('subject to status sentAt stats');

    res.json({
      success: true,
      emails
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get email statistics
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const stats = await EmailService.getEmailStats(req.userId);
    
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single email
router.get('/:id', auth, async (req, res) => {
  try {
    const Email = require('../models/Email');
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }

    res.json({
      success: true,
      email
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete email
router.delete('/:id', auth, async (req, res) => {
  try {
    const Email = require('../models/Email');
    const email = await Email.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'Email not found'
      });
    }

    res.json({
      success: true,
      message: 'Email deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear emails (by ids or all)
router.post('/clear', auth, async (req, res) => {
  try {
    const { ids, all } = req.body;

    if (Array.isArray(ids) && ids.length > 0) {
      const Email = require('../models/Email');
      const result = await Email.deleteMany({ userId: req.userId, _id: { $in: ids } });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} emails` });
    }

    if (all) {
      const Email = require('../models/Email');
      const result = await Email.deleteMany({ userId: req.userId });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} emails` });
    }

    return res.status(400).json({ success: false, error: 'No clear criteria provided' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;