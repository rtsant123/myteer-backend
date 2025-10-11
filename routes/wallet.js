const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/wallet/balance
// @desc    Get user balance
// @access  Private
router.get('/balance', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balance');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      balance: user.balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/wallet/transactions
// @desc    Get user transactions
// @access  Private
router.get('/transactions', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filter by transaction type if provided
    const filter = { user: req.user._id };
    if (req.query.type) {
      filter.type = req.query.type;
    }

    // Filter by status if provided
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const transactions = await Transaction.find(filter)
      .populate('relatedBet')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Transaction.countDocuments(filter);

    // Calculate summary
    const summary = await Transaction.aggregate([
      { $match: { user: req.user._id, status: 'completed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      count: transactions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      transactions,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/wallet/bonus
// @desc    Admin gives bonus to user
// @access  Private/Admin
router.post('/bonus', protect, adminOnly, async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'User ID and amount are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be positive'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const balanceBefore = user.balance;
    user.balance += amount;
    await user.save();

    // Create transaction
    const transaction = await Transaction.create({
      user: userId,
      type: 'deposit',
      amount,
      balanceBefore,
      balanceAfter: user.balance,
      description: description || `Bonus from admin`,
      status: 'completed'
    });

    res.json({
      success: true,
      message: 'Bonus added successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
