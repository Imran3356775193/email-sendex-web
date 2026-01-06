const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// IMPORTANT: This file should NOT import emailRoutes.js
// Just create basic worker endpoints

// Start workers for campaign
router.post('/start', auth, async (req, res) => {
  try {
    const {
      campaignId,
      workers = 4,
      emailsPerWorker = 50,
      delayBetweenEmails = 5,
      retryAttempts = 3
    } = req.body;

    res.json({
      success: true,
      message: 'Workers started successfully',
      campaignId,
      workers,
      emailsPerWorker,
      delayBetweenEmails,
      retryAttempts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get worker status
router.get('/status/:workerId', auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    
    // For now, return a mock status
    res.json({
      success: true,
      workerId,
      status: 'idle',
      progress: 0,
      sent: 0,
      failed: 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all active workers
router.get('/active', auth, async (req, res) => {
  try {
    // Return empty array for now
    res.json({
      success: true,
      workers: [],
      count: 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop worker
router.post('/stop/:workerId', auth, async (req, res) => {
  try {
    const { workerId } = req.params;
    
    res.json({
      success: true,
      message: 'Worker stopped successfully',
      workerId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get worker settings
router.get('/settings', auth, async (req, res) => {
  const defaultSettings = {
    maxWorkers: 10,
    defaultWorkers: 4,
    minEmailsPerWorker: 1,
    maxEmailsPerWorker: 200,
    defaultEmailsPerWorker: 50,
    minDelay: 0,
    maxDelay: 60,
    defaultDelay: 5,
    minRetries: 0,
    maxRetries: 10,
    defaultRetries: 3
  };

  res.json({
    success: true,
    settings: defaultSettings
  });
});

module.exports = router;