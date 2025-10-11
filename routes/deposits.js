const express = require('express');
const router = express.Router();
const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const PaymentMethod = require('../models/PaymentMethod');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/deposits
// @desc    Submit deposit request
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

    // Create deposit request
    const deposit = await Deposit.create({
      user: req.user._id,
      amount,
      paymentMethod: paymentMethodId,
      paymentDetails: paymentDetails || {},
      status: 'pending'
    });

    const populatedDeposit = await Deposit.findById(deposit._id)
      .populate('user', 'name phone')
      .populate('paymentMethod');

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully',
      deposit: populatedDeposit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/deposits
// @desc    Get all deposits (admin only)
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

    const deposits = await Deposit.find(filter)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Deposit.countDocuments(filter);

    // Calculate summary
    const summary = await Deposit.aggregate([
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
      count: deposits.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      deposits,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/deposits/user
// @desc    Get user's own deposits
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

    const deposits = await Deposit.find(filter)
      .populate('paymentMethod')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Deposit.countDocuments(filter);

    res.json({
      success: true,
      count: deposits.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      deposits
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/deposits/:id
// @desc    Get deposit by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    // Users can only view their own deposits unless admin
    if (deposit.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this deposit'
      });
    }

    res.json({
      success: true,
      deposit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/deposits/:id/approve
// @desc    Approve deposit
// @access  Private/Admin
router.put('/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Deposit has already been processed'
      });
    }

    // Update user balance
    const user = await User.findById(deposit.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const balanceBefore = user.balance;
    user.balance += deposit.amount;
    await user.save();

    // Update deposit status
    deposit.status = 'approved';
    deposit.processedBy = req.user._id;
    deposit.processedAt = new Date();
    if (req.body.adminNote) {
      deposit.adminNote = req.body.adminNote;
    }
    await deposit.save();

    // Create transaction
    await Transaction.create({
      user: user._id,
      type: 'deposit',
      amount: deposit.amount,
      balanceBefore,
      balanceAfter: user.balance,
      description: `Deposit approved - ${deposit.paymentDetails?.transactionId || 'N/A'}`,
      status: 'completed'
    });

    const populatedDeposit = await Deposit.findById(deposit._id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    res.json({
      success: true,
      message: 'Deposit approved successfully',
      deposit: populatedDeposit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/deposits/:id/reject
// @desc    Reject deposit
// @access  Private/Admin
router.put('/:id/reject', protect, adminOnly, async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: 'Deposit not found'
      });
    }

    if (deposit.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Deposit has already been processed'
      });
    }

    // Update deposit status
    deposit.status = 'rejected';
    deposit.processedBy = req.user._id;
    deposit.processedAt = new Date();
    if (req.body.adminNote) {
      deposit.adminNote = req.body.adminNote;
    }
    await deposit.save();

    const populatedDeposit = await Deposit.findById(deposit._id)
      .populate('user', 'name phone')
      .populate('paymentMethod')
      .populate('processedBy', 'name');

    res.json({
      success: true,
      message: 'Deposit rejected',
      deposit: populatedDeposit
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
