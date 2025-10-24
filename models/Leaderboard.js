const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for fake entries
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: '' // Masked phone for display
  },
  totalWins: {
    type: Number,
    required: true,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  rank: {
    type: Number,
    default: 0
  },
  isFake: {
    type: Boolean,
    default: false
  },
  weekStart: {
    type: Date,
    required: true
  },
  weekEnd: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for quick queries
leaderboardSchema.index({ weekStart: 1, weekEnd: 1, totalAmount: -1 });

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
