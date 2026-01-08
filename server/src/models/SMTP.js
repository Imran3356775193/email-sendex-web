const mongoose = require('mongoose');

const smtpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ['gmail', 'outlook', 'yahoo', 'custom', 'sendgrid', 'amazon_ses', 'mailgun', 'zoho', 'mailjet', 'mailersend'],
    default: 'custom'
  },
  host: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    required: true
  },
  secure: {
    type: Boolean,
    default: true
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  fromName: String,
  fromEmail: String,
  dailyLimit: {
    type: Number,
    default: 500
  },
  hourlyLimit: {
    type: Number,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  stats: {
    sentToday: { type: Number, default: 0 },
    sentThisHour: { type: Number, default: 0 },
    totalSent: { type: Number, default: 0 },
    lastUsed: Date
  },
  healthCheck: {
    lastChecked: Date,
    status: {
      type: String,
      enum: ['healthy', 'slow', 'failing', 'dead'],
      default: 'healthy'
    },
    responseTime: Number,
    lastError: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
smtpSchema.index({ userId: 1, isActive: 1, priority: 1 });
smtpSchema.index({ userId: 1, provider: 1 });
smtpSchema.index({ 'stats.lastUsed': 1 });

module.exports = mongoose.model('SMTP', smtpSchema);