const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
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
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  htmlBody: String,
  isHtml: {
    type: Boolean,
    default: true
  },
  category: {
    type: String,
    default: 'general'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  variables: [{
    name: String,
    description: String,
    defaultValue: String
  }],
  usedCount: {
    type: Number,
    default: 0
  },
  lastUsed: Date
}, {
  timestamps: true
});

// Indexes
templateSchema.index({ userId: 1, name: 1 });
templateSchema.index({ isPublic: 1 });
templateSchema.index({ category: 1 });

module.exports = mongoose.model('Template', templateSchema);