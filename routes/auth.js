const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Referral = require('../models/Referral');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');
const { verifyOTP } = require('../utils/otpService');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_this';

// Referral bonus amounts (configurable)
const REFERRER_BONUS = 50; // Bonus for the person who referred
const REFERRED_BONUS = 30; // Bonus for the person who signed up with referral code

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

    // Validate referral code if provided
    let referrer = null;
    if (referralCode) {
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
      balance: referrer ? REFERRED_BONUS : 0, // Signup bonus if referred
      referralCode: newUserReferralCode,
      referredBy: referrer ? referrer._id : null
    });

    // If user was referred, create referral tracking and award referrer
    if (referrer) {
      // Create referral record
      await Referral.create({
        referrer: referrer._id,
        referred: user._id,
        referralCode: referralCode.toUpperCase(),
        rewardAmount: REFERRER_BONUS,
        status: 'completed'
      });

      // Award bonus to referrer
      const referrerOldBalance = referrer.balance;
      referrer.balance += REFERRER_BONUS;
      await referrer.save();

      // Create transaction for referrer
      await Transaction.create({
        user: referrer._id,
        type: 'deposit',
        amount: REFERRER_BONUS,
        balanceBefore: referrerOldBalance,
        balanceAfter: referrer.balance,
        description: `Referral bonus for inviting ${user.phone}`,
        status: 'completed'
      });

      // Create transaction for new user (signup bonus)
      await Transaction.create({
        user: user._id,
        type: 'deposit',
        amount: REFERRED_BONUS,
        balanceBefore: 0,
        balanceAfter: user.balance,
        description: `Signup bonus for using referral code ${referralCode}`,
        status: 'completed'
      });

      console.log(`✅ Referral bonuses awarded: ₹${REFERRER_BONUS} to referrer, ₹${REFERRED_BONUS} to new user`);
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

    // Generate referral code for existing users who don't have one
    if (!user.referralCode) {
      user.referralCode = await generateReferralCode();
      await user.save();
      console.log(`✅ Generated referral code for existing user: ${user.referralCode}`);
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

module.exports = router;
