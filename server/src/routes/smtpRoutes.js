const express = require('express');
const router = express.Router();
const SMTP = require('../models/SMTP');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all SMTP configurations for user
router.get('/', auth, async (req, res) => {
  try {
    const smtpConfigs = await SMTP.find({ userId: req.userId }).sort({ priority: 1 });
    
    res.json({
      success: true,
      smtp: smtpConfigs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get SMTP status
router.get('/status', auth, async (req, res) => {
  try {
    const smtpConfigs = await SMTP.find({ userId: req.userId })
      .sort({ priority: 1 })
      .select('name provider host port isActive stats healthCheck');
    
    res.json({
      success: true,
      smtp: smtpConfigs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new SMTP configuration
router.post('/', auth, [
  body('name').notEmpty().withMessage('Name is required'),
  body('host').notEmpty().withMessage('Host is required'),
  body('port').isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      provider = 'custom',
      host,
      port,
      secure = true,
      username,
      password,
      fromName,
      fromEmail,
      dailyLimit = 500,
      hourlyLimit = 100,
      priority = 1
    } = req.body;

    // Check if SMTP with same name exists
    const existingSMTP = await SMTP.findOne({
      userId: req.userId,
      name
    });

    if (existingSMTP) {
      return res.status(400).json({
        success: false,
        error: 'SMTP configuration with this name already exists'
      });
    }

    const smtp = new SMTP({
      userId: req.userId,
      name,
      provider,
      host,
      port: parseInt(port),
      secure: secure === 'true' || secure === true,
      username,
      password,
      fromName,
      fromEmail: fromEmail || username,
      dailyLimit: parseInt(dailyLimit),
      hourlyLimit: parseInt(hourlyLimit),
      priority: parseInt(priority),
      isActive: true
    });

    await smtp.save();

    res.json({
      success: true,
      message: 'SMTP configuration saved successfully',
      smtp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update SMTP configuration
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const smtp = await SMTP.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: updates },
      { new: true }
    );

    if (!smtp) {
      return res.status(404).json({
        success: false,
        error: 'SMTP configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'SMTP configuration updated successfully',
      smtp
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete SMTP configuration
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const smtp = await SMTP.findOneAndDelete({
      _id: id,
      userId: req.userId
    });

    if (!smtp) {
      return res.status(404).json({
        success: false,
        error: 'SMTP configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'SMTP configuration deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test SMTP connection
router.post('/test/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const smtp = await SMTP.findOne({
      _id: id,
      userId: req.userId
    });

    if (!smtp) {
      return res.status(404).json({
        success: false,
        error: 'SMTP configuration not found'
      });
    }

    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();

    // Update health check
    smtp.healthCheck = {
      lastChecked: new Date(),
      status: 'healthy',
      responseTime: 100
    };
    await smtp.save();

    res.json({
      success: true,
      message: 'SMTP connection test successful'
    });
  } catch (error) {
    // Update health check with error
    await SMTP.findByIdAndUpdate(req.params.id, {
      $set: {
        'healthCheck.status': 'failing',
        'healthCheck.lastError': error.message,
        'healthCheck.lastChecked': new Date()
      }
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get default SMTP providers
router.get('/providers/default', auth, async (req, res) => {
  const defaultProviders = [
    {
      name: 'Gmail',
      provider: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      dailyLimit: 500,
      hourlyLimit: 100,
      instructions: 'Use App Password if 2-factor authentication is enabled'
    },
    {
      name: 'Outlook',
      provider: 'outlook',
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      dailyLimit: 500,
      hourlyLimit: 100
    },
    {
      name: 'Yahoo',
      provider: 'yahoo',
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      dailyLimit: 500,
      hourlyLimit: 100
    },
    {
      name: 'SendGrid',
      provider: 'sendgrid',
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      dailyLimit: 100,
      hourlyLimit: 30
    }
  ];

  res.json({
    success: true,
    providers: defaultProviders
  });
});

// Bulk import SMTP accounts from a text body (Host|port|username|password|frommail per line)
router.post('/import', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'No import text provided' });

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const created = [];

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length < 5) continue; // skip invalid
      const [host, port, username, password, fromEmail] = parts;
      const smtp = new SMTP({
        userId: req.userId,
        name: `${username}@${host}`,
        host,
        port: parseInt(port),
        secure: false,
        username,
        password,
        fromEmail,
        isActive: true
      });
      await smtp.save();
      created.push(smtp);
    }

    res.json({ success: true, createdCount: created.length, created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bulk delete all SMTP configs for user
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const result = await SMTP.deleteMany({ userId: req.userId });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;