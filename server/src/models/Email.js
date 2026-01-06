const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  campaignId: String,
  from: {
    name: String,
    email: String
  },
  to: [{
    email: String,
    name: String,
    contactId: mongoose.Schema.Types.ObjectId
  }],
  cc: [{
    email: String,
    name: String
  }],
  bcc: [{
    email: String,
    name: String
  }],
  subject: String,
  body: String,
  htmlBody: String,
  isHtml: {
    type: Boolean,
    default: true
  },
  attachments: [{
    filename: String,
    path: String,
    size: Number,
    mimetype: String
  }],
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  tracking: {
    enabled: {
      type: Boolean,
      default: true
    },
    pixelId: String,
    clickIds: [String]
  },
  smtpUsed: {
    id: mongoose.Schema.Types.ObjectId,
    name: String,
    host: String
  },
  status: {
    type: String,
    enum: ['draft', 'queued', 'sending', 'sent', 'failed', 'partial'],
    default: 'draft'
  },
  stats: {
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    },
    bounced: {
      type: Number,
      default: 0
    },
    unsubscribed: {
      type: Number,
      default: 0
    }
  },
  workerId: String,
  sentAt: Date,
  completedAt: Date,
  error: String
}, {
  timestamps: true
});

// Indexes for better query performance
emailSchema.index({ userId: 1, status: 1, sentAt: -1 });
emailSchema.index({ campaignId: 1 });
emailSchema.index({ 'tracking.pixelId': 1 }, { sparse: true });
emailSchema.index({ sentAt: -1 });

module.exports = mongoose.model('Email', emailSchema);