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
      'withdrawal_pending',   // When withdrawal request is submitted
      'withdrawal_approved',  // When admin approves withdrawal
      'withdrawal_refund',    // When admin rejects withdrawal
      'bet',  // Changed from 'bet_placed' to match frontend
      'win',  // Changed from 'bet_won' to match frontend
      'refund'  // For bet refunds
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
