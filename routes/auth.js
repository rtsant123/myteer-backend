const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { verifyOTP } = require('../utils/otpService');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this';

// Default referral bonus amounts (used if not set in database)
const DEFAULT_REFERRER_BONUS = 50;
const DEFAULT_REFERRED_BONUS = 30;

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// Normalize phone number for international support
// Keeps country code, removes spaces/dashes/parentheses, removes + sign for storage
const normalizePhone = (phone) => {
  if (!phone) return '';

  // Convert to string and trim
  phone = phone.toString().trim();

  // Remove spaces, dashes, and parentheses
  phone = phone.replace(/[\s\-\(\)]/g, '');

  // Remove + sign (we store without it, but keep the country code)
  phone = phone.replace('+', '');

  // Legacy support: If it's a 10-digit number without country code, assume Indian
  if (phone.length === 10 && /^[6-9][0-9]{9}$/.test(phone)) {
    phone = '91' + phone;
  }

  return phone;
};

// Generate unique referral code
const generateReferralCode = async () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;

  while (exists) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    // Check if code already exists
    const existingUser = await User.findOne({ referralCode: code });
    exists = !!existingUser;
  }

  return code;
};

// @route   POST /api/auth/register
// @desc    Register user with optional referral code
// @access  Public
router.post('/register', async (req, res) => {
  try {
    let { phone, password, name, email, otp, referralCode } = req.body;

    // Validate inputs
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Verify OTP (unless in development mode without OTP)
    if (otp) {
      const otpResult = verifyOTP(phone, otp);
      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          message: otpResult.message
        });
      }
      console.log(`✅ OTP verified for registration: ${phone}`);
    } else {
      // If no OTP provided, check if we're in development mode
      if (process.env.NODE_ENV !== 'development') {
        return res.status(400).json({
          success: false,
          message: 'OTP verification is required'
        });
      }
      console.log(`⚠️ DEV MODE: Registration without OTP for ${phone}`);
    }

    // Check if user exists
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Check if referral system is enabled (backwards compatible)
    let referralEnabled = true;
    let referrerBonus = DEFAULT_REFERRER_BONUS;
    let referredBonus = DEFAULT_REFERRED_BONUS;

    try {
      referralEnabled = await Settings.get('referral_enabled', true);
      referrerBonus = await Settings.get('referrer_bonus', DEFAULT_REFERRER_BONUS);
      referredBonus = await Settings.get('referred_bonus', DEFAULT_REFERRED_BONUS);
    } catch (error) {
      // Use defaults if Settings model doesn't exist (backwards compatibility)
      console.log(`⚠️ Using default referral settings: ${error.message}`);
    }

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
      if (!referralEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Referral system is currently disabled'
        });
      }

      referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
      }
      console.log(`✅ Valid referral code: ${referralCode} from user ${referrer.phone}`);
    }

    // Generate unique referral code for new user
    const newUserReferralCode = await generateReferralCode();

    // Create user with referral tracking
    const user = await User.create({
      phone,
      password,
      name: name || '',
      email: email || '',
      balance: (referrer && referralEnabled) ? referredBonus : 0, // Signup bonus if referred
      referralCode: newUserReferralCode,
      referredBy: referrer ? referrer._id : null
    });

    // If user was referred and referral system is enabled, create tracking and award bonuses
    if (referrer && referralEnabled) {
      // Create referral record
      await Referral.create({
        referrer: referrer._id,
        referred: user._id,
        referralCode: referralCode.toUpperCase(),
        rewardAmount: referrerBonus,
        status: 'completed'
      });

      // Award bonus to referrer
      const referrerOldBalance = referrer.balance;
      referrer.balance += referrerBonus;
      await referrer.save();

      // Create transaction for referrer
      await Transaction.create({
        user: referrer._id,
        type: 'deposit',
        amount: referrerBonus,
        balanceBefore: referrerOldBalance,
        balanceAfter: referrer.balance,
        description: `Referral bonus for inviting ${user.phone}`,
        status: 'completed'
      });

      // Create transaction for new user (signup bonus)
      await Transaction.create({
        user: user._id,
        type: 'deposit',
        amount: referredBonus,
        balanceBefore: 0,
        balanceAfter: user.balance,
        description: `Signup bonus for using referral code ${referralCode}`,
        status: 'completed'
      });

      console.log(`✅ Referral bonuses awarded: ₹${referrerBonus} to referrer, ₹${referredBonus} to new user`);
    }

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    let { phone, password } = req.body;

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    console.log(`🔐 Login attempt for phone: ${phone}`);

    // Check for user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate referral code for existing users who don't have one (backwards compatible)
    try {
      if (!user.referralCode) {
        user.referralCode = await generateReferralCode();
        await user.save();
        console.log(`✅ Generated referral code for existing user: ${user.referralCode}`);
      }
    } catch (error) {
      // Ignore error if referralCode field doesn't exist (backwards compatibility)
      console.log(`⚠️ Could not generate referral code (field may not exist): ${error.message}`);
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      phone: req.user.phone,
      name: req.user.name,
      email: req.user.email,
      balance: req.user.balance,
      isAdmin: req.user.isAdmin,
      isActive: req.user.isActive
    }
  });
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (name, email)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = req.user;

    // Update allowed fields only
    if (name !== undefined) {
      user.name = name;
    }
    if (email !== undefined) {
      user.email = email;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        balance: user.balance,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/auth/user/:phone
// @desc    Delete user by phone (for cleaning test users)
// @access  Public (in development) / Admin (in production)
router.delete('/user/:phone', async (req, res) => {
  try {
    let { phone } = req.params;

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Find and delete user
    const user = await User.findOneAndDelete({ phone });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${phone} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Check if user exists
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this phone number'
      });
    }

    // Send OTP using the OTP service
    const { sendOTP } = require('../utils/otpService');
    const result = await sendOTP(phone);

    if (result.success) {
      res.json({
        success: true,
        message: 'OTP sent for password reset'
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    let { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Phone, OTP, and new password are required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Verify OTP
    const otpResult = verifyOTP(phone, otp);
    if (!otpResult.success) {
      return res.status(400).json({
        success: false,
        message: otpResult.message
      });
    }

    // Find user
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/create-first-admin
// @desc    Create first admin user without OTP (for initial setup)
// @access  Public (should be removed after first admin is created)
router.post('/create-first-admin', async (req, res) => {
  try {
    let { phone, password, name } = req.body;

    // Validate inputs
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone and password are required'
      });
    }

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    // Check if user already exists
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create admin user without OTP verification
    const user = await User.create({
      phone,
      password,
      name: name || 'Admin',
      balance: 0,
      isAdmin: true  // Make admin immediately
    });

    const token = generateToken(user._id);

    console.log(`🔧 ADMIN CREATED: ${phone}`);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        balance: user.balance,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/make-admin/:phone
// @desc    Make a user admin (for setup/testing)
// @access  Public (should be protected in production)
router.post('/make-admin/:phone', async (req, res) => {
  try {
    let { phone } = req.params;

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isAdmin = true;
    await user.save();

    res.json({
      success: true,
      message: `User ${phone} is now an admin`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/remove-admin/:phone
// @desc    Remove admin access from a user (for setup/testing)
// @access  Public (should be protected in production)
router.post('/remove-admin/:phone', async (req, res) => {
  try {
    let { phone } = req.params;

    // Normalize phone number (supports international numbers)
    phone = normalizePhone(phone);

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isAdmin = false;
    await user.save();

    res.json({
      success: true,
      message: `User ${phone} is now a regular user`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/auth/fcm-token
// @desc    Save FCM token for push notifications
// @access  Private
router.post('/fcm-token', protect, async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    // Update user's FCM token
    await User.findByIdAndUpdate(req.user._id, {
      fcmToken: fcmToken
    });

    console.log(`📱 FCM token saved for user: ${req.user.name || req.user.phone}`);

    res.json({
      success: true,
      message: 'FCM token saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// @route   DELETE /api/auth/fcm-token
// @desc    Delete FCM token (for logout)
// @access  Private
router.delete('/fcm-token', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      fcmToken: null
    });

    console.log(`🗑️  FCM token deleted for user: ${req.user.name || req.user.phone}`);

    res.json({
      success: true,
      message: 'FCM token deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
