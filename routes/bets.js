const express = require('express');
const router = express.Router();
const Bet = require('../models/Bet');
const User = require('../models/User');
const House = require('../models/House');
const Round = require('../models/Round');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');

// @route   POST /api/bets/place
// @desc    Place bet
// @access  Private
router.post('/place', protect, async (req, res) => {
  try {
    const { houseId, roundId, entries } = req.body;

    // Validate input
    if (!houseId || !roundId || !entries || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'House, round, and bet entries are required'
      });
    }

    // Validate number of entries (prevent betting on too many numbers)
    if (entries.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 numbers allowed per bet'
      });
    }

    // Check if house exists
    const house = await House.findById(houseId);
    if (!house || !house.isActive) {
      return res.status(404).json({
        success: false,
        message: 'House not found or inactive'
      });
    }

    // Check if round exists and is open
    const round = await Round.findById(roundId);
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    // Check if betting is allowed for this round
    const now = new Date();

    // Validate entries and check timing
    for (const entry of entries) {
      if (entry.mode === 'FR' || entry.mode === 'FORECAST') {
        // FR/FORECAST allowed if status is pending or live, and before FR deadline
        if (!['pending', 'live'].includes(round.status)) {
          return res.status(400).json({
            success: false,
            message: 'First round betting is closed'
          });
        }
        if (now >= round.frDeadline) {
          return res.status(400).json({
            success: false,
            message: 'First round betting time has expired'
          });
        }
      }

      if (entry.mode === 'SR') {
        // SR allowed if status is pending, live, or fr_closed, and before SR deadline
        if (!['pending', 'live', 'fr_closed'].includes(round.status)) {
          return res.status(400).json({
            success: false,
            message: 'Second round betting is closed'
          });
        }
        if (now >= round.srDeadline) {
          return res.status(400).json({
            success: false,
            message: 'Second round betting time has expired'
          });
        }
      }

      // Validate number range
      if (entry.number < 0 || entry.number > 99) {
        return res.status(400).json({
          success: false,
          message: 'Bet number must be between 0 and 99'
        });
      }

      // Validate amount with min/max limits
      if (typeof entry.amount !== 'number' || isNaN(entry.amount)) {
        return res.status(400).json({
          success: false,
          message: 'Bet amount must be a valid number'
        });
      }

      if (entry.amount < 10) {
        return res.status(400).json({
          success: false,
          message: 'Minimum bet amount is ₹10'
        });
      }

      if (entry.amount > 100000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum bet amount is ₹1,00,000'
        });
      }

      // Ensure amount has max 2 decimal places
      if (!Number.isInteger(entry.amount * 100)) {
        return res.status(400).json({
          success: false,
          message: 'Bet amount can have maximum 2 decimal places'
        });
      }

      // Calculate potential win for each entry
      let rate = 0;
      if (entry.mode === 'FR') {
        switch (entry.playType) {
          case 'DIRECT':
            rate = house.frDirectRate;
            break;
          case 'HOUSE':
            rate = house.frHouseRate;
            break;
          case 'ENDING':
            rate = house.frEndingRate;
            break;
        }
      } else if (entry.mode === 'SR') {
        switch (entry.playType) {
          case 'DIRECT':
            rate = house.srDirectRate;
            break;
          case 'HOUSE':
            rate = house.srHouseRate;
            break;
          case 'ENDING':
            rate = house.srEndingRate;
            break;
        }
      } else if (entry.mode === 'FORECAST') {
        switch (entry.playType) {
          case 'DIRECT':
            rate = house.forecastDirectRate;
            break;
          case 'HOUSE':
            rate = house.forecastHouseRate;
            break;
          case 'ENDING':
            rate = house.forecastEndingRate;
            break;
        }
      }

      entry.potentialWin = entry.amount * rate;
    }

    // Calculate total amount
    const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);

    // Check if user has sufficient balance
    const user = await User.findById(req.user._id);
    if (user.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Deduct balance
    const balanceBefore = user.balance;
    user.balance -= totalAmount;
    await user.save();

    // Create bet
    const bet = await Bet.create({
      user: req.user._id,
      house: houseId,
      round: roundId,
      entries,
      totalAmount,
      status: 'pending'
    });

    // Create transaction
    await Transaction.create({
      user: req.user._id,
      type: 'bet',
      amount: -totalAmount,
      balanceBefore,
      balanceAfter: user.balance,
      description: `Bet placed on ${house.name}`,
      relatedBet: bet._id,
      status: 'completed'
    });

    const populatedBet = await Bet.findById(bet._id)
      .populate('house')
      .populate('round');

    res.status(201).json({
      success: true,
      message: 'Bet placed successfully',
      bet: populatedBet,
      newBalance: user.balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/bets
// @desc    Get all bets (admin only)
// @access  Private/Admin
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.houseId) {
      filter.house = req.query.houseId;
    }
    if (req.query.roundId) {
      filter.round = req.query.roundId;
    }

    const bets = await Bet.find(filter)
      .populate('user', 'name phone')
      .populate('house', 'name')
      .populate('round', 'roundNumber date')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bet.countDocuments(filter);

    // Calculate summary
    const summary = await Bet.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      count: bets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      bets,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/bets/user
// @desc    Get current user's bets
// @access  Private
router.get('/user', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const bets = await Bet.find({ user: req.user._id })
      .populate('house')
      .populate('round')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bet.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      count: bets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      bets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/bets/round/:roundId
// @desc    Get current user's bets for a specific round
// @access  Private
router.get('/round/:roundId', protect, async (req, res) => {
  try {
    const bets = await Bet.find({
      user: req.user._id,
      round: req.params.roundId
    })
      .populate('house')
      .populate('round')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bets.length,
      bets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/bets/user/:userId
// @desc    Get user bets by userId (admin or own bets)
// @access  Private
router.get('/user/:userId', protect, async (req, res) => {
  try {
    // Users can only view their own bets unless admin
    if (req.user._id.toString() !== req.params.userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these bets'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const bets = await Bet.find({ user: req.params.userId })
      .populate('house')
      .populate('round')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Bet.countDocuments({ user: req.params.userId });

    res.json({
      success: true,
      count: bets.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      bets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/bets/:id
// @desc    Get bet by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.id)
      .populate('house')
      .populate('round')
      .populate('user', 'name phone');

    if (!bet) {
      return res.status(404).json({
        success: false,
        message: 'Bet not found'
      });
    }

    // Users can only view their own bets unless admin
    if (bet.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this bet'
      });
    }

    res.json({
      success: true,
      bet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
