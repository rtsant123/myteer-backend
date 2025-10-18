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
  // Single betting deadline for all game modes (calculated from house deadlineTime + date)
  deadline: {
    type: Date,
    required: true
  },
  // Deadline time as string (HH:MM) - for client-side local timezone display
  deadlineTime: {
    type: String,
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
  // Overall round status (for compatibility)
  status: {
    type: String,
    enum: ['pending', 'live', 'fr_closed', 'sr_closed', 'finished'],
    default: 'pending'
  },
  // Separate status for each game mode
  frStatus: {
    type: String,
    enum: ['pending', 'live', 'finished'],
    default: 'pending'
  },
  srStatus: {
    type: String,
    enum: ['not_available', 'pending', 'live', 'finished'],
    default: 'not_available' // SR is not available until FR result is published
  },
  forecastStatus: {
    type: String,
    enum: ['pending', 'live', 'finished'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Index for efficient queries
roundSchema.index({ house: 1, date: -1 });
roundSchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.model('Round', roundSchema);
