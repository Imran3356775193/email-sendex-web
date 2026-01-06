const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  campaignId: {
    type: String,
    required: true,
    unique: true
  },
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
  subject: String,
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  },
  totalContacts: {
    type: Number,
    required: true
  },
  workers: {
    type: Number,
    default: 4
  },
  emailsPerWorker: {
    type: Number,
    default: 50
  },
  delayBetweenEmails: {
    type: Number,
    default: 5
  },
  retryAttempts: {
    type: Number,
    default: 3
  },
  smtpStrategy: {
    type: String,
    enum: ['rotation', 'parallel'],
    default: 'rotation'
  },
  status: {
    type: String,
    enum: ['draft', 'starting', 'running', 'paused', 'stopped', 'completed', 'failed', 'partial'],
    default: 'draft'
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  sent: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  activeWorkers: {
    type: Number,
    default: 0
  },
  stats: {
    openRate: Number,
    clickRate: Number,
    bounceRate: Number,
    unsubscribeRate: Number
  },
  scheduledFor: Date,
  startedAt: Date,
  completedAt: Date,
  error: String,
  notes: String
}, {
  timestamps: true
});

// Indexes
campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ campaignId: 1 });
campaignSchema.index({ createdAt: -1 });
campaignSchema.index({ scheduledFor: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);