const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Referral = require('../models/Referral');
const { protect, admin } = require('../middleware/auth');

// @route   GET /api/settings/referral
// @desc    Get referral settings (admin only)
// @access  Private/Admin
router.get('/referral', protect, admin, async (req, res) => {
  try {
    const referralEnabled = await Settings.get('referral_enabled', true);
    const referrerBonus = await Settings.get('referrer_bonus', 50);
    const referredBonus = await Settings.get('referred_bonus', 30);

    res.json({
      success: true,
      settings: {
        enabled: referralEnabled,
        referrerBonus,
        referredBonus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   PUT /api/settings/referral
// @desc    Update referral settings (admin only)
// @access  Private/Admin
router.put('/referral', protect, admin, async (req, res) => {
  try {
    const { enabled, referrerBonus, referredBonus } = req.body;

    // Update settings
    if (typeof enabled === 'boolean') {
      await Settings.set('referral_enabled', enabled, 'Enable/disable referral system');
    }

    if (typeof referrerBonus === 'number' && referrerBonus >= 0) {
      await Settings.set('referrer_bonus', referrerBonus, 'Bonus amount for referrer');
    }

    if (typeof referredBonus === 'number' && referredBonus >= 0) {
      await Settings.set('referred_bonus', referredBonus, 'Bonus amount for referred user');
    }

    // Get updated settings
    const updatedEnabled = await Settings.get('referral_enabled', true);
    const updatedReferrerBonus = await Settings.get('referrer_bonus', 50);
    const updatedReferredBonus = await Settings.get('referred_bonus', 30);

    console.log(`✅ Referral settings updated - Enabled: ${updatedEnabled}, Referrer: ₹${updatedReferrerBonus}, Referred: ₹${updatedReferredBonus}`);

    res.json({
      success: true,
      message: 'Referral settings updated successfully',
      settings: {
        enabled: updatedEnabled,
        referrerBonus: updatedReferrerBonus,
        referredBonus: updatedReferredBonus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/settings/referral/stats
// @desc    Get referral statistics (admin only)
// @access  Private/Admin
router.get('/referral/stats', protect, admin, async (req, res) => {
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
      .limit(10);

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
    console.error('Error fetching referral stats:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
