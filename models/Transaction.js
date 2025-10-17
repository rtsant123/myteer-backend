const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'deposit',
      'withdrawal',
      'withdrawal_pending',
      'withdrawal_approved',
      'withdrawal_refund',
      'bet_placed',
      'bet_won',
      'bet_lost'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  balanceBefore: {
    type: Number,
    required: true
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  description: String,
  relatedBet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet'
  },
  relatedWithdrawal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
