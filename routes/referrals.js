const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Referral = require('../models/Referral');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// Default referral configuration
const DEFAULT_CONFIG = {
  signupBonusReferrer: 50,
  signupBonusReferee: 30,
  depositBonusReferrer: 0,
  depositBonusReferee: 0,
  minDepositAmount: 0,
  isActive: true
};

// @route   GET /api/referrals/config
// @desc    Get referral configuration (admin only)
// @access  Private/Admin
router.get('/config', protect, adminOnly, async (req, res) => {
  try {
    const config = {
      signupBonusReferrer: await Settings.get('referral_signup_bonus_referrer', DEFAULT_CONFIG.signupBonusReferrer),
      signupBonusReferee: await Settings.get('referral_signup_bonus_referee', DEFAULT_CONFIG.signupBonusReferee),
      depositBonusReferrer: await Settings.get('referral_deposit_bonus_referrer', DEFAULT_CONFIG.depositBonusReferrer),
      depositBonusReferee: await Settings.get('referral_deposit_bonus_referee', DEFAULT_CONFIG.depositBonusReferee),
      minDepositAmount: await Settings.get('referral_min_deposit', DEFAULT_CONFIG.minDepositAmount),
      isActive: await Settings.get('referral_enabled', DEFAULT_CONFIG.isActive)
    };

    res.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('Error fetching referral config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/referrals/config
// @desc    Update referral configuration (admin only)
// @access  Private/Admin
router.put('/config', protect, adminOnly, async (req, res) => {
  try {
    const {
      signupBonusReferrer,
      signupBonusReferee,
      depositBonusReferrer,
      depositBonusReferee,
      minDepositAmount,
      isActive
    } = req.body;

    // Update settings
    if (typeof signupBonusReferrer === 'number') {
      await Settings.set('referral_signup_bonus_referrer', signupBonusReferrer, 'Signup bonus for referrer');
      await Settings.set('referrer_bonus', signupBonusReferrer, 'Alias for signup bonus (legacy)');
    }

    if (typeof signupBonusReferee === 'number') {
      await Settings.set('referral_signup_bonus_referee', signupBonusReferee, 'Signup bonus for referee');
      await Settings.set('referred_bonus', signupBonusReferee, 'Alias for signup bonus (legacy)');
    }

    if (typeof depositBonusReferrer === 'number') {
      await Settings.set('referral_deposit_bonus_referrer', depositBonusReferrer, 'Deposit bonus for referrer');
    }

    if (typeof depositBonusReferee === 'number') {
      await Settings.set('referral_deposit_bonus_referee', depositBonusReferee, 'Deposit bonus for referee');
    }

    if (typeof minDepositAmount === 'number') {
      await Settings.set('referral_min_deposit', minDepositAmount, 'Minimum deposit for referral bonus');
    }

    if (typeof isActive === 'boolean') {
      await Settings.set('referral_enabled', isActive, 'Enable/disable referral system');
    }

    // Get updated settings
    const config = {
      signupBonusReferrer: await Settings.get('referral_signup_bonus_referrer', DEFAULT_CONFIG.signupBonusReferrer),
      signupBonusReferee: await Settings.get('referral_signup_bonus_referee', DEFAULT_CONFIG.signupBonusReferee),
      depositBonusReferrer: await Settings.get('referral_deposit_bonus_referrer', DEFAULT_CONFIG.depositBonusReferrer),
      depositBonusReferee: await Settings.get('referral_deposit_bonus_referee', DEFAULT_CONFIG.depositBonusReferee),
      minDepositAmount: await Settings.get('referral_min_deposit', DEFAULT_CONFIG.minDepositAmount),
      isActive: await Settings.get('referral_enabled', DEFAULT_CONFIG.isActive)
    };

    console.log('✅ Referral config updated:', config);

    res.json({
      success: true,
      message: 'Referral configuration updated successfully',
      config
    });
  } catch (error) {
    console.error('Error updating referral config:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/referrals/my-stats
// @desc    Get user's referral statistics
// @access  Private
router.get('/my-stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total referrals count
    const totalReferrals = await Referral.countDocuments({ referrer: userId });

    // Get total earnings from referrals
    const earningsData = await Referral.aggregate([
      { $match: { referrer: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: '$rewardAmount' }
        }
      }
    ]);

    const totalEarnings = earningsData.length > 0 ? earningsData[0].total : 0;

    // Get recent referrals
    const referrals = await Referral.find({ referrer: userId })
      .populate('referred', 'phone name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        totalReferrals,
        totalEarnings,
        referralCode: req.user.referralCode,
        recentReferrals: referrals.map(r => ({
          id: r._id,
          referredUser: {
            phone: r.referred?.phone || 'N/A',
            name: r.referred?.name || 'N/A'
          },
          code: r.referralCode,
          reward: r.rewardAmount,
          date: r.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching user referral stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/referrals/code
// @desc    Get user's referral code
// @access  Private
router.get('/code', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      referralCode: req.user.referralCode
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/referrals/my-referrals
// @desc    Get list of users referred by current user
// @access  Private
router.get('/my-referrals', protect, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.user._id })
      .populate('referred', 'phone name createdAt balance')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      referrals: referrals.map(r => ({
        id: r._id,
        user: {
          phone: r.referred?.phone,
          name: r.referred?.name,
          joinedAt: r.referred?.createdAt,
          balance: r.referred?.balance
        },
        code: r.referralCode,
        reward: r.rewardAmount,
        date: r.createdAt,
        status: r.status
      }))
    });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/referrals/admin-stats
// @desc    Get all referral statistics (admin only)
// @access  Private/Admin
router.get('/admin-stats', protect, adminOnly, async (req, res) => {
  try {
    const totalReferrals = await Referral.countDocuments();

    const totalRewardsGiven = await Referral.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$rewardAmount' }
        }
      }
    ]);

    const recentReferrals = await Referral.find()
      .populate('referrer', 'phone name')
      .populate('referred', 'phone name')
      .sort({ createdAt: -1 })
      .limit(20);

    const topReferrers = await Referral.aggregate([
      {
        $group: {
          _id: '$referrer',
          count: { $sum: 1 },
          totalRewards: { $sum: '$rewardAmount' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          phone: '$user.phone',
          name: '$user.name',
          referralCount: '$count',
          totalEarned: '$totalRewards'
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        totalReferrals,
        totalRewardsGiven: totalRewardsGiven.length > 0 ? totalRewardsGiven[0].total : 0,
        recentReferrals: recentReferrals.map(r => ({
          id: r._id,
          referrer: {
            phone: r.referrer?.phone || 'N/A',
            name: r.referrer?.name || 'N/A'
          },
          referred: {
            phone: r.referred?.phone || 'N/A',
            name: r.referred?.name || 'N/A'
          },
          code: r.referralCode,
          reward: r.rewardAmount,
          date: r.createdAt
        })),
        topReferrers
      }
    });
  } catch (error) {
    console.error('Error fetching admin referral stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
