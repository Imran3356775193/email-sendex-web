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

  // Prepare send settings
  const rotationCount = parseInt(data.emailsBeforeRotation) || 1; // default rotate every 1 email
  const restSeconds = parseInt(data.restSeconds) || 0; // default no rest
  const restAfter = parseInt(data.emailsBeforeRest) || 0; // rest after N emails
  const total = recipients.length;

  // Shared counters for progress and per-smtp counters
  let sentCount = 0;
  let failedCount = 0;
  const perSmtpSent = new Array(smtpConfigs.length).fill(0);
  let smtpIndex = 0;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Prepare tasks per recipient
  const tasks = recipients.map((r, i) => async () => {
    const recipient = typeof r === 'string' ? r : r.email || r;
    // pick smtp in round-robin starting at current smtpIndex
    const smtp = smtpConfigs[smtpIndex % smtpConfigs.length];
    const smtpConfig = {
      id: smtp._id,
      name: smtp.name || smtp.host,
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

    try {
      const result = await EmailService.sendEmail(emailData, userId);
      // treat as success if at least one sent
      if (result && result.sent > 0) {
        sentCount += result.sent;
        perSmtpSent[smtpIndex % smtpConfigs.length] += result.sent;

        // Emit sent events for each recipient/result item
        result.results.forEach(r => {
          if (r.success && global.io) {
            global.io.emit('send:sent', {
              recipient: r.recipient || recipient,
              smtp: smtpConfig,
              index: sentCount,
              total
            });
          }
        });
      }

      if (result && result.failed > 0) {
        failedCount += result.failed;
        // Emit failed events
        result.results.forEach(r => {
          if (!r.success && global.io) {
            global.io.emit('send:failed', {
              recipient: r.recipient || recipient,
              smtp: smtpConfig,
              reason: r.error || 'Unknown',
              index: sentCount + failedCount,
              total
            });
          }
        });
      }

      // Rotate if per-smtp rotationCount reached
      if (rotationCount > 0 && perSmtpSent[smtpIndex % smtpConfigs.length] >= rotationCount) {
        const from = smtpConfigs[smtpIndex % smtpConfigs.length];
        smtpIndex = (smtpIndex + 1) % smtpConfigs.length;
        const to = smtpConfigs[smtpIndex % smtpConfigs.length];
        // reset counter for new smtp bucket
        perSmtpSent[smtpIndex % smtpConfigs.length] = 0;
        if (global.io) global.io.emit('send:rotate', { from: from.host, to: to.host });
      }

      // Emit progress
      if (global.io) {
        const percent = Math.round(((sentCount + failedCount) / total) * 100);
        global.io.emit('send:progress', { sent: sentCount, failed: failedCount, total, percent });
      }

      // Rest if needed
      if (restAfter > 0 && (sentCount > 0) && (sentCount % restAfter === 0) && restSeconds > 0) {
        if (global.io) global.io.emit('send:rest', { duration: restSeconds, nextResumeAt: Date.now() + restSeconds * 1000 });
        await sleep(restSeconds * 1000);
      }

      return result;
    } catch (err) {
      failedCount += 1;
      if (global.io) global.io.emit('send:failed', { recipient, smtp: smtpConfig, reason: err.message || 'Error', index: sentCount + failedCount, total });
      if (global.io) {
        const percent = Math.round(((sentCount + failedCount) / total) * 100);
        global.io.emit('send:progress', { sent: sentCount, failed: failedCount, total, percent });
      }
      return { success: false, error: err.message };
    }
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
