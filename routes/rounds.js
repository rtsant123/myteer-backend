const express = require('express');
const router = express.Router();
const Round = require('../models/Round');
const House = require('../models/House');
const Bet = require('../models/Bet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/rounds/active/:houseId
// @desc    Get active round for house
// @access  Public
router.get('/active/:houseId', async (req, res) => {
  try {
    const round = await Round.findOne({
      house: req.params.houseId,
      status: { $in: ['live', 'fr_closed', 'sr_closed'] }
    }).populate('house');

    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'No active round found'
      });
    }

    res.json({
      success: true,
      round
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/rounds/:id
// @desc    Get round by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const round = await Round.findById(req.params.id).populate('house');

    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    res.json({
      success: true,
      round
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/rounds
// @desc    Create round
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      house,
      date,
      frDeadline,
      srDeadline
    } = req.body;

    if (!house || !date) {
      return res.status(400).json({
        success: false,
        message: 'House and date are required'
      });
    }

    // Check if house exists
    const houseExists = await House.findById(house);
    if (!houseExists) {
      return res.status(404).json({
        success: false,
        message: 'House not found'
      });
    }

    // Calculate deadlines from house default times if not provided
    let frDeadlineDate, srDeadlineDate;

    if (frDeadline && srDeadline) {
      frDeadlineDate = new Date(frDeadline);
      srDeadlineDate = new Date(srDeadline);
    } else {
      // Use house default times
      const roundDate = new Date(date);
      const [frHour, frMin] = houseExists.frDeadlineTime.split(':').map(Number);
      const [srHour, srMin] = houseExists.srDeadlineTime.split(':').map(Number);

      frDeadlineDate = new Date(roundDate);
      frDeadlineDate.setHours(frHour, frMin, 0, 0);

      srDeadlineDate = new Date(roundDate);
      srDeadlineDate.setHours(srHour, srMin, 0, 0);
    }

    // Check if round already exists for this house and date
    const existingRound = await Round.findOne({
      house,
      date: new Date(date)
    });

    if (existingRound) {
      return res.status(400).json({
        success: false,
        message: 'Round already exists for this house and date'
      });
    }

    // Determine initial status
    const now = new Date();
    let status = 'pending';
    if (now >= frDeadlineDate) {
      status = 'live';
    }

    const round = await Round.create({
      house,
      date,
      frDeadline: frDeadlineDate,
      srDeadline: srDeadlineDate,
      status
    });

    const populatedRound = await Round.findById(round._id).populate('house');

    res.status(201).json({
      success: true,
      message: 'Round created successfully',
      round: populatedRound
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/rounds/:id/result
// @desc    Update round results and calculate winners
// @access  Private/Admin
router.put('/:id/result', protect, adminOnly, async (req, res) => {
  try {
    const round = await Round.findById(req.params.id).populate('house');

    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    const { frResult, srResult } = req.body;

    // Update results
    if (frResult !== undefined) {
      if (frResult < 0 || frResult > 99) {
        return res.status(400).json({
          success: false,
          message: 'FR result must be between 0 and 99'
        });
      }
      round.frResult = frResult;
      round.frResultTime = new Date();
    }

    if (srResult !== undefined) {
      if (srResult < 0 || srResult > 99) {
        return res.status(400).json({
          success: false,
          message: 'SR result must be between 0 and 99'
        });
      }
      round.srResult = srResult;
      round.srResultTime = new Date();
    }

    // Update status to finished if both results are set
    if (round.frResult !== undefined && round.srResult !== undefined) {
      round.status = 'finished';
    }

    await round.save();

    // Calculate winners for all bets in this round
    await calculateWinners(round);

    res.json({
      success: true,
      message: 'Results updated and winners calculated',
      round
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Helper function to calculate winners
async function calculateWinners(round) {
  try {
    // Get all bets for this round
    const bets = await Bet.find({ round: round._id }).populate('house');

    for (const bet of bets) {
      let totalWinAmount = 0;
      let hasWinner = false;

      // Process each entry in the bet
      for (const entry of bet.entries) {
        let isWinner = false;
        let winAmount = 0;

        // Check FR bets
        if (entry.mode === 'FR' && round.frResult !== undefined) {
          isWinner = checkWinner(entry, round.frResult, bet.house);
          if (isWinner) {
            winAmount = calculateWinAmount(entry, bet.house, 'FR');
          }
        }

        // Check SR bets
        if (entry.mode === 'SR' && round.srResult !== undefined) {
          isWinner = checkWinner(entry, round.srResult, bet.house);
          if (isWinner) {
            winAmount = calculateWinAmount(entry, bet.house, 'SR');
          }
        }

        // Check FORECAST bets
        if (entry.mode === 'FORECAST' && round.frResult !== undefined && round.srResult !== undefined) {
          // For forecast, check if the number matches SR result
          if (entry.playType === 'DIRECT' && entry.number === round.srResult) {
            isWinner = true;
            winAmount = entry.amount * bet.house.forecastRate;
          }
        }

        entry.isWinner = isWinner;
        entry.winAmount = winAmount;
        totalWinAmount += winAmount;

        if (isWinner) {
          hasWinner = true;
        }
      }

      bet.totalWinAmount = totalWinAmount;
      bet.status = hasWinner ? 'won' : 'lost';
      await bet.save();

      // If user won, update balance and create transaction
      if (hasWinner && totalWinAmount > 0) {
        const user = await User.findById(bet.user);
        if (user) {
          const balanceBefore = user.balance;
          user.balance += totalWinAmount;
          await user.save();

          // Create win transaction
          await Transaction.create({
            user: user._id,
            type: 'bet_won',
            amount: totalWinAmount,
            balanceBefore,
            balanceAfter: user.balance,
            description: `Won bet on ${bet.house.name}`,
            relatedBet: bet._id,
            status: 'completed'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error calculating winners:', error);
  }
}

// Helper function to check if entry is winner
function checkWinner(entry, result, house) {
  const resultStr = result.toString().padStart(2, '0');
  const numberStr = entry.number.toString().padStart(2, '0');

  switch (entry.playType) {
    case 'DIRECT':
      return entry.number === result;

    case 'HOUSE':
      // House means matching last digit
      return resultStr[1] === numberStr[1];

    case 'ENDING':
      // Ending means matching last digit (same as house)
      return resultStr[1] === numberStr[1];

    default:
      return false;
  }
}

// Helper function to calculate win amount
function calculateWinAmount(entry, house, mode) {
  let rate = 0;

  if (mode === 'FR') {
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
  } else if (mode === 'SR') {
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
  }

  return entry.amount * rate;
}

// @route   POST /api/rounds/auto-create
// @desc    Manually trigger auto-creation of tomorrow's rounds
// @access  Private/Admin
router.post('/auto-create', protect, adminOnly, async (req, res) => {
  try {
    const { autoCreateRounds } = require('../services/roundScheduler');

    await autoCreateRounds();

    res.json({
      success: true,
      message: 'Tomorrow\'s rounds created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
