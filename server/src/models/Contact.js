const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: String,
  lastName: String,
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  phone: String,
  company: String,
  position: String,
  tags: [String],
  status: {
    type: String,
    enum: ['active', 'unsubscribed', 'bounced', 'complaint'],
    default: 'active'
  },
  customFields: mongoose.Schema.Types.Mixed,
  lastContacted: Date,
  notes: String,
  source: String,
  importBatch: String,
  emailStats: {
    sent: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    lastOpened: Date,
    lastClicked: Date
  }
}, {
  timestamps: true
});

// Indexes
contactSchema.index({ userId: 1, email: 1 }, { unique: true });
contactSchema.index({ userId: 1, tags: 1 });
contactSchema.index({ userId: 1, status: 1 });
contactSchema.index({ userId: 1, lastName: 1, firstName: 1 });

module.exports = mongoose.model('Contact', contactSchema);