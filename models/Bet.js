const mongoose = require('mongoose');

const betEntrySchema = new mongoose.Schema({
  number: {
    type: Number,
    required: false,  // Not required for FORECAST mode
    min: 0,
    max: 99
  },
  frNumber: {
    type: Number,
    required: false,  // Required for FORECAST mode
    min: 0,
    max: 99
  },
  srNumber: {
    type: Number,
    required: false,  // Required for FORECAST mode
    min: 0,
    max: 99
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  playType: {
    type: String,
    enum: ['DIRECT', 'HOUSE', 'ENDING'],
    required: true
  },
  mode: {
    type: String,
    enum: ['FR', 'SR', 'FORECAST'],
    required: true
  },
  potentialWin: {
    type: Number,
    default: 0
  },
  isWinner: {
    type: Boolean,
    default: false
  },
  winAmount: {
    type: Number,
    default: 0
  }
});

const betSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  house: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'House',
    required: true
  },
  round: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    required: true
  },
  entries: [betEntrySchema],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  },
  totalWinAmount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for performance
betSchema.index({ user: 1, createdAt: -1 }); // Fast user bet history queries
betSchema.index({ round: 1, house: 1 }); // Fast round + house queries
betSchema.index({ status: 1 }); // Fast status filtering
betSchema.index({ createdAt: -1 }); // Fast recent bets queries
betSchema.index({ house: 1 }); // Fast house-specific queries

module.exports = mongoose.model('Bet', betSchema);
