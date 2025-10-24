const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Leaderboard = require('../models/Leaderboard');
const Bet = require('../models/Bet');
const User = require('../models/User');

// Helper function to get current week range
const getCurrentWeekRange = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { weekStart: monday, weekEnd: sunday };
};

// Helper function to mask phone number
const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return '****';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
};

// @route   GET /api/leaderboard
// @desc    Get current week's leaderboard (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { weekStart, weekEnd } = getCurrentWeekRange();

    const leaderboard = await Leaderboard.find({
      weekStart: { $lte: weekStart },
      weekEnd: { $gte: weekEnd }
    })
      .sort({ totalAmount: -1, totalWins: -1 })
      .limit(20)
      .select('-user -__v'); // Don't expose user IDs

    // Assign ranks
    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      rank: index + 1
    }));

    res.json({
      success: true,
      weekStart,
      weekEnd,
      leaderboard: rankedLeaderboard
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/leaderboard/refresh
// @desc    Refresh leaderboard from actual bet data (admin only)
// @access  Private/Admin
router.post('/refresh', protect, adminOnly, async (req, res) => {
  try {
    const { weekStart, weekEnd } = getCurrentWeekRange();

    console.log(`🔄 Refreshing leaderboard for week: ${weekStart.toISOString()} - ${weekEnd.toISOString()}`);

    // Get all winning bets from this week
    const winningBets = await Bet.find({
      status: 'won',
      createdAt: { $gte: weekStart, $lte: weekEnd }
    }).populate('user');

    // Aggregate wins by user
    const userWins = {};

    for (const bet of winningBets) {
      if (!bet.user) continue;

      const userId = bet.user._id.toString();
      if (!userWins[userId]) {
        userWins[userId] = {
          user: bet.user._id,
          name: bet.user.name || 'Anonymous',
          phone: maskPhone(bet.user.phone),
          totalWins: 0,
          totalAmount: 0
        };
      }

      userWins[userId].totalWins += 1;
      userWins[userId].totalAmount += bet.totalWinAmount || 0;
    }

    // Delete existing real entries for this week
    await Leaderboard.deleteMany({
      weekStart,
      weekEnd,
      isFake: false
    });

    // Insert new entries
    const entries = Object.values(userWins).map(entry => ({
      ...entry,
      weekStart,
      weekEnd,
      isFake: false
    }));

    if (entries.length > 0) {
      await Leaderboard.insertMany(entries);
    }

    console.log(`✅ Leaderboard refreshed: ${entries.length} real entries added`);

    res.json({
      success: true,
      message: 'Leaderboard refreshed successfully',
      entriesAdded: entries.length
    });
  } catch (error) {
    console.error('Leaderboard refresh error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/leaderboard/admin
// @desc    Get all leaderboard entries with admin info (admin only)
// @access  Private/Admin
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { weekStart, weekEnd } = getCurrentWeekRange();

    const leaderboard = await Leaderboard.find({
      weekStart: { $lte: weekStart },
      weekEnd: { $gte: weekEnd }
    })
      .populate('user', 'name phone')
      .sort({ totalAmount: -1, totalWins: -1 });

    const rankedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry.toObject(),
      rank: index + 1
    }));

    res.json({
      success: true,
      weekStart,
      weekEnd,
      leaderboard: rankedLeaderboard
    });
  } catch (error) {
    console.error('Admin leaderboard fetch error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/leaderboard/admin
// @desc    Add fake leaderboard entry (admin only)
// @access  Private/Admin
router.post('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { name, phone, totalWins, totalAmount } = req.body;

    // Validation
    if (!name || totalWins === undefined || totalAmount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, totalWins, and totalAmount are required'
      });
    }

    if (totalWins < 0 || totalAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Total wins and amount must be positive numbers'
      });
    }

    const { weekStart, weekEnd } = getCurrentWeekRange();

    const fakeEntry = new Leaderboard({
      user: null,
      name,
      phone: phone ? maskPhone(phone) : '****',
      totalWins: parseInt(totalWins),
      totalAmount: parseFloat(totalAmount),
      isFake: true,
      weekStart,
      weekEnd
    });

    await fakeEntry.save();

    console.log(`➕ Admin ${req.user.name} added fake leaderboard entry: ${name} - ₹${totalAmount}`);

    res.json({
      success: true,
      message: 'Fake entry added successfully',
      entry: fakeEntry
    });
  } catch (error) {
    console.error('Add fake entry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/leaderboard/admin/:id
// @desc    Delete leaderboard entry (admin only)
// @access  Private/Admin
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const entry = await Leaderboard.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard entry not found'
      });
    }

    // Only allow deletion of fake entries
    if (!entry.isFake) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete real user entries. Use refresh to update real data.'
      });
    }

    await entry.deleteOne();

    console.log(`🗑️  Admin ${req.user.name} deleted fake leaderboard entry: ${entry.name}`);

    res.json({
      success: true,
      message: 'Fake entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
