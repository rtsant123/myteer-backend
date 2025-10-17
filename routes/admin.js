const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const House = require('../models/House');
const Round = require('../models/Round');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');

// @route   GET /api/admin/stats
// @desc    Get admin statistics
// @access  Private/Admin
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalHouses = await House.countDocuments();
    const totalRounds = await Round.countDocuments();
    const totalBets = await Bet.countDocuments();
    const totalDeposits = await Deposit.countDocuments();
    const totalWithdrawals = await Withdrawal.countDocuments();

    // Calculate total amounts
    const [depositStats, withdrawalStats, betStats] = await Promise.all([
      Deposit.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Withdrawal.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Bet.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        users: totalUsers,
        houses: totalHouses,
        rounds: totalRounds,
        bets: totalBets,
        deposits: totalDeposits,
        withdrawals: totalWithdrawals,
        totalDepositAmount: depositStats[0]?.total || 0,
        totalWithdrawalAmount: withdrawalStats[0]?.total || 0,
        totalBetAmount: betStats[0]?.total || 0,
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/cleanup
// @desc    Clean database (remove all game data, keep users)
// @access  Private/Admin
router.post('/cleanup', protect, adminOnly, async (req, res) => {
  try {
    console.log('🗑️  Admin triggered database cleanup');
    console.log(`👤 Admin: ${req.user.name} (${req.user._id})`);

    // Count before cleanup
    const beforeCounts = {
      houses: await House.countDocuments(),
      rounds: await Round.countDocuments(),
      bets: await Bet.countDocuments(),
      transactions: await Transaction.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments(),
      paymentMethods: await PaymentMethod.countDocuments(),
    };

    console.log('📊 Before cleanup:', beforeCounts);

    // Delete all game data
    const [
      roundsDeleted,
      housesDeleted,
      betsDeleted,
      transactionsDeleted,
      depositsDeleted,
      withdrawalsDeleted,
      paymentMethodsDeleted
    ] = await Promise.all([
      Round.deleteMany({}),
      House.deleteMany({}),
      Bet.deleteMany({}),
      Transaction.deleteMany({}),
      Deposit.deleteMany({}),
      Withdrawal.deleteMany({}),
      PaymentMethod.deleteMany({})
    ]);

    // Count after cleanup
    const afterCounts = {
      houses: await House.countDocuments(),
      rounds: await Round.countDocuments(),
      bets: await Bet.countDocuments(),
      transactions: await Transaction.countDocuments(),
      deposits: await Deposit.countDocuments(),
      withdrawals: await Withdrawal.countDocuments(),
      paymentMethods: await PaymentMethod.countDocuments(),
    };

    console.log('📊 After cleanup:', afterCounts);
    console.log('✅ Database cleanup completed');

    res.json({
      success: true,
      message: 'Database cleaned successfully. All game data removed, users preserved.',
      deleted: {
        rounds: roundsDeleted.deletedCount,
        houses: housesDeleted.deletedCount,
        bets: betsDeleted.deletedCount,
        transactions: transactionsDeleted.deletedCount,
        deposits: depositsDeleted.deletedCount,
        withdrawals: withdrawalsDeleted.deletedCount,
        paymentMethods: paymentMethodsDeleted.deletedCount,
      },
      before: beforeCounts,
      after: afterCounts
    });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
