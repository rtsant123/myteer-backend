const mongoose = require('mongoose');

const betEntrySchema = new mongoose.Schema({
  number: {
    type: Number,
    required: true,
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

module.exports = mongoose.model('Bet', betSchema);
