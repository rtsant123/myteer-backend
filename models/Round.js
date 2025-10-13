const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  // Betting deadline times (calculated from house settings + date)
  frDeadline: {
    type: Date,
    required: true
  },
  srDeadline: {
    type: Date,
    required: true
  },
  // Actual result times (when admin updates results)
  frResultTime: Date,
  srResultTime: Date,
  // Results
  frResult: {
    type: Number,
    min: 0,
    max: 99
  },
  srResult: {
    type: Number,
    min: 0,
    max: 99
  },
  // Round status lifecycle
  status: {
    type: String,
    enum: ['pending', 'live', 'fr_closed', 'sr_closed', 'finished'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for efficient queries
roundSchema.index({ house: 1, date: -1 });
roundSchema.index({ status: 1, frDeadline: 1, srDeadline: 1 });

module.exports = mongoose.model('Round', roundSchema);
