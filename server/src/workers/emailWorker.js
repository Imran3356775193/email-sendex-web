const emailQueue = require('../queues/emailQueue');
const EmailService = require('../services/EmailService');
const SMTP = require('../models/SMTP');
const Campaign = require('../models/Campaign');

// Simple concurrency runner
const runWithConcurrency = async (tasks, concurrency) => {
  const results = [];
  let index = 0;
  const workers = new Array(Math.min(concurrency, tasks.length)).fill(null).map(async () => {
    while (true) {
      const i = index++;
      if (i >= tasks.length) break;
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() };
      } catch (err) {
        results[i] = { status: 'rejected', reason: err.message || String(err) };
      }
    }
  });
  await Promise.all(workers);
  return results;
};

emailQueue.process(async (job) => {
  const data = job.data || {};
  const {
    recipients = [],
    subject,
    body,
    htmlBody,
    isHtml = true,
    fromName,
    fromEmail,
    smtpIds = [],
    smtpStrategy = 'rotation',
    trackingEnabled = true,
    concurrency = 10,
    campaignId,
    userId
  } = data;

  // Load SMTP configs
  let smtpConfigs = [];
  if (Array.isArray(smtpIds) && smtpIds.length > 0) {
    smtpConfigs = await SMTP.find({ userId: userId, _id: { $in: smtpIds }, isActive: true }).lean();
  }

  // Fallback: get at least one SMTP for user
  if (smtpConfigs.length === 0) {
    const smtp = await SMTP.findOne({ userId: userId, isActive: true }).lean();
    if (smtp) smtpConfigs = [smtp];
  }

  if (smtpConfigs.length === 0) {
    throw new Error('No SMTP configs available for user');
  }

  // Prepare tasks per recipient
  const tasks = recipients.map((r, i) => async () => {
    const recipient = typeof r === 'string' ? r : r.email || r;
    const smtp = smtpConfigs[i % smtpConfigs.length];
    const smtpConfig = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.username || smtp.auth?.user, pass: smtp.password || smtp.auth?.pass }
    };

    const emailData = {
      to: recipient,
      subject,
      body,
      htmlBody,
      isHtml,
      fromName,
      fromEmail,
      smtpConfig,
      trackingEnabled,
      campaignId
    };

    return await EmailService.sendEmail(emailData, userId);
  });

  // Run tasks with concurrency
  const results = await runWithConcurrency(tasks, parseInt(concurrency) || 10);

  // Update campaign progress if present
  if (campaignId) {
    try {
      const sent = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - sent;
      const campaign = await Campaign.findOne({ campaignId, userId });
      if (campaign) {
        campaign.sent = (campaign.sent || 0) + sent;
        campaign.failed = (campaign.failed || 0) + failed;
        campaign.progress = Math.min(100, Math.round(((campaign.sent + campaign.failed) / (campaign.totalContacts || recipients.length)) * 100));
        if (campaign.progress >= 100) {
          campaign.status = 'completed';
          campaign.completedAt = new Date();
        } else {
          campaign.status = 'running';
        }
        await campaign.save();

        // Emit progress via socket if available
        if (global.io) {
          global.io.emit('campaign-progress', { campaignId, sent: campaign.sent, failed: campaign.failed, progress: campaign.progress });
        }
      }
    } catch (err) {
      console.error('Failed to update campaign progress:', err);
    }
  }

  return { total: results.length, sent: results.filter(r => r.status === 'fulfilled').length, failed: results.filter(r => r.status === 'rejected').length };
});

// Start listening to queue events for logging
emailQueue.on('completed', (job, result) => {
  console.info('Email job completed', job.id, result);
});

emailQueue.on('failed', (job, err) => {
  console.error('Email job failed', job.id, err);
});
