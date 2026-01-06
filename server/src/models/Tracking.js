const mongoose = require('mongoose');

const trackingSchema = new mongoose.Schema({
  pixelId: {
    type: String,
    required: true,
    unique: true
  },
  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    required: true
  },
  recipientEmail: String,
  recipientIp: String,
  userAgent: String,
  location: {
    country: String,
    city: String,
    region: String
  },
  device: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  openedAt: {
    type: Date,
    default: Date.now
  },
  openedCount: {
    type: Number,
    default: 0
  },
  lastOpened: Date
}, {
  timestamps: true
});

const clickTrackingSchema = new mongoose.Schema({
  clickId: {
    type: String,
    required: true,
    unique: true
  },
  emailId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Email',
    required: true
  },
  recipientEmail: String,
  originalUrl: String,
  clickedUrl: String,
  recipientIp: String,
  userAgent: String,
  clickedAt: {
    type: Date,
    default: Date.now
  },
  clickCount: {
    type: Number,
    default: 0
  },
  lastClicked: Date
}, {
  timestamps: true
});

// Indexes
trackingSchema.index({ emailId: 1 });
trackingSchema.index({ pixelId: 1 });
trackingSchema.index({ openedAt: 1 });

clickTrackingSchema.index({ emailId: 1 });
clickTrackingSchema.index({ clickId: 1 });
clickTrackingSchema.index({ clickedAt: 1 });

module.exports = {
  Tracking: mongoose.model('Tracking', trackingSchema),
  ClickTracking: mongoose.model('ClickTracking', clickTrackingSchema)
};