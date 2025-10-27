const express = require('express');
const router = express.Router();
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const PaymentMethod = require('../models/PaymentMethod');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/withdrawals
// @desc    Submit withdrawal request
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { amount, paymentMethodId, paymentDetails } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    // Check minimum withdrawal amount (you can adjust this)
    const minWithdrawal = 100;
    if (amount < minWithdrawal) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minWithdrawal}`
      });
    }

    // Check if user has sufficient balance
    const user = await User.findById(req.user._id);
    if (user.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    // Check if payment method exists
    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod || !paymentMethod.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found or inactive'
      });
    }

    // Validate payment details based on payment method type
    if (paymentMethod.type === 'UPI' && !paymentDetails?.upiId) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID is required'
      });
    }

    if (paymentMethod.type === 'BANK') {
      if (!paymentDetails?.accountNumber || !paymentDetails?.ifscCode || !paymentDetails?.accountHolder) {
        return res.status(400).json({
          success: false,
          message: 'Bank account details are required'
        });
      }
    }

    // IMMEDIATE DEDUCTION: Deduct balance when request is created (not when approved)
    const balanceBefore = user.balance;
    user.balance -= amount;
    await user.save();

    // Create withdrawal request with balance already deducted
    let withdrawal;
    try {
      withdrawal = await Withdrawal.create({
        user: req.user._id,
        amount,
        paymentMethod: paymentMethodId,
        paymentDetails: paymentDetails || {},
        status: 'pending'
      });

      // Create pending withdrawal transaction
      await Transaction.create({
        user: user._id,
        type: 'withdrawal_pending',
        amount: -amount,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Withdrawal request pending (${paymentDetails?.upiId || paymentDetails?.accountNumber || 'N/A'})`,
        relatedWithdrawal: withdrawal._id,
        status: 'pending'
      });
    } catch (createError) {
      // Rollback balance deduction if withdrawal or transaction creation fails
      user.balance = balanceBefore;
      await user.save();
      throw createError; // Re-throw to be caught by outer catch
    }

    const populatedWithdrawal = await Withdrawal.findById(withdrawal._id)
      .populate('user', 'name phone')
      .populate('paymentMethod');

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Amount deducted from wallet.',
      withdrawal: populatedWithdrawal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/withdrawals
// @desc    Get all withdrawals (admin only)
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filter by status if provided
    const filter = {};
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

    const withdrawals = await Withdrawal.find(filter)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Withdrawal.countDocuments(filter);

    // Calculate summary
    const summary = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      count: withdrawals.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      withdrawals,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/withdrawals/user
// @desc    Get user's own withdrawals
// @access  Private
router.get('/user', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const withdrawals = await Withdrawal.find(filter)
      .populate('paymentMethod')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Withdrawal.countDocuments(filter);

    res.json({
      success: true,
      count: withdrawals.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      withdrawals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/withdrawals/:id
// @desc    Get withdrawal by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    // Users can only view their own withdrawals unless admin
    if (withdrawal.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this withdrawal'
      });
    }

    res.json({
      success: true,
      withdrawal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/withdrawals/:id/approve
// @desc    Approve withdrawal
// @access  Private/Admin
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal has already been processed'
      });
    }

    // Get user (balance already deducted when request was created)
    const user = await User.findById(withdrawal.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update withdrawal status to approved
    withdrawal.status = 'approved';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    if (req.body.adminNote) {
      withdrawal.adminNote = req.body.adminNote;
    }
    await withdrawal.save();

    // Create approval transaction (balance was already deducted, just marking as completed)
    await Transaction.create({
      user: user._id,
      type: 'withdrawal_approved',
      amount: -withdrawal.amount,
      balanceBefore: user.balance, // Current balance (already deducted)
      balanceAfter: user.balance,  // No change, just status update
      description: `Withdrawal approved and processed to ${withdrawal.paymentDetails?.upiId || withdrawal.paymentDetails?.accountNumber || 'N/A'}`,
      relatedWithdrawal: withdrawal._id,
      status: 'completed'
    });

    const populatedWithdrawal = await Withdrawal.findById(withdrawal._id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      withdrawal: populatedWithdrawal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/withdrawals/:id/reject
// @desc    Reject withdrawal
// @access  Private/Admin
router.put('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal has already been processed'
      });
    }

    // Get user and REFUND the balance (was deducted when request was created)
    const user = await User.findById(withdrawal.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Refund the amount back to user
    const balanceBefore = user.balance;
    user.balance += withdrawal.amount;
    await user.save();

    // Update withdrawal status to rejected
    withdrawal.status = 'rejected';
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();
    if (req.body.adminNote) {
      withdrawal.adminNote = req.body.adminNote;
    }
    await withdrawal.save();

    // Create refund transaction
    await Transaction.create({
      user: user._id,
      type: 'withdrawal_refund',
      amount: withdrawal.amount,
      balanceBefore,
      balanceAfter: user.balance,
      description: `Withdrawal rejected - Amount refunded${req.body.adminNote ? ': ' + req.body.adminNote : ''}`,
      relatedWithdrawal: withdrawal._id,
      status: 'completed'
    });

    const populatedWithdrawal = await Withdrawal.findById(withdrawal._id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    res.json({
      success: true,
      message: 'Withdrawal rejected',
      withdrawal: populatedWithdrawal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
