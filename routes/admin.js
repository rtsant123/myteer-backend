const express = require('express');
const router = express.Router();
const { protect, adminOnly, requirePermission } = require('../middleware/auth');
const House = require('../models/House');
const Round = require('../models/Round');
const Bet = require('../models/Bet');
const Transaction = require('../models/Transaction');
const Deposit = require('../models/Deposit');
const Withdrawal = require('../models/Withdrawal');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');

// @route   GET /api/admin/users
// @desc    Get all users (admin only)
// @access  Private/Admin (requires canManageUsers permission)
router.get('/users', protect, requirePermission('canManageUsers'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Optional filters
    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const users = await User.find(filter)
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await User.countDocuments(filter);

    // Calculate summary
    const summary = {
      total: total,
      admins: await User.countDocuments({ isAdmin: true }),
      activeUsers: await User.countDocuments({ isActive: true }),
      inactiveUsers: await User.countDocuments({ isActive: false }),
    };

    res.json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users,
      summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PATCH /api/admin/users/:userId/permissions
// @desc    Update admin user permissions
// @access  Private/Admin (requires canManageUsers permission)
router.patch('/users/:userId/permissions', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Validate permissions object
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Permissions object is required'
      });
    }

    // Check if the requesting admin has permission to manage users
    // Super admins (no permissions object or all permissions) can manage any admin
    const isSuperAdmin = !req.user.permissions ||
                         Object.values(req.user.permissions).every(p => p === true);

    if (!isSuperAdmin && (!req.user.permissions || !req.user.permissions.canManageUsers)) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: canManageUsers required'
      });
    }

    // Find the target user
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure target user is an admin
    if (!user.isAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Permissions can only be updated for admin users'
      });
    }

    // Validate permission keys
    const validPermissions = [
      'canUpdateResults',
      'canApprovePayments',
      'canCreateRounds',
      'canCreateHouses',
      'canAccessAnalytics',
      'canAccessChatSupport',
      'canManageUsers',
      'canManageAppVersion'
    ];

    const invalidKeys = Object.keys(permissions).filter(key => !validPermissions.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid permission keys: ${invalidKeys.join(', ')}`
      });
    }

    // Update permissions
    user.permissions = {
      ...user.permissions,
      ...permissions
    };

    await user.save();

    res.json({
      success: true,
      message: 'Permissions updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

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

// @route   GET /api/admin/analytics
// @desc    Get comprehensive admin analytics
// @access  Private/Admin
router.get('/analytics', protect, adminOnly, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total counts
    const totalUsers = await User.countDocuments();
    const activeBets = await Bet.countDocuments({ status: 'pending' });
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });

    // Revenue calculations
    const [
      depositStats,
      betStats,
      winStats,
      withdrawalStats,
      todayDepositStats,
      todayBetStats
    ] = await Promise.all([
      Deposit.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Bet.aggregate([
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Bet.aggregate([
        { $match: { status: 'won' } },
        { $group: { _id: null, total: { $sum: '$totalWinAmount' } } }
      ]),
      Withdrawal.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Deposit.aggregate([
        { $match: { status: 'approved', createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Bet.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ])
    ]);

    const totalDeposits = depositStats[0]?.total || 0;
    const totalBetsPlaced = betStats[0]?.total || 0;
    const totalWinnings = winStats[0]?.total || 0;
    const totalWithdrawals = withdrawalStats[0]?.total || 0;
    const totalRevenue = totalDeposits + totalBetsPlaced - totalWinnings - totalWithdrawals;

    // Today's stats
    const todayRevenue = todayDepositStats[0]?.total || 0;
    const todayBets = todayBetStats[0]?.count || 0;
    const todayNewUsers = await User.countDocuments({ createdAt: { $gte: todayStart } });
    const todayActiveUsers = await Bet.distinct('user', { createdAt: { $gte: todayStart } }).then(users => users.length);

    // User statistics
    const activeUsers7Days = await Bet.distinct('user', { createdAt: { $gte: sevenDaysAgo } }).then(users => users.length);
    const inactiveUsers = totalUsers - activeUsers7Days;
    const avgBetsPerUser = totalUsers > 0 ? (await Bet.countDocuments()) / totalUsers : 0;

    // House performance
    const houses = await House.find();
    const housePerformance = await Promise.all(
      houses.map(async (house) => {
        const houseBets = await Bet.aggregate([
          { $match: { house: house._id } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } }
        ]);

        return {
          id: house._id,
          name: house.name,
          totalBets: houseBets[0]?.count || 0,
          revenue: houseBets[0]?.revenue || 0
        };
      })
    );

    res.json({
      success: true,
      // Overview
      totalRevenue,
      totalUsers,
      activeBets,
      pendingWithdrawals,

      // Today's performance
      todayRevenue,
      todayBets,
      todayNewUsers,
      todayActiveUsers,

      // Revenue breakdown
      totalDeposits,
      totalBetsPlaced,
      totalWinnings,
      totalWithdrawals,

      // User statistics
      activeUsers7Days,
      inactiveUsers,
      avgBetsPerUser,

      // House performance
      housePerformance: housePerformance.sort((a, b) => b.revenue - a.revenue)
    });
  } catch (error) {
    console.error('Analytics error:', error);
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

// @route   POST /api/admin/create-admin
// @desc    Create a new admin user
// @access  Private/Admin (requires canManageUsers permission)
router.post('/create-admin', protect, requirePermission('canManageUsers'), async (req, res) => {
  try {
    const { phone, password, name, email } = req.body;

    // Validation
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user with full permissions
    const newAdmin = new User({
      phone,
      password: hashedPassword,
      name: name || '',
      email: email || '',
      isAdmin: true,
      isActive: true,
      balance: 0,
      permissions: {
        canUpdateResults: true,
        canApprovePayments: true,
        canCreateRounds: true,
        canCreateHouses: true,
        canAccessAnalytics: true,
        canAccessChatSupport: true,
        canManageUsers: true,
        canManageAppVersion: true
      }
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      admin: {
        _id: newAdmin._id,
        phone: newAdmin.phone,
        name: newAdmin.name,
        email: newAdmin.email,
        isAdmin: newAdmin.isAdmin,
        permissions: newAdmin.permissions
      }
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/admin/fix-timezones
// @desc    Fix timezone deadlines for existing rounds (migrate from Bangkok to IST)
// @access  Private/Admin
router.post('/fix-timezones', protect, adminOnly, async (req, res) => {
  try {
    // Helper function to convert IST to UTC
    function istToUtc(dateStr, timeStr) {
      const [istHour, istMin] = timeStr.split(':').map(Number);
      const date = new Date(dateStr);

      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();

      // Convert IST (UTC+5:30) to UTC
      const totalIstMinutes = istHour * 60 + istMin;
      const totalUtcMinutes = totalIstMinutes - (5 * 60 + 30);

      const utcHour = Math.floor(totalUtcMinutes / 60);
      const utcMin = totalUtcMinutes % 60;

      return new Date(Date.UTC(year, month, day, utcHour, utcMin, 0, 0));
    }

    // Get all non-finished rounds (pending, live)
    const rounds = await Round.find({
      status: { $in: ['pending', 'live'] }
    }).populate('house');

    console.log(`📊 Found ${rounds.length} active rounds to fix`);

    let fixedCount = 0;
    const fixedRounds = [];

    for (const round of rounds) {
      if (!round.house || !round.deadlineTime) {
        console.log(`⚠️  Skipping round ${round._id} - missing house or deadlineTime`);
        continue;
      }

      // Recalculate deadline using IST conversion
      const oldDeadline = round.deadline;
      const newDeadline = istToUtc(round.date, round.deadlineTime);

      console.log(`🔄 Fixing Round ${round._id}:`);
      console.log(`   House: ${round.house.name}`);
      console.log(`   OLD deadline: ${oldDeadline.toISOString()}`);
      console.log(`   NEW deadline: ${newDeadline.toISOString()}`);

      // Update the round
      round.deadline = newDeadline;
      await round.save();

      fixedCount++;
      fixedRounds.push({
        roundId: round._id,
        house: round.house.name,
        date: round.date,
        oldDeadline: oldDeadline.toISOString(),
        newDeadline: newDeadline.toISOString()
      });
    }

    console.log(`✅ Timezone fix complete! Fixed ${fixedCount} rounds`);

    res.json({
      success: true,
      message: `Fixed ${fixedCount} rounds`,
      total: rounds.length,
      fixed: fixedCount,
      rounds: fixedRounds
    });
  } catch (error) {
    console.error('❌ Timezone fix error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
