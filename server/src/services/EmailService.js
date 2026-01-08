const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const SMTP = require('../models/SMTP');
const Email = require('../models/Email');
const Contact = require('../models/Contact');
const { ClickTracking } = require('../models/Tracking');

class EmailService {
  constructor() {
    this.activeWorkers = new Map();
  }

  // Simplified email sending service
  async sendEmail(emailData, userId) {
    try {
      const {
        to,
        subject,
        body,
        htmlBody,
        isHtml = true,
        fromName,
        fromEmail,
        smtpConfig,
        trackingEnabled = true
      } = emailData;

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: parseInt(smtpConfig.port),
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Prepare recipients list
      const recipients = Array.isArray(to) ? to : [to];

      const results = [];

      // Send individual emails to each recipient so tracking and status are per-recipient
      for (const recipient of recipients) {
        const emailRecord = new Email({
          userId: new mongoose.Types.ObjectId(userId),
          campaignId: emailData.campaignId || undefined,
          from: {
            name: fromName || smtpConfig.auth.user,
            email: fromEmail || smtpConfig.auth.user
          },
          to: [{ email: recipient }],
          subject,
          body,
          htmlBody: htmlBody || body,
          isHtml,
          status: 'sending'
        });

        // Add tracking per recipient if enabled (pixel + link click tracking)
        let finalHtml = emailRecord.htmlBody;
        if (trackingEnabled && isHtml) {
          const pixelId = uuidv4();

          // Find all links and create click tracking records
          const htmlSource = finalHtml || body || '';
          const linkRegex = /href=(["'])(https?:\/\/[^"']+)\1/gi;
          const matches = [...htmlSource.matchAll(linkRegex)];

          emailRecord.tracking = { enabled: true, pixelId, clickIds: [] };

          for (const m of matches) {
            const originalUrl = m[2];
            const clickId = uuidv4();
            try {
              const clickRec = new ClickTracking({
                clickId,
                emailId: emailRecord._id,
                recipientEmail: recipient,
                originalUrl,
                clickedUrl: originalUrl
              });
              await clickRec.save();
              emailRecord.tracking.clickIds.push(clickId);
            } catch (e) {
              console.error('Failed to save click tracking', e);
            }
          }

          // Replace links with tracked redirect URLs in order
          let clickIndex = 0;
          finalHtml = htmlSource.replace(linkRegex, (full, quote, url) => {
            const ct = emailRecord.tracking.clickIds[clickIndex++] || uuidv4();
            const trackedUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/tracking/click/${ct}?url=${encodeURIComponent(url)}`;
            return `href="${trackedUrl}"`;
          });

          // Append tracking pixel that hits the server tracking endpoint
          const trackingPixel = `<img src="${process.env.BASE_URL || 'http://localhost:5000'}/api/tracking/pixel/${pixelId}" width="1" height="1" style="display:none;" alt=""/>`;
          if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${trackingPixel}</body>`);
          } else {
            finalHtml += trackingPixel;
          }

          emailRecord.tracking.pixelId = pixelId;
          emailRecord.htmlBody = finalHtml;
        }

        await emailRecord.save();

        const mailOptions = {
          from: `"${fromName || smtpConfig.auth.user}" <${fromEmail || smtpConfig.auth.user}>`,
          to: recipient,
          subject,
          ...(isHtml ? { html: emailRecord.htmlBody } : { text: body })
        };

        try {
          const info = await transporter.sendMail(mailOptions);

          emailRecord.status = 'sent';
          emailRecord.sentAt = new Date();
          emailRecord.stats = emailRecord.stats || {};
          emailRecord.stats.sent = 1;
          await emailRecord.save();

          if (global.io) {
            global.io.emit('email-sent', {
              emailId: emailRecord._id,
              messageId: info.messageId,
              recipient: recipient
            });
          }

          results.push({ success: true, recipient, emailId: emailRecord._id, messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) });
        } catch (sendErr) {
          console.error('Send error for', recipient, sendErr);
          emailRecord.status = 'failed';
          emailRecord.error = sendErr.message;
          await emailRecord.save();
          results.push({ success: false, recipient, error: sendErr.message });
        }
      }

      // Summary
      const sentCount = results.filter(r => r.success).length;
      const failedCount = results.length - sentCount;

      return {
        success: true,
        total: results.length,
        sent: sentCount,
        failed: failedCount,
        results
      };

    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  // Get available SMTP
  async getAvailableSMTP(userId) {
    const smtpConfigs = await SMTP.find({
      userId: new mongoose.Types.ObjectId(userId),
      isActive: true
    }).sort({ priority: 1 }).limit(5);

    if (smtpConfigs.length === 0) {
      throw new Error('No available SMTP servers');
    }

    return smtpConfigs[0];
  }

  // Get email statistics
  async getEmailStats(userId, period = '30d') {
    const dateFilter = this.getDateFilter(period);
    
    const stats = await Email.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          sentAt: { $gte: dateFilter },
          status: 'sent'
        }
      },
      {
        $group: {
          _id: null,
          totalSent: { $sum: 1 },
          totalRecipients: { $sum: { $size: '$to' } },
          totalOpened: { $sum: '$stats.opened' },
          totalClicked: { $sum: '$stats.clicked' },
          totalBounced: { $sum: '$stats.bounced' }
        }
      }
    ]);

    return stats[0] || {
      totalSent: 0,
      totalRecipients: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0
    };
  }

  getDateFilter(period) {
    const now = new Date();
    switch (period) {
      case 'today':
        return new Date(now.setHours(0, 0, 0, 0));
      case '7d':
        return new Date(now.setDate(now.getDate() - 7));
      case '30d':
        return new Date(now.setDate(now.getDate() - 30));
      default:
        return new Date(0); // All time
    }
  }

  // Worker management
  getWorkerStatus(workerId) {
    return this.activeWorkers.get(workerId) || null;
  }

  getAllActiveWorkers() {
    return Array.from(this.activeWorkers.entries()).map(([id, data]) => ({ id, ...data }));
  }
}

module.exports = new EmailService();