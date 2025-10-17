const express = require('express');
const router = express.Router();
const Round = require('../models/Round');
const House = require('../models/House');
const Bet = require('../models/Bet');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET /api/rounds/active/:houseId
// @desc    Get active round for house (or today's finished round)
// @access  Public
router.get('/active/:houseId', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Priority 1: Find LIVE rounds (deadline passed, waiting for results)
    let round = await Round.findOne({
      house: req.params.houseId,
      status: 'live',
      date: { $gte: today, $lt: tomorrow }
    })
    .sort({ date: 1 }) // Oldest first (current day's round)
    .populate('house');

    // Priority 2: If no live round, find PENDING rounds (upcoming, today or future)
    if (!round) {
      round = await Round.findOne({
        house: req.params.houseId,
        status: 'pending'
      })
      .sort({ date: 1 }) // Oldest first (today's round before tomorrow's)
      .populate('house');
    }

    // Priority 3: If no pending/live, find FINISHED round from TODAY
    // This is CRITICAL: We need to show finished rounds so they appear in FINISHED tab!
    if (!round) {
      round = await Round.findOne({
        house: req.params.houseId,
        status: 'finished',
        date: { $gte: today, $lt: tomorrow }
      })
      .sort({ date: -1 }) // Most recent finished round from today
      .populate('house');
    }

    // Priority 4: If no finished from today, find any non-finished round
    if (!round) {
      round = await Round.findOne({
        house: req.params.houseId,
        status: { $in: ['fr_closed', 'sr_closed'] }
      })
      .sort({ date: 1 })
      .populate('house');
    }

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
      deadline
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

    // Calculate deadline from house default time if not provided
    let deadlineDate;

    if (deadline) {
      deadlineDate = new Date(deadline);
      console.log('📅 Using provided deadline:', deadlineDate.toISOString());
    } else {
      // Use house default time (in IST - UTC+5:30)
      const roundDate = new Date(date);
      const [hour, min] = houseExists.deadlineTime.split(':').map(Number);

      console.log('📅 TIMEZONE CONVERSION DEBUG:');
      console.log('  Input date:', date);
      console.log('  House deadline time:', houseExists.deadlineTime);
      console.log('  Parsed roundDate:', roundDate.toISOString());

      // Get UTC date components (date-only strings are parsed as UTC midnight)
      const year = roundDate.getUTCFullYear();
      const month = roundDate.getUTCMonth();
      const day = roundDate.getUTCDate();

      console.log(`  UTC components: ${year}-${month + 1}-${day} ${hour}:${min}`);

      // Create date at specified IST time (temporarily as UTC)
      deadlineDate = new Date(Date.UTC(year, month, day, hour, min, 0, 0));
      console.log('  Before IST conversion:', deadlineDate.toISOString());

      // Convert from IST to UTC by subtracting IST offset (5 hours 30 minutes)
      // IST = UTC+5:30, so UTC = IST - 5:30
      deadlineDate = new Date(deadlineDate.getTime() - (5.5 * 60 * 60 * 1000));
      console.log('  After IST conversion (final):', deadlineDate.toISOString());
      console.log('  Current server time:', new Date().toISOString());
    }

    // Check if round already exists for this house and date
    // Compare only date part (year, month, day) without time
    const checkDate = new Date(date);
    const startOfDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    const endOfDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), 23, 59, 59, 999);

    const existingRound = await Round.findOne({
      house,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
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
    let frStatus = 'pending';
    let srStatus = 'pending'; // Both FR and SR available for betting together
    let forecastStatus = 'pending';

    if (now >= deadlineDate) {
      status = 'live';
      frStatus = 'live';
      srStatus = 'live'; // Both FR and SR go live together when deadline passes
      forecastStatus = 'live';
    }

    const round = await Round.create({
      house,
      date,
      deadline: deadlineDate,
      status,
      frStatus,
      srStatus,
      forecastStatus
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
      // Mark FR game as finished
      round.frStatus = 'finished';
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
      // Mark SR game as finished
      round.srStatus = 'finished';
    }

    // Update FORECAST status: finished when BOTH FR and SR results are set
    if (round.frResult !== undefined && round.srResult !== undefined) {
      round.forecastStatus = 'finished';
      round.status = 'finished';
    }

    await round.save();

    // Calculate winners for all bets in this round
    await calculateWinners(round);

    // If both FR and SR results are now set (round finished), auto-create tomorrow's round
    if (round.frResult !== undefined && round.srResult !== undefined) {
      try {
        const { autoCreateRoundForHouse } = require('../services/roundScheduler');
        await autoCreateRoundForHouse(round.house._id || round.house);
        console.log(`✅ Auto-created tomorrow's round for ${round.house.name || round.house}`);
      } catch (error) {
        console.error('❌ Error auto-creating next round:', error);
        // Don't fail the result update if auto-create fails
      }
    }

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
    // Get all PENDING bets for this round (avoid double payment)
    const bets = await Bet.find({
      round: round._id,
      status: 'pending'
    }).populate('house');

    for (const bet of bets) {
      let totalWinAmount = 0;
      let hasWinner = false;
      let canFinalizeBet = true; // Can we finalize this bet's status?

      // Process each entry in the bet
      for (const entry of bet.entries) {
        let isWinner = false;
        let winAmount = 0;
        let entryProcessed = false;

        // Check FR bets
        if (entry.mode === 'FR' && round.frResult !== undefined) {
          isWinner = checkWinner(entry, round.frResult, bet.house);
          if (isWinner) {
            winAmount = calculateWinAmount(entry, bet.house, 'FR');
          }
          entryProcessed = true;
        } else if (entry.mode === 'FR' && round.frResult === undefined) {
          // FR bet but no FR result yet - can't finalize this bet
          canFinalizeBet = false;
        }

        // Check SR bets
        if (entry.mode === 'SR' && round.srResult !== undefined) {
          isWinner = checkWinner(entry, round.srResult, bet.house);
          if (isWinner) {
            winAmount = calculateWinAmount(entry, bet.house, 'SR');
          }
          entryProcessed = true;
        } else if (entry.mode === 'SR' && round.srResult === undefined) {
          // SR bet but no SR result yet - can't finalize this bet
          canFinalizeBet = false;
        }

        // Check FORECAST bets (both FR and SR must be set)
        if (entry.mode === 'FORECAST') {
          if (round.frResult !== undefined && round.srResult !== undefined) {
            const frResultStr = round.frResult.toString().padStart(2, '0');
            const srResultStr = round.srResult.toString().padStart(2, '0');

            if (entry.playType === 'DIRECT') {
              // DIRECT: Match full numbers (FR=34, SR=53)
              if (entry.frNumber === round.frResult && entry.srNumber === round.srResult) {
                isWinner = true;
                winAmount = entry.amount * bet.house.forecastDirectRate;
              }
            } else if (entry.playType === 'HOUSE') {
              // HOUSE: Match FIRST digits (FR=34→3, SR=53→5)
              const frFirstDigit = parseInt(frResultStr[0]);
              const srFirstDigit = parseInt(srResultStr[0]);
              if (entry.frNumber === frFirstDigit && entry.srNumber === srFirstDigit) {
                isWinner = true;
                winAmount = entry.amount * bet.house.forecastHouseRate;
              }
            } else if (entry.playType === 'ENDING') {
              // ENDING: Match LAST digits (FR=34→4, SR=53→3)
              const frLastDigit = parseInt(frResultStr[1]);
              const srLastDigit = parseInt(srResultStr[1]);
              if (entry.frNumber === frLastDigit && entry.srNumber === srLastDigit) {
                isWinner = true;
                winAmount = entry.amount * bet.house.forecastEndingRate;
              }
            }
            entryProcessed = true;
          } else {
            // FORECAST bet but don't have both results yet - can't finalize
            canFinalizeBet = false;
          }
        }

        entry.isWinner = isWinner;
        entry.winAmount = winAmount;
        totalWinAmount += winAmount;

        if (isWinner) {
          hasWinner = true;
        }
      }

      // Only update bet status if all entries can be processed
      if (canFinalizeBet) {
        bet.totalWinAmount = totalWinAmount;
        bet.status = hasWinner ? 'won' : 'lost';
        await bet.save();

        // If user won, update balance and create transaction (ONLY when finalizing)
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
      // Otherwise bet stays 'pending' for next result update
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
      // House means matching FIRST digit
      return resultStr[0] === numberStr[0];

    case 'ENDING':
      // Ending means matching LAST digit
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
