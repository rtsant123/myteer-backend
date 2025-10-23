const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  referralCode: {
    type: String,
    required: true
  },
  rewardAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Referral', referralSchema);
